import { createHash } from "node:crypto";
import {
  lstat,
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  PromptTemplateImageRequestSchema,
  PromptTemplateSaveSchema,
  PromptTemplatesSchema,
  type PromptTemplate,
  type PromptTemplateImageRequest,
  type PromptTemplateSave
} from "@deepwrite/contracts";
import type { WorkspaceDirectoryStore } from "./workspace-directory-store";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_IMAGE_BYTES = 25 * 1024 * 1024;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

async function readJson(path: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as unknown;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600
  });
  await rename(temporary, path);
}

function key(id: string): string {
  return createHash("sha256").update(id).digest("hex");
}

function pngBytes(dataUrl: string): Buffer {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match) throw new Error("模板图片必须是 PNG 图片。");
  const bytes = Buffer.from(match[1]!, "base64");
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES)
    throw new Error("单张模板图片不能超过 10 MB。");
  if (!bytes.subarray(0, 8).equals(PNG_SIGNATURE))
    throw new Error("模板图片内容无效。");
  return bytes;
}

function legacyTemplates(raw: unknown): PromptTemplate[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const settings = raw as Record<string, unknown>;
  if (settings.promptTemplates !== undefined)
    return PromptTemplatesSchema.parse(settings.promptTemplates);
  const agents = settings.agents;
  const first = Array.isArray(agents) ? agents[0] : undefined;
  const shortcuts =
    first && typeof first === "object" && "welcomeShortcuts" in first
      ? first.welcomeShortcuts
      : undefined;
  if (!Array.isArray(shortcuts)) return [];
  return PromptTemplatesSchema.parse(
    shortcuts.map((text, index) => ({
      id: `welcome-${index + 1}`,
      name: text,
      content: text
    }))
  );
}

export class PromptTemplateStore {
  private readonly legacyPath: string;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(
    userDataPath: string,
    private readonly workspaceDirectoryStore: WorkspaceDirectoryStore
  ) {
    this.legacyPath = join(
      userDataPath,
      "config",
      "long-workspace-agents.json"
    );
  }

  private async paths(): Promise<{ directory: string; json: string }> {
    const root = (await this.workspaceDirectoryStore.list()).path;
    if (!root) throw new Error("请先选择工作目录。");
    const info = await lstat(root);
    if (!info.isDirectory() || info.isSymbolicLink())
      throw new Error("工作目录不可用，请重新选择。");
    const directory = join(root, "prompt-templates");
    return { directory, json: join(directory, "templates.json") };
  }

  private async load(): Promise<{
    directory: string;
    json: string;
    templates: PromptTemplate[];
  }> {
    const paths = await this.paths();
    const current = await readJson(paths.json);
    const legacy = await readJson(this.legacyPath);
    if (current !== undefined) {
      const templates = PromptTemplatesSchema.parse(current);
      const older =
        legacy &&
        typeof legacy === "object" &&
        !Array.isArray(legacy) &&
        "promptTemplates" in legacy
          ? legacyTemplates(legacy)
          : [];
      const knownIds = new Set(templates.map(({ id }) => id));
      const missing = older.filter(({ id }) => !knownIds.has(id));
      if (missing.length) {
        templates.push(...missing);
        PromptTemplatesSchema.parse(templates);
        await writeJson(paths.json, templates);
      }
      await this.clearLegacyTemplates(legacy);
      return { ...paths, templates };
    }
    const templates = legacyTemplates(legacy);
    await writeJson(paths.json, templates);
    await this.clearLegacyTemplates(legacy);
    return { ...paths, templates };
  }

  private async clearLegacyTemplates(raw: unknown): Promise<void> {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return;
    const settings = raw as Record<string, unknown>;
    if (settings.promptTemplates === undefined) return;
    const { promptTemplates: _removed, ...rest } = settings;
    await writeJson(this.legacyPath, rest);
  }

  private imagePath(directory: string, templateId: string, imageId: string) {
    return join(directory, "images", key(templateId), `${imageId}.png`);
  }

  async list(): Promise<PromptTemplate[]> {
    await this.writeChain;
    return (await this.load()).templates;
  }

  async save(rawInput: PromptTemplateSave): Promise<PromptTemplate[]> {
    const input = PromptTemplateSaveSchema.parse(rawInput);
    let result: PromptTemplate[] = [];
    const operation = this.writeChain.then(async () => {
      const { directory, json, templates } = await this.load();
      const existing = templates.find(({ id }) => id === input.template.id);
      const previousIds = new Set(existing?.imageIds ?? []);
      const desiredIds = new Set(input.template.imageIds ?? []);
      const newIds = new Set(input.newImages.map(({ id }) => id));
      if (newIds.size !== input.newImages.length)
        throw new Error("新粘贴的模板图片不能重复。");
      for (const id of desiredIds) {
        if (!previousIds.has(id) && !newIds.has(id))
          throw new Error("模板图片不存在，请重新粘贴。");
      }
      for (const id of newIds) {
        if (!desiredIds.has(id) || previousIds.has(id))
          throw new Error("模板图片与保存内容不一致。");
      }
      const decoded = input.newImages.map(({ id, pngDataUrl }) => ({
        id,
        bytes: pngBytes(pngDataUrl)
      }));
      let totalBytes = decoded.reduce(
        (sum, item) => sum + item.bytes.length,
        0
      );
      for (const id of desiredIds) {
        if (previousIds.has(id))
          totalBytes += (
            await stat(this.imagePath(directory, input.template.id, id))
          ).size;
      }
      if (totalBytes > MAX_TOTAL_IMAGE_BYTES)
        throw new Error("一个模板的图片总大小不能超过 25 MB。");
      for (const { id, bytes } of decoded) {
        const path = this.imagePath(directory, input.template.id, id);
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, bytes, { mode: 0o600 });
      }
      const next = [...templates];
      const index = next.findIndex(({ id }) => id === input.template.id);
      if (index === -1) next.push(input.template);
      else next[index] = input.template;
      PromptTemplatesSchema.parse(next);
      await writeJson(json, next);
      for (const id of previousIds) {
        if (!desiredIds.has(id))
          await rm(this.imagePath(directory, input.template.id, id), {
            force: true
          });
      }
      result = next;
    });
    this.writeChain = operation.then(
      () => undefined,
      () => undefined
    );
    await operation;
    return result;
  }

  async delete(id: string): Promise<PromptTemplate[]> {
    let result: PromptTemplate[] = [];
    const operation = this.writeChain.then(async () => {
      const { directory, json, templates } = await this.load();
      const next = templates.filter((template) => template.id !== id);
      await writeJson(json, next);
      await rm(join(directory, "images", key(id)), {
        recursive: true,
        force: true
      });
      result = next;
    });
    this.writeChain = operation.then(
      () => undefined,
      () => undefined
    );
    await operation;
    return result;
  }

  async readImage(rawRequest: PromptTemplateImageRequest) {
    const request = PromptTemplateImageRequestSchema.parse(rawRequest);
    await this.writeChain;
    const { directory, templates } = await this.load();
    const template = templates.find(({ id }) => id === request.templateId);
    if (!template?.imageIds?.includes(request.imageId))
      throw new Error("模板图片不存在。");
    const bytes = await readFile(
      this.imagePath(directory, request.templateId, request.imageId)
    );
    return { pngDataUrl: `data:image/png;base64,${bytes.toString("base64")}` };
  }
}
