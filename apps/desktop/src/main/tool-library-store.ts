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
    await this.mergeCreationTools(root);
    return root;
  }

  private async mergeCreationTools(root: string): Promise<void> {
    const marker = join(root, ".creation-merged-v1.json");
    try {
      await lstat(marker);
      return;
    } catch (error) {
      if (!missing(error)) throw error;
    }
    const oldIds = ["creation-context", "workspace"] as const;
    const existing: string[] = [];
    for (const id of oldIds) {
      try {
        const info = await lstat(join(root, id));
        if (!info.isDirectory() || info.isSymbolicLink())
          throw new Error(`旧工具目录不可用：${id}`);
        existing.push(id);
      } catch (error) {
        if (!missing(error)) throw error;
      }
    }
    if (!existing.length) {
      await writeToolText(marker, JSON.stringify({ version: 1 }) + "\n");
      return;
    }
    const creation = join(root, "creation");
    try {
      const info = await lstat(creation);
      if (!info.isDirectory() || info.isSymbolicLink())
        throw new Error("创作工具目录不可用。");
    } catch (error) {
      if (!missing(error)) throw error;
      await cp(join(this.defaultsDirectory, "creation"), creation, {
        recursive: true
      });
    }
    const archive = join(creation, "legacy");
    await mkdir(archive, { recursive: true });
    for (const [id, name] of [
      ["creation", "creation.md"],
      ["creation-context", "context.md"],
      ["workspace", "workspace.md"]
    ] as const) {
      try {
        await cp(join(root, id, "SKILL.md"), join(archive, name), {
          force: false,
          errorOnExist: true
        });
      } catch (error) {
        if (
          !missing(error) &&
          (error as NodeJS.ErrnoException).code !== "EEXIST"
        )
          throw error;
      }
    }
    for (const [id, name] of [
      ["workspace", "runtime"],
      ["creation-context", ".state"]
    ] as const) {
      try {
        await cp(
          join(root, id, name),
          join(creation, id === "workspace" ? "legacy/runtime" : ".state"),
          { recursive: true, force: true }
        );
      } catch (error) {
        if (!missing(error)) throw error;
      }
    }
    for (const name of [
      "libraries.json",
      "material-management.md",
      "skill-management.md"
    ]) {
      try {
        await cp(join(root, "creation-context", name), join(creation, name));
      } catch (error) {
        if (!missing(error)) throw error;
      }
    }
    for (const [id, name] of [
      ["workspace", "workspace-cli.mjs"],
      ["creation-context", "context-cli.mjs"]
    ] as const) {
      try {
        await cp(join(root, id, "cli.mjs"), join(archive, name));
      } catch (error) {
        if (!missing(error)) throw error;
      }
    }
    const source = join(this.defaultsDirectory, "creation");
    for (const name of [
      "SKILL.md",
      "workspace.md",
      "context.md",
      "cli.mjs",
      "context-cli.mjs",
      "tool.json"
    ])
      await cp(join(source, name), join(creation, name));
    await cp(join(source, "runtime"), join(creation, "runtime"), {
      recursive: true,
      force: true
    });
    for (const item of await readdir(root, { withFileTypes: true })) {
      if (!item.isDirectory() || item.isSymbolicLink()) continue;
      const manifestPath = join(root, item.name, "tool.json");
      let manifest: Record<string, unknown>;
      try {
        manifest = JSON.parse(await readToolText(manifestPath)) as Record<
          string,
          unknown
        >;
      } catch (error) {
        if (missing(error)) continue;
        throw error;
      }
      const related = manifest.relatedToolIds;
      if (
        !Array.isArray(related) ||
        !related.some(
          (id) => typeof id === "string" && oldIds.some((oldId) => oldId === id)
        )
      )
        continue;
      manifest.relatedToolIds = [
        ...new Set(
          related.map((id) =>
            typeof id === "string" && oldIds.some((oldId) => oldId === id)
              ? "creation"
              : id
          )
        )
      ].filter((id) => id !== item.name);
      await writeToolText(
        manifestPath,
        JSON.stringify(manifest, null, 2) + "\n"
      );
      if (item.name === "illustration" || item.name === "voice-design") {
        const skillPath = join(root, item.name, "SKILL.md");
        const original = await readToolText(skillPath);
        const updated = original
          .replaceAll("../workspace/SKILL.md", "../creation/workspace.md")
          .replaceAll("../creation-context/SKILL.md", "../creation/context.md")
          .replaceAll("创作空间工具", "创作工具的空间操作")
          .replaceAll("创作上下文工具", "创作工具的上下文操作")
          .replaceAll("`workspace`", "`creation`");
        if (updated !== original) await writeToolText(skillPath, updated);
      }
    }
    for (const id of existing)
      await rm(join(root, id), { recursive: true, force: true });
    await writeToolText(marker, JSON.stringify({ version: 1 }) + "\n");
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
