import {
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  rename,
  writeFile
} from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { copyWorkspaceData } from "./workspace-directory-migration";
import {
  WorkspaceDirectorySettingsSchema,
  type WorkspaceDirectorySettings
} from "@deepwrite/contracts";

interface DiskWorkspaceDirectorySettings {
  version: 3;
  path: string | null;
  previousPath: string | null;
  migrationSourcePath: string | null;
  directories: string[];
}
function isNodeError(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}

async function validateRealDirectory(rawPath: string): Promise<string> {
  const info = await lstat(rawPath);
  if (info.isSymbolicLink() || !info.isDirectory()) {
    throw new Error("工作目录必须是本地真实文件夹，不能是文件或符号链接。");
  }
  return realpath(rawPath);
}

function pathsOverlap(first: string, second: string): boolean {
  const relation = relative(first, second);
  return (
    relation === "" ||
    (relation !== ".." &&
      !relation.startsWith(`..${sep}`) &&
      !isAbsolute(relation))
  );
}

import { configurationDirectory } from "../storage-paths";

export class WorkspaceDirectoryStore {
  readonly settingsPath: string;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(userDataPath: string) {
    this.settingsPath = join(
      configurationDirectory(userDataPath),
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
        (raw.version !== 1 && raw.version !== 2 && raw.version !== 3) ||
        !("path" in raw) ||
        typeof raw.path !== "string" ||
        !raw.path.trim()
      ) {
        return {
          path: null,
          previousPath: null,
          migrationSourcePath: null,
          directories: []
        };
      }
      const legacyPreviousPath =
        raw.version >= 2 && "previousPath" in raw && typeof raw.previousPath === "string"
          ? raw.previousPath
          : null;
      const legacyMigrationSourcePath =
        raw.version >= 2 &&
        "migrationSourcePath" in raw &&
        typeof raw.migrationSourcePath === "string"
          ? raw.migrationSourcePath
          : null;
      // v1/v2 configs upgrade into a directory list automatically: the
      // current directory plus any previously tracked directories stay
      // readable and registered.
      const directoriesFromLegacy = [raw.path, legacyPreviousPath].filter(
        (entry): entry is string => typeof entry === "string" && entry.trim().length > 0
      );
      const rawDirectories = (
        raw as { directories?: unknown }
      ).directories;
      const directoriesFromDisk =
        raw.version === 3 && Array.isArray(rawDirectories)
          ? (rawDirectories.filter(
              (entry): entry is string =>
                typeof entry === "string" && entry.trim().length > 0
            ) as string[])
          : [];
      const directories = Array.from(
        new Set([...directoriesFromDisk, ...directoriesFromLegacy])
      );
      return WorkspaceDirectorySettingsSchema.parse({
        path: raw.path,
        previousPath: legacyPreviousPath,
        migrationSourcePath: legacyMigrationSourcePath,
        directories
      });
    } catch (error: unknown) {
      if (isNodeError(error, "ENOENT") || error instanceof SyntaxError) {
        return {
          path: null,
          previousPath: null,
          migrationSourcePath: null,
          directories: []
        };
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

  private async writeWithDirectories(
    current: WorkspaceDirectorySettings,
    nextPath: string | null,
    nextPreviousPath: string | null,
    nextMigrationSourcePath: string | null
  ): Promise<WorkspaceDirectorySettings> {
    const directories = Array.from(
      new Set(
        [...current.directories, ...(nextPath ? [nextPath] : [])].filter(
          (entry) => entry.trim().length > 0
        )
      )
    );
    const disk: DiskWorkspaceDirectorySettings = {
      version: 3,
      path: nextPath,
      previousPath: nextPreviousPath,
      migrationSourcePath: nextMigrationSourcePath,
      directories
    };
    await this.writeSettings(disk);
    return WorkspaceDirectorySettingsSchema.parse(disk);
  }

  /** Registers a directory in the managed list without switching to it. */
  async add(rawPath: string): Promise<WorkspaceDirectorySettings> {
    const requestedPath = rawPath.trim();
    if (!requestedPath) {
      throw new Error("工作目录不能为空。");
    }
    return this.enqueue(async () => {
      const current = await this.readSettings();
      const canonicalPath = await validateRealDirectory(resolve(requestedPath));
      if (current.directories.includes(canonicalPath)) {
        if (canonicalPath === current.path) {
          throw new Error("该目录已是当前工作目录。");
        }
        throw new Error("该目录已在管理列表中。");
      }
      // First registered directory becomes the current one so existing
      // flows (fresh installs) keep working unchanged.
      if (!current.path) {
        return this.writeWithDirectories(
          current,
          canonicalPath,
          current.previousPath,
          null
        );
      }
      const directories = [...current.directories, canonicalPath];
      const disk: DiskWorkspaceDirectorySettings = {
        version: 3,
        path: current.path,
        previousPath: current.previousPath,
        migrationSourcePath: current.migrationSourcePath,
        directories
      };
      await this.writeSettings(disk);
      return WorkspaceDirectorySettingsSchema.parse(disk);
    });
  }

  /** Removes a directory from the managed list without touching disk data. */
  async remove(rawPath: string): Promise<WorkspaceDirectorySettings> {
    const requestedPath = rawPath.trim();
    if (!requestedPath) {
      throw new Error("要移除的目录不能为空。");
    }
    return this.enqueue(async () => {
      const current = await this.readSettings();
      // Registration removal must work even when the directory no longer
      // exists on disk, so match the registered path without touching the
      // filesystem.
      const target = resolve(requestedPath);
      const candidates = [requestedPath, target];
      try {
        candidates.push(await realpath(target));
      } catch {
        // Directory may have been deleted; registration removal must still
        // work with the recorded path.
      }
      const canonicalPath = current.directories.find((entry) =>
        candidates.includes(entry)
      );
      if (!canonicalPath) {
        throw new Error("该目录不在管理列表中。");
      }
      if (canonicalPath === current.path) {
        throw new Error(
          "该目录是当前使用中的工作目录，请先切换到其他目录再移除。"
        );
      }
      const directories = current.directories.filter(
        (entry) => entry !== canonicalPath
      );
      const disk: DiskWorkspaceDirectorySettings = {
        version: 3,
        path: current.path,
        previousPath:
          current.previousPath === canonicalPath ? null : current.previousPath,
        migrationSourcePath:
          current.migrationSourcePath === canonicalPath
            ? null
            : current.migrationSourcePath,
        directories
      };
      await this.writeSettings(disk);
      return WorkspaceDirectorySettingsSchema.parse(disk);
    });
  }

  /** Switches the current workspace directory to one from the list. */
  async switch(rawPath: string): Promise<WorkspaceDirectorySettings> {
    const requestedPath = rawPath.trim();
    if (!requestedPath) {
      throw new Error("目标目录不能为空。");
    }
    return this.enqueue(async () => {
      const current = await this.readSettings();
      const canonicalPath = await validateRealDirectory(resolve(requestedPath));
      if (canonicalPath === current.path) {
        return current;
      }
      if (!current.directories.includes(canonicalPath)) {
        throw new Error("该目录不在工作目录管理列表中，请先添加。");
      }
      return this.writeWithDirectories(
        current,
        canonicalPath,
        current.path,
        null
      );
    });
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
      return this.writeWithDirectories(
        previous,
        canonicalPath,
        previous.path,
        null
      );
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
      return this.writeWithDirectories(
        current,
        await realpath(previous),
        null,
        current.path
      );
    });
  }

