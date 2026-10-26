import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  lstat,
  mkdir,
  realpath,
  writeFile,
  rename,
  rm
} from "node:fs/promises";
import { delimiter, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { AssistantConnection } from "@deepwrite/contracts";

/** Replace generated files rather than following a user-created leaf symlink. */
async function writeGenerated(path: string, value: string, mode = 0o600) {
  const temporary = `${path}.${randomBytes(8).toString("hex")}.next`;
  try {
    await writeFile(temporary, value, { flag: "wx", mode });
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}

/** Read the CLI's authenticated loopback URL without relaying credentials to logs. */
export function assistantReadyUrl(line: string): string | undefined {
  const match = line.match(
    /^dsh web: (http:\/\/127\.0\.0\.1:\d+\/\?token=[A-Za-z0-9_-]+)\s*$/u
  );
  return match?.[1];
}
export function assistantOverlay(pluginPath: string) {
  return [
    ...[
      "ui-layout",
      "ui-sidebar",
      "ui-settings-general",
      "ui-settings-account",
      "ui-settings-session-log",
      "ui-brand-official",
      "product-analytics",
      "desktop-product-telemetry",
      "harness-dev-context",
      "session-log-deepseek"
    ].map((id) => ({ id, disabled: true })),
    {
      insert: [
        {
          id: "metaverse-integration",
          name: pathToFileURL(join(pluginPath, "index.js")).href
        }
      ]
    }
  ];
}

export class AssistantRuntime {
  private child: ChildProcess | undefined;
  private workspace: string | undefined;
  private connection: Promise<AssistantConnection> | undefined;
  private readyConnection: AssistantConnection | undefined;
  private stopping: Promise<void> | undefined;
  private generation = 0;
  private cancellationVersion = 0;
  private transitions: Promise<unknown> = Promise.resolve();
  private serialize<T>(task: () => Promise<T>): Promise<T> {
    const result = this.transitions.then(task);
    this.transitions = result.catch(() => undefined);
    return result;
  }
  constructor(
    private readonly options: {
      executable: string;
      cli: string;
      plugin: string;
      environment?: NodeJS.ProcessEnv;
      startupTimeoutMs?: number;
    }
  ) {}

  isGuestUrl(value: string, initial = false): boolean {
    if (!this.readyConnection) return false;
    try {
      const url = new URL(value),
        expected = new URL(this.readyConnection.url);
      if (url.origin !== expected.origin || url.pathname !== "/") return false;
      if (!initial) return true;
      return (
        url.search === expected.search &&
        new URLSearchParams(url.hash.slice(1)).get("metaverse") ===
          this.readyConnection.nonce
      );
    } catch {
      return false;
    }
  }

  async ensure(directory: string): Promise<AssistantConnection> {
    const cancellationVersion = this.cancellationVersion;
    const info = await lstat(directory);
    if (!info.isDirectory() || info.isSymbolicLink())
      throw new Error("工作目录不是可用的本地文件夹。");
    const workspace = await realpath(directory);
    const result = await this.serialize(async () => {
      if (cancellationVersion !== this.cancellationVersion)
        throw new Error("智能体启动已取消。");
      if (this.workspace === workspace && this.connection)
        return { pending: this.connection };
      await this.stopCurrent();
      this.workspace = workspace;
      const pending = this.launch(workspace, this.generation);
      this.connection = pending;
      return { pending };
    });
    try {
      return await result.pending;
    } catch (error) {
      if (this.connection === result.pending) this.connection = undefined;
      throw error;
    }
  }

  private async launch(
    workspace: string,
    generation: number
  ): Promise<AssistantConnection> {
    const home = join(workspace, "assistant");
    await mkdir(home, { recursive: true });
    // Reject redirected state folders before handing them to the subprocess.
    if ((await realpath(home)) !== resolve(home))
      throw new Error("智能体数据目录不能是符号链接。");
    const overlay = join(home, "metaverse.patch.json");
    await writeGenerated(
      overlay,
      JSON.stringify(assistantOverlay(this.options.plugin), null, 2)
    );
    const guide = join(home, "platform.md");
    await writeGenerated(
      guide,
      `# 元宇宙创作平台\n\n当前应用工作目录：${workspace}\n\n平台工具位于 ${join(workspace, "tools")}，其中每个工具的 SKILL.md、说明和脚本都可直接读取。先读取所需工具的说明，再通过它提供的接口操作书籍、人物、插图和声音。项目索引位于 ${join(workspace, ".metaverse")}；写入正文与媒体时使用创作工具的接口，遵守文件版本和合并规则。不得把对话说明写入小说正文。\n`
    );
    if (generation !== this.generation) throw new Error("智能体启动已取消。");
    const bin = join(home, "runtime-bin");
    await mkdir(bin, { recursive: true });
    if ((await realpath(bin)) !== resolve(bin))
      throw new Error("运行目录不能是符号链接。");
    const windows = process.platform === "win32";
    const nodeShim = windows
      ? `@echo off\r\nsetlocal DisableDelayedExpansion\r\n"${this.options.executable.replaceAll("%", "%%")}" %*\r\n`
      : `#!/bin/sh\nexec '${this.options.executable.replaceAll("'", "'\\''")}' "$@"\n`;
    await writeGenerated(
      join(bin, windows ? "node.cmd" : "node"),
      nodeShim,
      0o755
    );
    if (generation !== this.generation) throw new Error("智能体启动已取消。");
    const child = spawn(
      this.options.executable,
      [
        this.options.cli,
        "--profile",
        "web",
        "--patch",
        overlay,
        "--no-open",
        "--port",
        "0"
      ],
      {
        cwd: workspace,
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          ...this.options.environment,
          ELECTRON_RUN_AS_NODE: undefined,
          DSH_HOME: home,
          PATH: `${bin}${delimiter}${process.env.PATH ?? ""}`,
          METAVERSE_ASSISTANT_GUIDE: guide,
          METAVERSE_WORKSPACE_ROOT: workspace
        }
      }
    );
    this.child = child;
    return new Promise((accept, reject) => {
      let ready = false,
        tail = "",
        stdout = "";
      const timeout = setTimeout(() => {
        reject(new Error("智能体启动超时，请重新启动智能体。"));
        child.kill("SIGTERM");
      }, this.options.startupTimeoutMs ?? 60_000);
      timeout.unref();
      child.stderr?.setEncoding("utf8");
      child.stderr?.on("data", (part: string) => {
        tail = (tail + part)
          .slice(-5000)
          .replace(/token=[A-Za-z0-9_-]+/gu, "token=[redacted]");
      });
      child.stdout?.setEncoding("utf8");
      child.stdout?.on("data", (part: string) => {
        stdout = (stdout + part).slice(-10000);
        const lines = stdout.split(/\r?\n/u);
        stdout = lines.pop() ?? "";
        for (const line of lines) {
          const url = assistantReadyUrl(line);
          if (
            !url ||
            ready ||
            this.child !== child ||
            generation !== this.generation
          )
            continue;
          ready = true;
          clearTimeout(timeout);
          this.readyConnection = {
            url,
            nonce: randomBytes(24).toString("hex"),
            workspace
          };
          accept(this.readyConnection);
        }
      });
      child.once("error", (error) => {
        clearTimeout(timeout);
        if (this.child === child) this.child = undefined;
        reject(new Error(`智能体启动失败：${error.message}`));
      });
      child.once("exit", (code, signal) => {
        clearTimeout(timeout);
        if (this.child === child) {
          this.child = undefined;
          this.connection = undefined;
          this.readyConnection = undefined;
        }
        if (!ready)
          reject(new Error(`智能体未能启动（${signal ?? code}）。${tail}`));
      });
    });
  }

  stop(): Promise<void> {
    this.cancellationVersion++;
    return this.serialize(() => this.stopCurrent());
  }

  private async stopCurrent(): Promise<void> {
    this.generation++;
    if (this.stopping) return this.stopping;
    const child = this.child;
    this.connection = undefined;
    this.readyConnection = undefined;
    this.workspace = undefined;
    if (!child?.pid) return;
    this.stopping = new Promise<void>((accept) => {
      if (child.exitCode !== null || child.signalCode !== null) {
        accept();
        return;
      }
      child.once("exit", () => accept());
      const timeout = setTimeout(() => child.kill("SIGKILL"), 5000);
      timeout.unref();
      child.once("exit", () => clearTimeout(timeout));
      child.kill("SIGTERM");
    });
    try {
      await this.stopping;
    } finally {
      this.stopping = undefined;
      if (this.child === child) this.child = undefined;
    }
  }
}
