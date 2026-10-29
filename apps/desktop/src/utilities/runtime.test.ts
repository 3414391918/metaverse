import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEnvelope } from "@deepwrite/contracts";
import { bootUtility } from "./runtime";

class FakeParentPort extends EventEmitter {
  readonly posted: unknown[] = [];

  postMessage(message: unknown): void {
    this.posted.push(message);
  }

  dispatch(message: unknown): void {
    this.emit("message", { data: message });
  }
}

async function flushMicrotasks(): Promise<void> {
  for (let index = 0; index < 8; index += 1) {
    await Promise.resolve();
  }
}

describe("utility runtime (Core only)", () => {
  let port: FakeParentPort;
  let originalParentPort: PropertyDescriptor | undefined;
  let signalListeners: Map<
    NodeJS.Signals,
    ReturnType<typeof process.listeners>
  >;

  beforeEach(() => {
    vi.useFakeTimers();
    signalListeners = new Map(
      (["SIGINT", "SIGTERM"] as const).map((signal) => [
        signal,
        process.listeners(signal)
      ])
    );
    port = new FakeParentPort();
    originalParentPort = Object.getOwnPropertyDescriptor(process, "parentPort");
    Object.defineProperty(process, "parentPort", {
      configurable: true,
      value: port
    });
    vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    for (const [signal, original] of signalListeners) {
      for (const listener of process.listeners(signal)) {
        if (!original.includes(listener))
          process.removeListener(signal, listener);
      }
    }
    port.removeAllListeners();
    if (originalParentPort) {
      Object.defineProperty(process, "parentPort", originalParentPort);
    } else {
      Reflect.deleteProperty(process, "parentPort");
    }
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  function deliverSignal(signal: NodeJS.Signals): void {
    const original = signalListeners.get(signal)!;
    const listener = process
      .listeners(signal)
      .find((item) => !original.includes(item)) as (() => void) | undefined;
    expect(listener).toBeDefined();
    // Invoke only the Utility listener, without interrupting the test runner.
    listener!();
  }

  it("keeps Core writable after Ctrl+C and drains its final save before Main shuts it down", async () => {
    let finishSave!: () => void;
    const saving = new Promise<void>((resolve) => {
      finishSave = resolve;
    });
    const onShutdown = vi.fn();
    bootUtility("core", {
      async commandHandler(command) {
        await saving;
        return {
          status: "accepted",
          requestId: command.id,
          payload: { ok: true }
        };
      },
      onShutdown
    });
    deliverSignal("SIGINT");
    deliverSignal("SIGINT");
    const command = createEnvelope(
      "rendererState.save",
      {
        key: "conversation-preferences:shutdown-test",
        value: { draft: "shutdown regression fixture" }
      },
      { id: "final_save" }
    );
    port.dispatch({
      kind: "utility.command.request",
      requestId: command.id,
      command
    });
    await flushMicrotasks();
    expect(onShutdown).not.toHaveBeenCalled();
    expect(port.posted).not.toContainEqual(
      expect.objectContaining({ kind: "utility.command.result" })
    );
    port.dispatch({ kind: "utility.shutdown", requestId: "main_shutdown" });
    await flushMicrotasks();
    expect(onShutdown).not.toHaveBeenCalled();
    expect(process.exit).not.toHaveBeenCalled();
    finishSave();
    await flushMicrotasks();
    expect(port.posted).toContainEqual(
      expect.objectContaining({
        kind: "utility.command.result",
        result: expect.objectContaining({
          status: "accepted",
          requestId: "final_save"
        })
      })
    );
    expect(port.posted).toContainEqual(
      expect.objectContaining({
        kind: "utility.shutdown_ack",
        requestId: "main_shutdown"
      })
    );
    expect(onShutdown).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(20);
    expect(process.exit).toHaveBeenCalledWith(0);
  });

  it("retains SIGTERM shutdown for the supervisor kill fallback", async () => {
    const onShutdown = vi.fn();
    bootUtility("core", { onShutdown });
    deliverSignal("SIGTERM");
    await flushMicrotasks();
    expect(onShutdown).toHaveBeenCalledOnce();
    expect(port.posted).toContainEqual(
      expect.objectContaining({
        kind: "utility.shutdown_ack",
        requestId: "signal_sigterm"
      })
    );
    await vi.advanceTimersByTimeAsync(20);
    expect(process.exit).toHaveBeenCalledWith(0);
  });

  it("rejects unhandled commands instead of hanging the Core runtime", async () => {
    bootUtility("core", {});
    const command = createEnvelope("system.health", {}, { id: "unhandled" });
    port.dispatch({
      kind: "utility.command.request",
      requestId: command.id,
      command
    });
    await flushMicrotasks();
    expect(port.posted).toContainEqual(
      expect.objectContaining({
        kind: "utility.command.result",
        requestId: command.id,
        result: expect.objectContaining({
          status: "rejected",
          error: expect.objectContaining({
            code: "utility.unsupported_command"
          })
        })
      })
    );
  });

  it("answers health requests from the supervisor", async () => {
    bootUtility("core", { mode: "catalog-store" });
    port.dispatch({ kind: "utility.health.request", requestId: "health_1" });
    await flushMicrotasks();
    expect(port.posted).toContainEqual(
      expect.objectContaining({
        kind: "utility.health",
        requestId: "health_1",
        payload: expect.objectContaining({
          name: "core",
          status: "ok",
          details: expect.objectContaining({ mode: "catalog-store" })
        })
      })
    );
  });

  it("no longer accepts internal command bridge traffic", async () => {
    const commandHandler = vi.fn();
    bootUtility("core", { commandHandler });
    port.dispatch({
      kind: "utility.internal.command.request",
      worker: "agent",
      target: "core",
      requestId: "bridge_1",
      parentRequestId: "parent_1",
      timeoutMs: 1_000,
      command: createEnvelope("system.health", {}, { id: "internal_1" })
    });
    await flushMicrotasks();
    expect(commandHandler).not.toHaveBeenCalled();
    expect(port.posted).not.toContainEqual(
      expect.objectContaining({ kind: "utility.internal.command.result" })
    );
  });
});