  async migrate(): Promise<WorkspaceDirectorySettings> {
    return this.enqueue(async () => {
      const current = await this.readSettings();
      if (!current.path || !current.migrationSourcePath) {
        throw new Error("没有可迁移的恢复前目录。");
      }
      await copyWorkspaceData(current.migrationSourcePath, current.path);
      return this.writeWithDirectories(current, current.path, null, null);
    });
  }

  /**
   * Copies workspace data from one registered directory into an empty target
   * directory. The source directory and the current directory are never
   * modified by this operation; existing files are never overwritten and any
   * failure rolls back partially copied data so the target stays empty.
   */
  async migrateData(
    rawSourcePath: string,
    rawTargetPath: string
  ): Promise<WorkspaceDirectorySettings> {
    const sourcePath = rawSourcePath.trim();
    const targetPath = rawTargetPath.trim();
    if (!sourcePath || !targetPath) {
      throw new Error("迁移来源目录与目标目录都不能为空。");
    }
    return this.enqueue(async () => {
      const current = await this.readSettings();
      const source = await validateRealDirectory(resolve(sourcePath));
      const target = await validateRealDirectory(resolve(targetPath));
      if (!current.directories.includes(source)) {
        throw new Error("迁移来源目录必须已在工作目录管理列表中。");
      }
      if (!current.directories.includes(target)) {
        throw new Error("迁移目标目录必须已在工作目录管理列表中。");
      }
      if (source === target) {
        throw new Error("迁移来源目录与目标目录不能相同。");
      }
      if (pathsOverlap(source, target) || pathsOverlap(target, source)) {
        throw new Error("迁移来源目录与目标目录不能相同或相互包含。");
      }
      const entries = await readdir(target);
      if (entries.length > 0) {
        throw new Error("目标目录必须为空目录，已有数据不会被覆盖。");
      }
      await copyWorkspaceData(source, target);
      return this.readSettings();
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
