import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import {
  ChatAssistantRoleplayConfigSchema,
  ChatAssistantRoleplayListSchema,
  type ChatAssistantRoleplayConfig
} from "@deepwrite/contracts";

export class ChatAssistantRoleplayStore {
  private readonly path: string;
  private writeChain: Promise<void> = Promise.resolve();
  constructor(userDataPath: string) {
    this.path = join(userDataPath, "config", "chat-assistant-roleplay.json");
  }
  private async read(): Promise<ChatAssistantRoleplayConfig[]> {
    try {
      return ChatAssistantRoleplayListSchema.parse(
        JSON.parse(await readFile(this.path, "utf8"))
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }
  async list(): Promise<ChatAssistantRoleplayConfig[]> {
    await this.writeChain;
    return this.read();
  }
  async get(id: string): Promise<ChatAssistantRoleplayConfig> {
    const config = (await this.list()).find((item) => item.id === id);
    if (!config) throw new Error("所选人物配置不存在，请重新选择人物。");
    return config;
  }
  async save(
    raw: ChatAssistantRoleplayConfig
  ): Promise<ChatAssistantRoleplayConfig> {
    const config = ChatAssistantRoleplayConfigSchema.parse(raw);
    const operation = this.writeChain.then(async () => {
      const configs = await this.read();
      const index = configs.findIndex((item) => item.id === config.id);
      if (index < 0) configs.push(config);
      else configs[index] = config;
      ChatAssistantRoleplayListSchema.parse(configs);
      await mkdir(dirname(this.path), { recursive: true });
      const temporary = `${this.path}.${randomUUID()}.tmp`;
      await writeFile(temporary, JSON.stringify(configs, null, 2), {
        encoding: "utf8",
        mode: 0o600
      });
      await rename(temporary, this.path);
    });
    this.writeChain = operation.catch(() => undefined);
    await operation;
    return config;
  }
}
