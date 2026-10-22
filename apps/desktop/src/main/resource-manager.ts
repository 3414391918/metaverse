import { lstat, mkdir, readdir, realpath, rename } from "node:fs/promises";
import { basename, dirname, isAbsolute, join } from "node:path";
import {
  ResourceManagerRequestSchema,
  type ResourceEntry,
  type ResourceManagerRequest,
  type ResourceManagerResult
} from "@deepwrite/contracts";
import type { WorkspaceDirectoryStore } from "./workspace-directory-store";
import {
  availableDestination,
  containsPath,
  copyResource,
  inspectResourceTree,
  minimalPaths,
  parentResource,
  relativeResource,
  requireDirectory,
  resourcePath,
  resourceRoot,
  validateResourceName
} from "./resource-manager-files";

export interface ResourceManagerPorts {
  openPath(path: string): Promise<string>;
  reveal(path: string): void;
  trash(path: string): Promise<void>;
  copyText(text: string): void;
  chooseFiles(): Promise<string[]>;
}
export class ResourceManager {
  private clipboard: {
    root: string;
    paths: string[];
    mode: "copy" | "cut";
  } | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(
    private readonly workspace: WorkspaceDirectoryStore,
    private readonly ports: ResourceManagerPorts
  ) {}

  async execute(raw: ResourceManagerRequest): Promise<ResourceManagerResult> {
    const input = ResourceManagerRequestSchema.parse(raw);
    const operation = this.queue.then(() => this.run(input));
    this.queue = operation.catch(() => undefined);
    return operation;
  }

  private async listing(
    root: string,
    directory: string,
    query = "",
    message?: string
  ): Promise<ResourceManagerResult> {
    const current = await requireDirectory(root, directory);
    const entries: ResourceEntry[] = [];
    let scanned = 0,
      truncated = false;
    const needle = query.toLowerCase();
    const walk = async (folder: string): Promise<void> => {
      for (const item of await readdir(folder, { withFileTypes: true })) {
        if (++scanned > 50000 || entries.length >= 5000) {
          truncated = true;
          return;
        }
        if (item.isSymbolicLink() || (!item.isFile() && !item.isDirectory()))
          continue;
        const path = join(folder, item.name);
        const safe = await resourcePath(root, relativeResource(root, path));
        const info = await lstat(safe);
        if (!query || item.name.toLowerCase().includes(needle))
          entries.push({
            name: item.name,
            path: relativeResource(root, safe),
            kind: info.isDirectory() ? "directory" : "file",
            size: info.isFile() ? info.size : 0,
            modifiedAt: info.mtime.toISOString()
          });
        if (query && info.isDirectory()) await walk(safe);
        if (truncated) return;
      }
    };
    await walk(current);
    entries.sort(
      (a, b) =>
        Number(b.kind === "directory") - Number(a.kind === "directory") ||
        a.name.localeCompare(b.name, "zh-CN", { numeric: true })
    );
    return {
      root,
      directory,
      entries,
      canPaste: !!this.clipboard?.paths.length,
      clipboardMode: this.clipboard?.mode ?? null,
      truncated,
      ...(message ? { message } : {})
    };
  }

