import { utilityProcess, type UtilityProcess } from "electron";
import { join } from "node:path";
import {
  UtilityOutboundMessageSchema,
  type CommandEnvelope,
  type CommandResult,
  type SystemEventEnvelope,
  type UtilityHealthPayload,
  type UtilityWorkerName
} from "@deepwrite/contracts";
import { createId, nowIso } from "@deepwrite/shared";

type WorkerStatus = UtilityHealthPayload["status"];

export class UtilityCommandTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UtilityCommandTimeoutError";
  }
}

interface PendingHealthCheck {
  resolve(payload: UtilityHealthPayload): void;
  timer: NodeJS.Timeout;
}

interface PendingCommand {
  commandId: string;
  resolve(result: CommandResult): void;
  reject(error: Error): void;
  timer: NodeJS.Timeout | undefined;
}

interface PendingShutdown {
  resolve(): void;
  timer: NodeJS.Timeout;
}

export interface UtilitySupervisorOptions {
  onUtilityEvent(event: SystemEventEnvelope, worker: UtilityWorkerName): void;
  onUnexpectedExit(worker: UtilityWorkerName, reason: string): void;
  onWorkerRestarted(worker: UtilityWorkerName, reason: string): void;
}

class UtilityWorker {
  private child: UtilityProcess | undefined;
  private status: WorkerStatus = "stopped";
  private pid: number | undefined;
  private startedAt: string | undefined;
  private lastHeartbeatAt: string | undefined;
  private isStopping = false;
  private readonly pendingHealth = new Map<string, PendingHealthCheck>();
  private readonly pendingCommands = new Map<string, PendingCommand>();
  private pendingShutdown: PendingShutdown | undefined;

  constructor(
    private readonly name: UtilityWorkerName,
    private readonly entryPath: string,
    private readonly onUnexpectedExit: (
      worker: UtilityWorkerName,
      reason: string
    ) => void,
    private readonly onReady: (worker: UtilityWorkerName) => void,
    private readonly onUtilityEvent: (
      event: SystemEventEnvelope,
      worker: UtilityWorkerName
    ) => void,
    private readonly onExit: (worker: UtilityWorkerName, reason: string) => void
  ) {}

  start(): void {
    if (this.child || this.isStopping) {
      return;
    }

    this.status = "starting";
    const child = utilityProcess.fork(this.entryPath, [], {
      serviceName: `deepwrite-${this.name}`,
      env: { ...process.env }
    });
    this.child = child;
    this.pid = child.pid;

    child.on("message", (message: unknown) => this.handleMessage(message));
    child.once("exit", (code) => {
      const unexpected = !this.isStopping;
      const reason = `exit:${code ?? "unknown"}`;
      this.child = undefined;
      this.pid = undefined;
      this.status = "stopped";
      this.startedAt = undefined;
      this.lastHeartbeatAt = undefined;
      this.resolvePendingHealth("degraded");
      this.rejectPendingCommands(
        new Error(`${this.name} utility exited: ${reason}`)
      );
      this.resolvePendingShutdown();
      this.onExit(this.name, reason);

      if (unexpected) {
        this.onUnexpectedExit(this.name, reason);
      }
    });
  }

  async requestHealth(timeoutMs = 1600): Promise<UtilityHealthPayload> {
    const child = this.child;
    if (!child) {
      return this.snapshot("degraded");
    }

    const requestId = createId(`health_${this.name}`);
    return await new Promise<UtilityHealthPayload>((resolve) => {
      const timer = setTimeout(() => {
        this.pendingHealth.delete(requestId);
        resolve(
          this.snapshot(this.status === "starting" ? "starting" : "degraded")
        );
      }, timeoutMs);
      this.pendingHealth.set(requestId, { resolve, timer });
      try {
        child.postMessage({ kind: "utility.health.request", requestId });
      } catch {
        clearTimeout(timer);
        this.pendingHealth.delete(requestId);
        resolve(this.snapshot("degraded"));
      }
    });
  }

