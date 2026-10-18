import {
  ChatAssistantProjectConfigListSchema,
  ChatAssistantProjectConfigSchema,
  ChatAssistantRoleplayListSchema,
  ChatAssistantRoleplayConfigSchema,
  type CommandEnvelope,
  type CommandResult
} from "@deepwrite/contracts";
import type { IpcCommandContext } from "./command-types";
import { safeErrorDetails } from "./errors";
export async function handleChatAssistantConfigCommands(
  ctx: Pick<IpcCommandContext, "requireChatAssistantProjectConfigStore">,
  command: CommandEnvelope
): Promise<CommandResult | undefined> {
  if (
    command.type === "chatAssistantRoleplay.list" ||
    command.type === "chatAssistantRoleplay.save"
  ) {
    try {
      const store = ctx.requireChatAssistantProjectConfigStore().roleplay;
      const payload =
        command.type === "chatAssistantRoleplay.list"
          ? ChatAssistantRoleplayListSchema.parse(await store.list())
          : ChatAssistantRoleplayConfigSchema.parse(
              await store.save(command.payload)
            );
      return { status: "accepted", requestId: command.id, payload };
    } catch (error) {
      return {
        status: "rejected",
        requestId: command.id,
        error: {
          code: "chat_assistant_roleplay.failed",
          message: error instanceof Error ? error.message : "处理人物配置失败。"
        }
      };
    }
  }
  if (
    command.type === "chatAssistantProjectConfig.list" ||
    command.type === "chatAssistantProjectConfig.get" ||
    command.type === "chatAssistantProjectConfig.save" ||
    command.type === "chatAssistantProjectConfig.reset"
  ) {
    try {
      const store = ctx.requireChatAssistantProjectConfigStore();
      const payload =
        command.type === "chatAssistantProjectConfig.list"
          ? await store.list()
          : command.type === "chatAssistantProjectConfig.get"
            ? await store.get(command.payload)
            : command.type === "chatAssistantProjectConfig.save"
              ? await store.save(
                  command.payload.project,
                  command.payload.systemPrompt
                )
              : await store.reset(command.payload);
      return {
        status: "accepted",
        requestId: command.id,
        payload:
          command.type === "chatAssistantProjectConfig.list"
            ? ChatAssistantProjectConfigListSchema.parse(payload)
            : ChatAssistantProjectConfigSchema.parse(payload)
      };
    } catch (error: unknown) {
      return {
        status: "rejected",
        requestId: command.id,
        error: {
          code: "chat_assistant_project_config.failed",
          message:
            error instanceof Error
              ? error.message
              : "处理聊天助手项目配置失败。",
          details: safeErrorDetails(error)
        }
      };
    }
  }
  return undefined;
}
