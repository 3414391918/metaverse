import { randomUUID } from "node:crypto";
import { cp, lstat, mkdir, readdir, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import {
  ToolCreateSchema,
  ToolFilePathSchema,
  ToolFileSaveSchema,
  ToolFileTargetSchema,
  ToolIdSchema,
  ToolManifestSchema,
  type ToolCreate,
  type ToolFileSave,
  type ToolFileTarget,
  type ToolLibrarySnapshot,
  type ToolSummary
} from "@deepwrite/contracts";
import {
  listToolFiles,
  missing,
  readToolText,
  sha256,
  toolFilePath,
  writeToolText
} from "./tool-library-files";
import type { WorkspaceDirectoryStore } from "./workspace-directory-store";
import type { ToolGuidanceFile } from "./tool-library-guidance";

export class ToolLibraryStore {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(
    private readonly workspace: WorkspaceDirectoryStore,
    private readonly defaultsDirectory: string,
    private readonly guidance?: () => Promise<ToolGuidanceFile[]>
  ) {}

  private mutate<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation);
    this.queue = result.catch(() => undefined);
    return result;
  }

  private async root(): Promise<string> {
    const { path } = await this.workspace.list();
    if (!path) throw new Error("请先选择工作目录。");
    const info = await lstat(path);
    if (!info.isDirectory() || info.isSymbolicLink())
      throw new Error("工作目录不可用。");
    const root = join(path, "tools");
    await mkdir(root, { recursive: true });
    const rootInfo = await lstat(root);
    if (rootInfo.isSymbolicLink() || !rootInfo.isDirectory())
      throw new Error("工具目录不能是符号链接。");
    const marker = join(root, ".initialized-v1.json");
    let initialized = true;
    try {
      await lstat(marker);
    } catch (error) {
      if (!missing(error)) throw error;
      initialized = false;
    }
    if (!initialized) {
      const defaults = await readdir(this.defaultsDirectory, {
        withFileTypes: true
      });
      const guidance = (await this.guidance?.()) ?? [];
      for (const item of defaults) {
        if (!item.isDirectory() || !ToolIdSchema.safeParse(item.name).success)
          continue;
        const target = join(root, item.name);
        try {
          await lstat(target);
          continue;
        } catch (error) {
          if (!missing(error)) throw error;
        }
        const temporary = join(root, `.install-${randomUUID()}`);
        try {
          await cp(join(this.defaultsDirectory, item.name), temporary, {
            recursive: true
          });
          for (const file of guidance) {
            if (file.toolId !== item.name) continue;
            await writeToolText(
              join(temporary, ToolFilePathSchema.parse(file.path)),
              file.content
            );
          }
          await rename(temporary, target);
        } finally {
          await rm(temporary, { recursive: true, force: true });
        }
      }
      await writeToolText(marker, JSON.stringify({ version: 1 }) + "\n");
    }
    await this.installAddedVoiceDesign(root);
    return root;
  }

  private async installAddedVoiceDesign(root: string): Promise<void> {
    const marker = join(root, ".voice-design-installed-v1.json");
    try {
      await lstat(marker);
      return;
    } catch (error) {
      if (!missing(error)) throw error;
    }
    const source = join(this.defaultsDirectory, "voice-design");
    try {
      if (!(await lstat(source)).isDirectory()) return;
    } catch (error) {
      if (missing(error)) return;
      throw error;
    }
    const target = join(root, "voice-design");
    try {
      await lstat(target);
    } catch (error) {
      if (!missing(error)) throw error;
      const temporary = join(root, `.install-${randomUUID()}`);
      try {
        await cp(source, temporary, { recursive: true });
        await rename(temporary, target);
      } finally {
        await rm(temporary, { recursive: true, force: true });
      }
    }
    await writeToolText(marker, JSON.stringify({ version: 1 }) + "\n");
  }

  private async snapshot(root: string): Promise<ToolLibrarySnapshot> {
    const tools: ToolSummary[] = [];
    for (const directory of await readdir(root, { withFileTypes: true })) {
      if (
        !ToolIdSchema.safeParse(directory.name).success ||
        !directory.isDirectory() ||
        directory.isSymbolicLink()
      )
        continue;
      const id = directory.name;
      let tool: ToolSummary = {
        version: 1,
        id,
        name: id,
        description: "",
        entryFile: "tool.json",
        relatedToolIds: [],
        directory: join(root, id),
        files: []
      };
      try {
        const manifest = ToolManifestSchema.parse(
          JSON.parse(
            await readToolText(await toolFilePath(root, id, "tool.json"))
          )
        );
        if (manifest.id !== id)
          throw new Error("tool.json 中的 id 必须与目录名称一致。");
        tool = { ...tool, ...manifest };
        tool.files = await listToolFiles(tool.directory);
        if (!tool.files.some(({ path }) => path === tool.entryFile))
          throw new Error("工具入口文件不存在。");
      } catch (error) {
        tool.error =
          error instanceof Error ? error.message : "工具文件无法读取。";
        tool.files = await listToolFiles(tool.directory).catch(() => []);
      }
      tools.push(tool);
    }
    return {
      directory: root,
      tools: tools.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"))
    };
  }

  list(): Promise<ToolLibrarySnapshot> {
    return this.mutate(async () => this.snapshot(await this.root()));
  }

  read(raw: ToolFileTarget) {
    const input = ToolFileTargetSchema.parse(raw);
    return this.mutate(async () => {
      const content = await readToolText(
        await toolFilePath(await this.root(), input.toolId, input.path)
      );
      return { ...input, content, sha256: sha256(content) };
    });
  }

  save(raw: ToolFileSave) {
    const input = ToolFileSaveSchema.parse(raw);
    return this.mutate(async () => {
      const root = await this.root();
      const directory = await toolFilePath(root, input.toolId);
      if (!(await lstat(directory)).isDirectory())
        throw new Error("工具不存在。");
      const path = await toolFilePath(root, input.toolId, input.path);
      let current: string | null = null;
      try {
        current = sha256(await readToolText(path));
      } catch (error) {
        if (!missing(error)) throw error;
      }
      if (current !== input.expectedSha256)
        throw new Error("文件已被外部修改，请先重新读取，避免覆盖最新内容。");
      if (input.path === "tool.json") {
        const manifest = ToolManifestSchema.parse(JSON.parse(input.content));
        if (manifest.id !== input.toolId)
          throw new Error("工具 id 必须与目录名称一致。");
      }
      await writeToolText(path, input.content);
      return {
        toolId: input.toolId,
        path: input.path,
        content: input.content,
        sha256: sha256(input.content)
      };
    });
  }

  create(raw: ToolCreate): Promise<ToolLibrarySnapshot> {
    const input = ToolCreateSchema.parse(raw);
    return this.mutate(async () => {
      const root = await this.root();
      const id = `tool_${randomUUID().slice(0, 8)}`;
      const directory = await toolFilePath(root, id);
      await mkdir(directory);
      const manifest = ToolManifestSchema.parse({
        version: 1,
        id,
        ...input,
        entryFile: "SKILL.md",
        relatedToolIds: []
      });
      await writeToolText(
        join(directory, "SKILL.md"),
        `# ${input.name}\n\n${input.description}\n`
      );
      await writeToolText(
        join(directory, "tool.json"),
        JSON.stringify(manifest, null, 2) + "\n"
      );
      return this.snapshot(root);
    });
  }

  delete(rawId: string): Promise<ToolLibrarySnapshot> {
    const id = ToolIdSchema.parse(rawId);
    return this.mutate(async () => {
      const root = await this.root();
      const snapshot = await this.snapshot(root);
      const incoming = snapshot.tools.filter((tool) =>
        tool.relatedToolIds.includes(id)
      );
      if (incoming.length)
        throw new Error(
          `请先解除这些工具的关联：${incoming.map(({ name }) => name).join("、")}。`
        );
      await rm(await toolFilePath(root, id), { recursive: true, force: true });
      return this.snapshot(root);
    });
  }
}
