import { ChatAssistantRoleplayStore } from "./chat-assistant-roleplay-store";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  ChatAssistantProjectConfigSchema,
  ChatAssistantProjectRefSchema,
  DEFAULT_CHAT_ASSISTANT_PROJECT_PROMPT,
  type ChatAssistantProjectConfig,
  type ChatAssistantProjectRef
} from "@deepwrite/contracts";

interface DiskChatAssistantProjectConfig {
  version: 1;
  projects: string[];
  prompts: Record<string, string>;
}

function projectKey(project: ChatAssistantProjectRef): string {
  return `${project.projectType}:${project.projectId}`;
}

function projectFromKey(key: string): ChatAssistantProjectRef | null {
  const separator = key.indexOf(":");
  if (separator <= 0) return null;
  const parsed = ChatAssistantProjectRefSchema.safeParse({
    projectType: key.slice(0, separator),
    projectId: key.slice(separator + 1)
  });
  return parsed.success ? parsed.data : null;
}

async function readJson(path: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as unknown;
  } catch (error: unknown) {
    if (
      (error as NodeJS.ErrnoException).code === "ENOENT" ||
      error instanceof SyntaxError
    ) {
      return undefined;
    }
    throw error;
  }
}

async function atomicWriteJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600
  });
  await rename(temporary, path);
}

function normalizeDisk(raw: unknown): DiskChatAssistantProjectConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { version: 1, projects: [], prompts: {} };
  }
  const candidate = raw as Record<string, unknown>;
  if (
    candidate.version !== 1 ||
    !candidate.prompts ||
    typeof candidate.prompts !== "object"
  ) {
    return { version: 1, projects: [], prompts: {} };
  }
  const prompts = Object.fromEntries(
    Object.entries(candidate.prompts as Record<string, unknown>).filter(
      ([key, value]) =>
        key.length > 0 &&
        typeof value === "string" &&
        value.trim().length > 0 &&
        value.length <= 60_000
    )
  ) as Record<string, string>;
  const projectKeys = Array.isArray(candidate.projects)
    ? candidate.projects.filter(
        (value): value is string =>
          typeof value === "string" && projectFromKey(value) !== null
      )
    : [];
  return {
    version: 1,
    projects: [...new Set([...projectKeys, ...Object.keys(prompts)])],
    prompts
  };
}

export class ChatAssistantProjectConfigStore {
  readonly roleplay: ChatAssistantRoleplayStore;
  private readonly path: string;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(userDataPath: string) {
    this.roleplay = new ChatAssistantRoleplayStore(userDataPath);
    this.path = join(userDataPath, "config", "chat-assistant-projects.json");
  }

  async list(): Promise<ChatAssistantProjectRef[]> {
    await this.writeChain;
    const disk = normalizeDisk(await readJson(this.path));
    return disk.projects.flatMap((key) => {
      const project = projectFromKey(key);
      return project ? [project] : [];
    });
  }

  async get(
    rawProject: ChatAssistantProjectRef
  ): Promise<ChatAssistantProjectConfig> {
    const project = ChatAssistantProjectRefSchema.parse(rawProject);
    await this.writeChain;
    const disk = normalizeDisk(await readJson(this.path));
    const saved = disk.prompts[projectKey(project)];
    return ChatAssistantProjectConfigSchema.parse({
      project,
      systemPrompt: saved ?? DEFAULT_CHAT_ASSISTANT_PROJECT_PROMPT,
      customized: saved !== undefined
    });
  }

  async save(
    rawProject: ChatAssistantProjectRef,
    rawSystemPrompt: string
  ): Promise<ChatAssistantProjectConfig> {
    const project = ChatAssistantProjectRefSchema.parse(rawProject);
    const systemPrompt =
      ChatAssistantProjectConfigSchema.shape.systemPrompt.parse(
        rawSystemPrompt
      );
    let result: ChatAssistantProjectConfig | undefined;
    const operation = this.writeChain.then(async () => {
      const disk = normalizeDisk(await readJson(this.path));
      const key = projectKey(project);
      disk.prompts[key] = systemPrompt;
      if (!disk.projects.includes(key)) disk.projects.push(key);
      await atomicWriteJson(this.path, disk);
      result = ChatAssistantProjectConfigSchema.parse({
        project,
        systemPrompt,
        customized: true
      });
    });
    this.track(operation);
    await operation;
    return result!;
  }

  async reset(
    rawProject: ChatAssistantProjectRef
  ): Promise<ChatAssistantProjectConfig> {
    const project = ChatAssistantProjectRefSchema.parse(rawProject);
    let result: ChatAssistantProjectConfig | undefined;
    const operation = this.writeChain.then(async () => {
      const disk = normalizeDisk(await readJson(this.path));
      delete disk.prompts[projectKey(project)];
      await atomicWriteJson(this.path, disk);
      result = ChatAssistantProjectConfigSchema.parse({
        project,
        systemPrompt: DEFAULT_CHAT_ASSISTANT_PROJECT_PROMPT,
        customized: false
      });
    });
    this.track(operation);
    await operation;
    return result!;
  }

  private track(operation: Promise<void>): void {
    this.writeChain = operation.catch(() => undefined);
  }
}