  requestCommand(
    command: CommandEnvelope,
    timeoutMs = 60_000,
    requestId = command.id
  ): Promise<CommandResult> {
    const child = this.child;
    if (!child || this.isStopping) {
      return Promise.resolve({
        status: "rejected",
        requestId: command.id,
        error: {
          code: "utility.not_running",
          message: `${this.name} utility is not available.`
        }
      });
    }

    if (
      this.pendingCommands.has(requestId) ||
      [...this.pendingCommands.values()].some(
        (pending) => pending.commandId === command.id
      )
    ) {
      return Promise.resolve({
        status: "rejected",
        requestId: command.id,
        error: {
          code: "utility.duplicate_command",
          message: `A command with id ${command.id} is already pending.`
        }
      });
    }

    return new Promise<CommandResult>((resolve, reject) => {
      const timer =
        timeoutMs > 0
          ? setTimeout(() => {
              this.pendingCommands.delete(requestId);
              reject(
                new UtilityCommandTimeoutError(
                  `${this.name} utility command timed out: ${command.type}`
                )
              );
            }, timeoutMs)
          : undefined;
      this.pendingCommands.set(requestId, {
        commandId: command.id,
        resolve,
        reject,
        timer
      });

      try {
        child.postMessage({
          kind: "utility.command.request",
          requestId,
          command
        });
      } catch (error: unknown) {
        clearTimeout(timer);
        this.pendingCommands.delete(requestId);
        reject(
          error instanceof Error
            ? error
            : new Error("Failed to post utility command.")
        );
      }
    });
  }

  cancelCommandRequest(requestId: string, error: Error): void {
    const pending = this.pendingCommands.get(requestId);
    if (!pending) {
      return;
    }
    clearTimeout(pending.timer);
    this.pendingCommands.delete(requestId);
    pending.reject(error);
  }

  shutdown(timeoutMs = 30_000): Promise<void> {
    this.isStopping = true;
    const child = this.child;
    if (!child) {
      this.status = "stopped";
      return Promise.resolve();
    }
    if (this.pendingShutdown) {
      return new Promise<void>((resolve) => {
        const poll = setInterval(() => {
          if (!this.pendingShutdown) {
            clearInterval(poll);
            resolve();
          }
        }, 10);
        poll.unref();
      });
    }

    const requestId = createId(`shutdown_${this.name}`);
    return new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        child.kill();
        setTimeout(() => this.resolvePendingShutdown(), 250).unref();
      }, timeoutMs);
      this.pendingShutdown = { resolve, timer };
      try {
        child.postMessage({ kind: "utility.shutdown", requestId });
      } catch {
        child.kill();
      }
    });
  }

  async restart(): Promise<void> {
    if (this.child) {
      await this.shutdown();
    }
    this.isStopping = false;
    this.start();
  }

  private snapshot(status: WorkerStatus = this.status): UtilityHealthPayload {
    return {
      name: this.name,
      status,
      ...(this.pid ? { pid: this.pid } : {}),
      ...(this.startedAt ? { startedAt: this.startedAt } : {}),
      ...(this.lastHeartbeatAt
        ? { lastHeartbeatAt: this.lastHeartbeatAt }
        : {}),
      details: { entry: this.entryPath }
    };
  }

  private handleMessage(rawMessage: unknown): void {
    const parsed = UtilityOutboundMessageSchema.safeParse(rawMessage);
    if (!parsed.success) {
      const raw = rawMessage as Record<string, unknown> | null;
      const requestId =
        raw && typeof raw.requestId === "string" ? raw.requestId : undefined;
      const isCommandResponse =
        raw?.kind === "utility.command.result" ||
        raw?.kind === "utility.command.event";
      const pending =
        requestId && isCommandResponse
          ? this.pendingCommands.get(requestId)
          : undefined;
      if (requestId && pending) {
        clearTimeout(pending.timer);
        this.pendingCommands.delete(requestId);
        pending.reject(
          new Error(`${this.name} utility emitted an invalid command message.`)
        );
      }
      return;
    }

    const message = parsed.data;
    if (message.worker !== this.name) {
      return;
    }

    if (message.kind === "utility.ready") {
      this.status = "ok";
      this.pid = message.pid;
      this.startedAt = message.startedAt;
      this.lastHeartbeatAt = nowIso();
      this.onReady(this.name);
      return;
    }

    if (message.kind === "utility.heartbeat") {
      this.status = "ok";
      this.lastHeartbeatAt = message.timestamp;
      return;
    }

    if (message.kind === "utility.health") {
      const pending = this.pendingHealth.get(message.requestId);
      if (!pending) {
        return;
      }
      clearTimeout(pending.timer);
      this.pendingHealth.delete(message.requestId);
      if (message.payload.name !== this.name) {
        pending.resolve(this.snapshot("degraded"));
        return;
      }
      this.status = "ok";
      this.lastHeartbeatAt = nowIso();
      pending.resolve(message.payload);
      return;
    }

    if (message.kind === "utility.shutdown_ack") {
      this.status = "stopped";
      return;
    }

    if (message.kind === "utility.command.result") {
      const pending = this.pendingCommands.get(message.requestId);
      if (!pending) {
        return;
      }
      clearTimeout(pending.timer);
      this.pendingCommands.delete(message.requestId);
      if (message.result.requestId !== pending.commandId) {
        pending.reject(
          new Error("Utility result requestId does not match pending command.")
        );
        return;
      }
      pending.resolve(message.result);
      return;
    }

    this.onUtilityEvent(message.event, this.name);
  }

  private resolvePendingHealth(status: WorkerStatus): void {
    for (const [requestId, pending] of this.pendingHealth) {
      clearTimeout(pending.timer);
      pending.resolve(this.snapshot(status));
      this.pendingHealth.delete(requestId);
    }
  }

  private rejectPendingCommands(error: Error): void {
    for (const requestId of this.pendingCommands.keys()) {
      this.cancelCommandRequest(requestId, error);
    }
  }

  private resolvePendingShutdown(): void {
    const pending = this.pendingShutdown;
    if (!pending) {
      return;
    }
    clearTimeout(pending.timer);
    this.pendingShutdown = undefined;
    pending.resolve();
  }
}

