import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEnvelope } from "@deepwrite/contracts";

const electronMocks = vi.hoisted(() => ({
  fork: vi.fn()
}));

vi.mock("electron", () => ({
  utilityProcess: {
    fork: electronMocks.fork
  }
}));

import { UtilitySupervisor } from "./supervisor";

class FakeUtilityProcess extends EventEmitter {
  readonly posted: unknown[] = [];
  readonly pid: number;
  exitCode: number | null | undefined;
  private exited = false;

  constructor(pid: number) {
    super();
    this.pid = pid;
  }

  postMessage(message: unknown): void {
    this.posted.push(message);
    const kind = (message as { kind?: string }).kind ?? "unknown";
    if (kind === "utility.health.request") {
      const requestId = (message as { requestId: string }).requestId;
      queueMicrotask(() => {
        this.emit("message", {
          kind: "utility.health",
          worker: "core",
          requestId,
          payload: {
            name: "core",
            status: "ok",
            pid: this.pid,
            startedAt: new Date().toISOString(),
            lastHeartbeatAt: new Date().toISOString(),
            details: {}
          }
        });
      });
    }
    if (kind === "utility.shutdown") {
      const requestId = (message as { requestId: string }).requestId;
      queueMicrotask(() => {
        this.emit("message", {
          kind: "utility.shutdown_ack",
          worker: "core",
          requestId,
          timestamp: new Date().toISOString()
        });
        this.exit(0);
      });
    }
  }

  kill(): boolean {
    this.exit(null);
    return true;
  }

  dispatch(message: unknown): void {
    this.emit("message", message);
  }

  exit(code: number | null): void {
    if (this.exited) {
      return;
    }
    this.exited = true;
    this.exitCode = code;
    this.emit("exit", code);
  }
}

async function flushMicrotasks(): Promise<void> {
  for (let index = 0; index < 8; index += 1) {
    await Promise.resolve();
  }
}

