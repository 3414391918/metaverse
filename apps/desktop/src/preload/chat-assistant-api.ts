import {
  ChatAssistantRoleplayConfigSchema,
  ChatAssistantRoleplayListSchema,
  ChatAssistantProjectConfigListSchema,
  ChatAssistantProjectConfigSchema,
  ChatAssistantProjectRefSchema,
  createEnvelope,
  type ChatAssistantProjectConfig,
  type ChatAssistantProjectRef,
  type DeepWriteApi
} from "@deepwrite/contracts";
import { browserId, invokeCommand } from "./invoke";
export async function getChatAssistantProjectConfig(
  rawProject: ChatAssistantProjectRef
): Promise<ChatAssistantProjectConfig> {
  const project = ChatAssistantProjectRefSchema.parse(rawProject);
  const id = browserId("cmd_chat_assistant_project_config_get");
  return ChatAssistantProjectConfigSchema.parse(
    await invokeCommand<ChatAssistantProjectConfig>(
      createEnvelope("chatAssistantProjectConfig.get", project, {
        id,
        correlationId: id
      })
    )
  );
}

export async function listChatAssistantProjectConfigs(): Promise<
  ChatAssistantProjectRef[]
> {
  const id = browserId("cmd_chat_assistant_project_config_list");
  return ChatAssistantProjectConfigListSchema.parse(
    await invokeCommand<ChatAssistantProjectRef[]>(
      createEnvelope(
        "chatAssistantProjectConfig.list",
        {},
        {
          id,
          correlationId: id
        }
      )
    )
  );
}

export async function saveChatAssistantProjectConfig(
  rawProject: ChatAssistantProjectRef,
  rawSystemPrompt: string
): Promise<ChatAssistantProjectConfig> {
  const project = ChatAssistantProjectRefSchema.parse(rawProject);
  const systemPrompt = String(rawSystemPrompt);
  const id = browserId("cmd_chat_assistant_project_config_save");
  return ChatAssistantProjectConfigSchema.parse(
    await invokeCommand<ChatAssistantProjectConfig>(
      createEnvelope(
        "chatAssistantProjectConfig.save",
        { project, systemPrompt },
        { id, correlationId: id }
      )
    )
  );
}

export async function resetChatAssistantProjectConfig(
  rawProject: ChatAssistantProjectRef
): Promise<ChatAssistantProjectConfig> {
  const project = ChatAssistantProjectRefSchema.parse(rawProject);
  const id = browserId("cmd_chat_assistant_project_config_reset");
  return ChatAssistantProjectConfigSchema.parse(
    await invokeCommand<ChatAssistantProjectConfig>(
      createEnvelope("chatAssistantProjectConfig.reset", project, {
        id,
        correlationId: id
      })
    )
  );
}

export const chatAssistantProjectConfig: NonNullable<
  DeepWriteApi["chatAssistantProjectConfig"]
> = {
  list: listChatAssistantProjectConfigs,
  get: getChatAssistantProjectConfig,
  save: saveChatAssistantProjectConfig,
  reset: resetChatAssistantProjectConfig
};

export const chatAssistantRoleplay: NonNullable<
  DeepWriteApi["chatAssistantRoleplay"]
> = {
  async list() {
    const id = browserId("cmd_roleplay_list");
    return ChatAssistantRoleplayListSchema.parse(
      await invokeCommand(
        createEnvelope(
          "chatAssistantRoleplay.list",
          {},
          { id, correlationId: id }
        )
      )
    );
  },
  async save(raw) {
    const config = ChatAssistantRoleplayConfigSchema.parse(raw);
    const id = browserId("cmd_roleplay_save");
    return ChatAssistantRoleplayConfigSchema.parse(
      await invokeCommand(
        createEnvelope("chatAssistantRoleplay.save", config, {
          id,
          correlationId: id
        })
      )
    );
  }
};