/** Main supervises exactly one utility worker: the Core conversation runtime. */
export class UtilitySupervisor {
  private readonly core: UtilityWorker;
  private restartTimer: NodeJS.Timeout | undefined;
  private restartReason: string | undefined;
  private shuttingDown = false;

  constructor(private readonly options: UtilitySupervisorOptions) {
    this.core = new UtilityWorker(
      "core",
      join(__dirname, "utilities", "core-entry.js"),
      (worker, reason) => this.handleUnexpectedExit(worker, reason),
      (worker) => this.handleWorkerReady(worker),
      options.onUtilityEvent,
      (worker, reason) => this.handleWorkerExit(worker, reason)
    );
  }

  startAll(): void {
    if (this.shuttingDown) {
      return;
    }
    this.core.start();
  }

  requestCommand(
    worker: UtilityWorkerName,
    command: CommandEnvelope,
    timeoutMs?: number
  ): Promise<CommandResult> {
    if (worker !== "core") {
      return Promise.resolve({
        status: "rejected",
        requestId: command.id,
        error: {
          code: "utility.unknown_worker",
          message: `Unknown utility worker: ${worker}`
        }
      });
    }
    return this.core.requestCommand(command, timeoutMs);
  }

  async collectHealth(): Promise<{
    status: "starting" | "ok" | "degraded";
    checkedAt: string;
    workers: UtilityHealthPayload[];
  }> {
    const worker = await this.core.requestHealth();
    const status =
      worker.status === "ok"
        ? "ok"
        : worker.status === "starting"
          ? "starting"
          : "degraded";
    return { status, checkedAt: nowIso(), workers: [worker] };
  }

  async shutdownAll(): Promise<void> {
    this.shuttingDown = true;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = undefined;
    }
    this.restartReason = undefined;
    await this.core.shutdown(30_000);
  }

  async restartWorker(name: UtilityWorkerName, reason: string): Promise<void> {
    if (name !== "core" || this.shuttingDown) return;
    this.restartReason = reason;
    await this.core.restart();
  }

  private handleWorkerExit(_worker: UtilityWorkerName, _reason: string): void {
    // Only the Core worker exists; no cross-worker state to reconcile.
  }

  private handleUnexpectedExit(
    worker: UtilityWorkerName,
    reason: string
  ): void {
    this.restartReason = reason;
    this.options.onUnexpectedExit(worker, reason);
    if (this.shuttingDown || this.restartTimer) {
      return;
    }
    const timer = setTimeout(() => {
      this.restartTimer = undefined;
      if (!this.shuttingDown) {
        this.core.start();
      }
    }, 250);
    timer.unref();
    this.restartTimer = timer;
  }

  private handleWorkerReady(worker: UtilityWorkerName): void {
    const reason = this.restartReason;
    if (!reason) {
      return;
    }
    this.restartReason = undefined;
    this.options.onWorkerRestarted(worker, reason);
  }
}