describe("UtilitySupervisor (Core only)", () => {
  const supervisors: UtilitySupervisor[] = [];
  let child: FakeUtilityProcess | undefined;

  beforeEach(() => {
    electronMocks.fork.mockReset();
    electronMocks.fork.mockImplementation(() => {
      child = new FakeUtilityProcess(10_000);
      return child;
    });
  });

  afterEach(async () => {
    await Promise.all(
      supervisors.splice(0).map((supervisor) => supervisor.shutdownAll())
    );
    child = undefined;
  });

  function createSupervisor(): UtilitySupervisor {
    const supervisor = new UtilitySupervisor({
      onUtilityEvent: vi.fn(),
      onUnexpectedExit: vi.fn(),
      onWorkerRestarted: vi.fn()
    });
    supervisors.push(supervisor);
    return supervisor;
  }

  it("forks exactly one utility process: the Core entry", () => {
    const supervisor = createSupervisor();
    supervisor.startAll();
    expect(electronMocks.fork).toHaveBeenCalledTimes(1);
    const [entryPath, , options] = electronMocks.fork.mock.calls[0] as [
      string,
      unknown[],
      { serviceName: string; env?: NodeJS.ProcessEnv }
    ];
    expect(entryPath.endsWith("utilities/core-entry.js")).toBe(true);
    expect(options.serviceName).toBe("deepwrite-core");
    expect(options.env).toEqual(expect.objectContaining(process.env));
  });

  it("never forks a removed Agent or Tool worker across full lifecycle restarts", async () => {
    const supervisor = createSupervisor();
    supervisor.startAll();
    // A network-proxy style preference change no longer restarts any worker,
    // but even explicit core restarts must never fork an agent or tool entry.
    await supervisor.restartWorker("core", "network-proxy-preference");
    await supervisor.restartWorker("core", "unexpected-exit");
    supervisor.startAll();
    await supervisor.shutdownAll();
    await flushMicrotasks();
    for (const [entryPath, , options] of electronMocks.fork.mock.calls as [
      string,
      unknown[],
      { serviceName: string }
    ][]) {
      expect(entryPath.endsWith("core-entry.js")).toBe(true);
      expect(options.serviceName).toBe("deepwrite-core");
    }
  });

  it("collects health for the single Core worker only", async () => {
    const supervisor = createSupervisor();
    supervisor.startAll();
    child!.dispatch({
      kind: "utility.ready",
      worker: "core",
      pid: child!.pid,
      startedAt: new Date().toISOString()
    });
    const health = await supervisor.collectHealth();
    expect(health.status).toBe("ok");
    expect(health.workers).toHaveLength(1);
    expect(health.workers[0]).toMatchObject({
      name: "core",
      status: "ok",
      pid: child!.pid
    });
  });

  it("routes a command to Core and correlates the result", async () => {
    const supervisor = createSupervisor();
    supervisor.startAll();
    const command = createEnvelope("system.health", {}, { id: "cmd_core" });
    const pending = supervisor.requestCommand("core", command);
    const request = child!.posted.find(
      (message) =>
        (message as { kind?: string }).kind === "utility.command.request"
    ) as { requestId: string } | undefined;
    expect(request?.requestId).toBe(command.id);
    child!.dispatch({
      kind: "utility.command.result",
      worker: "core",
      requestId: command.id,
      result: { status: "accepted", requestId: command.id, payload: {} }
    });
    expect(await pending).toMatchObject({
      status: "accepted",
      requestId: command.id
    });
  });

  it("rejects commands addressed to a removed worker without forking", async () => {
    const supervisor = createSupervisor();
    supervisor.startAll();
    const command = createEnvelope("system.health", {}, { id: "cmd_ghost" });
    const result = await supervisor.requestCommand("agent" as never, command);
    expect(result).toMatchObject({
      status: "rejected",
      error: { code: "utility.unknown_worker" }
    });
    expect(electronMocks.fork).toHaveBeenCalledTimes(1);
  });

  it("rejects duplicate pending commands for Core", async () => {
    const supervisor = createSupervisor();
    supervisor.startAll();
    const command = createEnvelope("system.health", {}, { id: "cmd_dup" });
    void supervisor.requestCommand("core", command).catch(() => undefined);
    const duplicate = await supervisor.requestCommand("core", command);
    expect(duplicate).toMatchObject({
      status: "rejected",
      error: { code: "utility.duplicate_command" }
    });
  });

  it("broadcasts worker events from Core", () => {
    const onUtilityEvent = vi.fn();
    const supervisor = new UtilitySupervisor({
      onUtilityEvent,
      onUnexpectedExit: vi.fn(),
      onWorkerRestarted: vi.fn()
    });
    supervisors.push(supervisor);
    supervisor.startAll();
    const event = createEnvelope(
      "system.worker_restarted",
      {
        worker: "core",
        reason: "exit:11",
        restartedAt: new Date().toISOString()
      },
      { id: "evt_restart_broadcast" }
    );
    child!.dispatch({
      kind: "utility.command.event",
      worker: "core",
      requestId: "evt_restart_broadcast",
      event
    });
    expect(onUtilityEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "system.worker_restarted" }),
      "core"
    );
  });

  it("shuts the Core worker down through the graceful ack path", async () => {
    const supervisor = createSupervisor();
    supervisor.startAll();
    await supervisor.shutdownAll();
    await flushMicrotasks();
    expect(child!.posted).toContainEqual(
      expect.objectContaining({ kind: "utility.shutdown" })
    );
    expect(child!.exitCode).toBe(0);
  });

  it("restarts Core after an unexpected exit and reports recovery", async () => {
    vi.useFakeTimers();
    try {
      const onUnexpectedExit = vi.fn();
      const onWorkerRestarted = vi.fn();
      const supervisor = new UtilitySupervisor({
        onUtilityEvent: vi.fn(),
        onUnexpectedExit,
        onWorkerRestarted
      });
      supervisors.push(supervisor);
      supervisor.startAll();
      const first = child!;
      first.exit(11);
      expect(onUnexpectedExit).toHaveBeenCalledWith("core", "exit:11");
      await vi.advanceTimersByTimeAsync(300);
      const restarted = child!;
      expect(restarted).not.toBe(first);
      expect(electronMocks.fork).toHaveBeenCalledTimes(2);
      restarted.dispatch({
        kind: "utility.ready",
        worker: "core",
        pid: restarted.pid,
        startedAt: new Date().toISOString()
      });
      expect(onWorkerRestarted).toHaveBeenCalledWith("core", "exit:11");
    } finally {
      vi.useRealTimers();
    }
  });
});
