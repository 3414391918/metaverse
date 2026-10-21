import { handleChatAssistantConfigCommands } from "./chat-assistant-config-commands";
import { handleConversationExportCommands } from "./conversation-export-commands";
import {
  SystemHealthPayloadSchema,
  type CommandEnvelope,
  type CommandResult
} from "@deepwrite/contracts";
import { handleAgentTeamCommands } from "./agent-team-commands";
import { handleCatalogCommands } from "./catalog-commands";
import type { IpcCommandContext } from "./command-types";
import { isForbiddenRendererCommand } from "./forbidden-commands";
import { handleLongCommands } from "./long-commands";
import { handleCharacterAssetCommands } from "./character-asset-commands";
import { handleChapterImageCommands } from "./chapter-image-commands";
import { handleChapterVideoCommands } from "./chapter-video-commands";
import { handleFishAudioCommands } from "./fish-audio-commands";
import { handleManuscriptCommands } from "./manuscript-commands";
import { handleRendererStateCommands } from "./renderer-state-commands";
import { handleSettingsCommands } from "./settings-commands";
import { handleToolLibraryCommands } from "./tool-library-commands";

export async function dispatchCommand(
  ctx: IpcCommandContext,
  command: CommandEnvelope
): Promise<CommandResult> {
  if (isForbiddenRendererCommand(command.type)) {
    return {
      status: "rejected",
      requestId: command.id,
      error: {
        code: "ipc.forbidden_internal_command",
        message: "Renderer cannot invoke internal commands."
      }
    };
  }
  if (
    command.type.startsWith("models.") ||
    command.type.startsWith("modelUsage.") ||
    command.type.startsWith("session.")
  ) {
    return {
      status: "rejected",
      requestId: command.id,
      error: {
        code: "ipc.model_feature_removed",
        message: "应用内模型调用功能已移除。"
      }
    };
  }
  if (command.type === "system.health") {
    return {
      status: "accepted",
      requestId: command.id,
      payload: SystemHealthPayloadSchema.parse(
        await ctx.supervisor.collectHealth()
      )
    };
  }

  const result =
    ctx.rendererStateFlush.handleCommand(ctx.senderWebContentsId, command) ??
    (await handleToolLibraryCommands(ctx, command)) ??
    (await handleFishAudioCommands(ctx, command)) ??
    (await handleChapterImageCommands(ctx, command)) ??
    (await handleChapterVideoCommands(ctx, command)) ??
    (await handleCharacterAssetCommands(ctx, command)) ??
    (await handleAgentTeamCommands(ctx, command)) ??
    (await handleManuscriptCommands(ctx, command)) ??
    (await handleSettingsCommands(ctx, command)) ??
    (await handleChatAssistantConfigCommands(ctx, command)) ??
    (await handleLongCommands(ctx, command)) ??
    (await handleCatalogCommands(ctx, command)) ??
    (await handleRendererStateCommands(ctx, command)) ??
    (await handleConversationExportCommands(ctx, command));
  if (result) {
    return result;
  }
  throw new Error(
    `Unreachable command variant after schema validation: ${command.type}.`
  );
}
