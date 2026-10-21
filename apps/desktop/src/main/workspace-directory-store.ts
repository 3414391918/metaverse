import {
  lstat,
  mkdir,
  readFile,
  realpath,
  rename,
  writeFile
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { copyWorkspaceData } from "./workspace-directory-migration";
import {
  WorkspaceDirectorySettingsSchema,
  type WorkspaceDirectorySettings
} from "@deepwrite/contracts";

interface DiskWorkspaceDirectorySettings {
  version: 2;
  path: string;
  previousPath: string | null;
  migrationSourcePath: string | null;
}
function isNodeError(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}

export class WorkspaceDirectoryStore {
  readonly settingsPath: string;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(userDataPath: string) {
    this.settingsPath = join(
      userDataPath,
      "config",
      "workspace-directory.json"
    );
  }

  async list(): Promise<WorkspaceDirectorySettings> {
    await this.writeChain;
    return this.readSettings();
  }

  private async readSettings(): Promise<WorkspaceDirectorySettings> {
    try {
      const raw = JSON.parse(
        await readFile(this.settingsPath, "utf8")
      ) as unknown;
      if (
        !raw ||
        typeof raw !== "object" ||
        Array.isArray(raw) ||
        !("version" in raw) ||
        (raw.version !== 1 && raw.version !== 2) ||
        !("path" in raw) ||
        typeof raw.path !== "string" ||
        !raw.path.trim()
      ) {
        return { path: null, previousPath: null, migrationSourcePath: null };
      }
      return WorkspaceDirectorySettingsSchema.parse({
        path: raw.path,
        previousPath:
          raw.version === 2 && "previousPath" in raw ? raw.previousPath : null,
        migrationSourcePath:
          raw.version === 2 && "migrationSourcePath" in raw
            ? raw.migrationSourcePath
            : null
      });
    } catch (error: unknown) {
      if (isNodeError(error, "ENOENT") || error instanceof SyntaxError) {
        return { path: null, previousPath: null, migrationSourcePath: null };
      }
      throw error;
    }
  }

  async initializeDefault(
    defaultPath: string
  ): Promise<WorkspaceDirectorySettings> {
    const current = await this.list();
    if (current.path) {
      return current;
    }

    const absoluteDefaultPath = resolve(defaultPath);
    await mkdir(absoluteDefaultPath, { recursive: true });
    return this.save(await realpath(absoluteDefaultPath));
  }

  async save(rawPath: string): Promise<WorkspaceDirectorySettings> {
    const requestedPath = rawPath.trim();
    if (!requestedPath) {
      throw new Error("工作目录不能为空。");
    }
    return this.enqueue(async () => {
      const previous = await this.readSettings();
      const absolutePath = resolve(requestedPath);
      const info = await lstat(absolutePath);
      if (info.isSymbolicLink() || !info.isDirectory()) {
        throw new Error("工作目录必须是本地真实文件夹，不能是文件或符号链接。");
      }
      const canonicalPath = await realpath(absolutePath);
      if (canonicalPath === previous.path) {
        return previous;
      }
      const disk: DiskWorkspaceDirectorySettings = {
        version: 2,
        path: canonicalPath,
        previousPath: previous.path,
        migrationSourcePath: null
      };
      await this.writeSettings(disk);
      return WorkspaceDirectorySettingsSchema.parse(disk);
    });
  }

  async restore(): Promise<WorkspaceDirectorySettings> {
    return this.enqueue(async () => {
      const current = await this.readSettings();
      if (!current.path || !current.previousPath) {
        throw new Error("没有可恢复的上一个工作目录。");
      }
      const previous = current.previousPath;
      const info = await lstat(previous);
      if (!info.isDirectory() || info.isSymbolicLink()) {
        throw new Error("上一个工作目录已不可用。");
      }
      const disk: DiskWorkspaceDirectorySettings = {
        version: 2,
        path: await realpath(previous),
        previousPath: null,
        migrationSourcePath: current.path
      };
      await this.writeSettings(disk);
      return WorkspaceDirectorySettingsSchema.parse(disk);
    });
  }

  async migrate(): Promise<WorkspaceDirectorySettings> {
    return this.enqueue(async () => {
      const current = await this.readSettings();
      if (!current.path || !current.migrationSourcePath) {
        throw new Error("没有可迁移的恢复前目录。");
      }
      await copyWorkspaceData(current.migrationSourcePath, current.path);
      const disk: DiskWorkspaceDirectorySettings = {
        version: 2,
        path: current.path,
        previousPath: null,
        migrationSourcePath: null
      };
      await this.writeSettings(disk);
      return WorkspaceDirectorySettingsSchema.parse(disk);
    });
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const operation = this.writeChain.then(task);
    this.writeChain = operation.then(
      () => undefined,
      () => undefined
    );
    return operation;
  }

  private async writeSettings(
    disk: DiskWorkspaceDirectorySettings
  ): Promise<void> {
    await mkdir(dirname(this.settingsPath), { recursive: true });
    const temporary = `${this.settingsPath}.tmp-${process.pid}-${Date.now()}`;
    await writeFile(temporary, `${JSON.stringify(disk, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600
    });
    await rename(temporary, this.settingsPath);
  }
}