  private async run(
    input: ResourceManagerRequest
  ): Promise<ResourceManagerResult> {
    const workspace = (await this.workspace.list()).path;
    if (!workspace) throw new Error("请先选择工作目录。");
    const root = await resourceRoot(workspace);
    if (this.clipboard?.root !== root) this.clipboard = null;
    let directory =
      "directory" in input
        ? input.directory
        : "path" in input
          ? parentResource(input.path)
          : "";
    let message: string | undefined;
    switch (input.action) {
      case "list":
        return this.listing(root, input.directory, input.query);
      case "createFolder": {
        const parent = await requireDirectory(root, directory);
        const name = validateResourceName(input.name);
        if (
          (await readdir(parent)).some(
            (item) =>
              item.normalize("NFC").toLowerCase() ===
              name.normalize("NFC").toLowerCase()
          )
        )
          throw new Error("同名文件或文件夹已存在。");
        await mkdir(join(parent, name));
        break;
      }
      case "rename": {
        const path = await resourcePath(root, input.path);
        const name = validateResourceName(input.name);
        if (
          basename(path) !== name &&
          (await readdir(dirname(path))).some(
            (item) =>
              item !== basename(path) &&
              item.normalize("NFC").toLowerCase() ===
                name.normalize("NFC").toLowerCase()
          )
        )
          throw new Error("同名文件或文件夹已存在。");
        await rename(path, join(dirname(path), name));
        this.clipboard = null;
        break;
      }
      case "open": {
        const path = await resourcePath(root, input.path);
        const error = await this.ports.openPath(path);
        if (error) throw new Error(error);
        break;
      }
      case "reveal":
        this.ports.reveal(await resourcePath(root, input.path));
        break;
      case "copyPath": {
        const paths = await Promise.all(
          input.paths.map((path) => resourcePath(root, path))
        );
        this.ports.copyText(paths.join("\n"));
        directory = parentResource(input.paths[0]!);
        message = "已复制绝对路径";
        break;
      }
      case "clipboard": {
        const paths = minimalPaths(input.paths);
        await Promise.all(paths.map((path) => resourcePath(root, path)));
        this.clipboard = { root, paths, mode: input.mode };
        directory = parentResource(paths[0]!);
        message = `已${input.mode === "cut" ? "剪切" : "复制"} ${paths.length} 项，可在目标文件夹粘贴`;
        break;
      }
      case "paste": {
        if (!this.clipboard?.paths.length)
          throw new Error("请先复制或剪切资源。");
        const parent = await requireDirectory(root, directory);
        const sources = await Promise.all(
          this.clipboard.paths.map((path) => resourcePath(root, path))
        );
        for (const source of sources) {
          if (containsPath(source, parent))
            throw new Error("不能将文件夹粘贴到自身或子文件夹中。");
          await inspectResourceTree(source);
        }
        for (const source of sources) {
          if (this.clipboard.mode === "cut" && dirname(source) === parent)
            continue;
          const destination = await availableDestination(
            parent,
            source,
            (await lstat(source)).isDirectory()
          );
          if (this.clipboard.mode === "cut") await rename(source, destination);
          else await copyResource(source, destination);
          if (this.clipboard.mode === "cut")
            this.clipboard.paths = this.clipboard.paths.filter(
              (path) => path !== relativeResource(root, source)
            );
        }
        if (this.clipboard.mode === "cut") this.clipboard = null;
        message = "粘贴完成";
        break;
      }
      case "import": {
        const parent = await requireDirectory(root, directory);
        const requestedSources = input.sourcePaths.length
          ? input.sourcePaths
          : await this.ports.chooseFiles();
        const sources: string[] = [];
        for (const source of requestedSources) {
          if (!isAbsolute(source)) throw new Error("导入文件需要绝对路径。");
          const info = await lstat(source);
          if (info.isSymbolicLink()) throw new Error("不支持导入符号链接。");
          const canonical = await realpath(source);
          if (containsPath(canonical, root) || containsPath(canonical, parent))
            throw new Error("不能导入资源目录或其父目录。");
          await inspectResourceTree(canonical);
          sources.push(canonical);
        }
        for (const source of sources) {
          const destination = await availableDestination(
            parent,
            source,
            (await lstat(source)).isDirectory()
          );
          await copyResource(source, destination);
        }
        if (sources.length) message = `已导入 ${sources.length} 项`;
        break;
      }
      case "trash": {
        const paths = minimalPaths(input.paths);
        const sources = await Promise.all(
          paths.map((path) => resourcePath(root, path))
        );
        for (const source of sources) await this.ports.trash(source);
        directory = parentResource(paths[0]!);
        this.clipboard = null;
        message = "已移到系统废纸篓／回收站";
        break;
      }
    }
    return this.listing(root, directory, "", message);
  }
}
