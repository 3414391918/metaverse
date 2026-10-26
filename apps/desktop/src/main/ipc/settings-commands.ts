import { stopAssistant } from "../assistant-service";
import {
  GeneralSettingsSnapshotSchema,
  LibraryAgentSettingsSchema,
  LongAgentSettingsSchema,
  WorkspaceDirectorySettingsSchema,
  type CommandEnvelope,
  type CommandResult
} from "@deepwrite/contracts";
import { handleAgentTeamCommands } from "./agent-team-commands";
import { handleAppearanceCommands } from "./appearance-commands";
import type { IpcCommandContext } from "./command-types";
import { safeErrorDetails } from "./errors";
import { handlePromptTemplateCommands } from "./prompt-template-commands";
export async function handleSettingsCommands(
  ctx: IpcCommandContext,
  command: CommandEnvelope
): Promise<CommandResult | undefined> {
  if (command.type === "workspaceDirectory.list") {
    try {
      return {
        status: "accepted",
        requestId: command.id,
        payload: WorkspaceDirectorySettingsSchema.parse(
          await ctx.requireWorkspaceDirectoryStore().list()
        )
      };
    } catch (error: unknown) {
      return {
        status: "rejected",
        requestId: command.id,
        error: {
          code: "workspace_directory.list_failed",
          message:
            error instanceof Error ? error.message : "加载工作目录失败。",
          details: safeErrorDetails(error)
        }
      };
    }
  }
  if (command.type === "workspaceDirectory.choose") {
    try {
      const previous = await ctx.requireWorkspaceDirectoryStore().list();
      const selected = await ctx.chooseWorkspaceDirectory();
      if (selected && selected.path !== previous.path) await stopAssistant();
      return {
        status: "accepted",
        requestId: command.id,
        payload: selected
      };
    } catch (error: unknown) {
      return {
        status: "rejected",
        requestId: command.id,
        error: {
          code: "workspace_directory.choose_failed",
          message:
            error instanceof Error ? error.message : "切换工作目录失败。",
          details: safeErrorDetails(error)
        }
      };
    }
  }
  if (
    command.type === "workspaceDirectory.restore" ||
    command.type === "workspaceDirectory.migrate"
  ) {
    try {
      const store = ctx.requireWorkspaceDirectoryStore();
      const current = await store.list();
      if (
        command.type === "workspaceDirectory.restore"
          ? current.previousPath
          : current.migrationSourcePath
      )
        await stopAssistant();
      return {
        status: "accepted",
        requestId: command.id,
        payload: WorkspaceDirectorySettingsSchema.parse(
          command.type === "workspaceDirectory.restore"
            ? await store.restore()
            : await store.migrate()
        )
      };
    } catch (error: unknown) {
      return {
        status: "rejected",
        requestId: command.id,
        error: {
          code: `workspace_directory.${command.type === "workspaceDirectory.restore" ? "restore" : "migrate"}_failed`,
          message:
            error instanceof Error ? error.message : "工作目录操作失败。",
          details: safeErrorDetails(error)
        }
      };
    }
  }
  const appearanceResult = await handleAppearanceCommands(ctx, command);
  if (appearanceResult) {
    return appearanceResult;
  }
  if (command.type === "generalSettings.list") {
    try {
      const snapshot = GeneralSettingsSnapshotSchema.parse(
        await ctx.requireGeneralSettingsStore().list()
      );
      ctx.syncGeneralSettings(snapshot.settings);
      return {
        status: "accepted",
        requestId: command.id,
        payload: snapshot
      };
    } catch (error: unknown) {
      return {
        status: "rejected",
        requestId: command.id,
        error: {
          code: "general_settings.list_failed",
          message:
            error instanceof Error ? error.message : "加载常规设置失败。",
          details: safeErrorDetails(error)
        }
      };
    }
  }
  if (command.type === "generalSettings.save") {
    try {
      const snapshot = GeneralSettingsSnapshotSchema.parse(
        await ctx.requireGeneralSettingsStore().save(command.payload)
      );
      ctx.syncGeneralSettings(snapshot.settings);
      return {
        status: "accepted",
        requestId: command.id,
        payload: snapshot
      };
    } catch (error: unknown) {
      return {
        status: "rejected",
        requestId: command.id,
        error: {
          code: "general_settings.save_failed",
          message:
            error instanceof Error ? error.message : "保存常规设置失败。",
          details: safeErrorDetails(error)
        }
      };
    }
  }
  const teamResult = await handleAgentTeamCommands(ctx, command);
  if (teamResult) return teamResult;
  if (command.type === "longAgents.list") {
    try {
      return {
        status: "accepted",
        requestId: command.id,
        payload: LongAgentSettingsSchema.parse(
          await ctx.requireLongAgentConfigStore().list()
        )
      };
    } catch (error: unknown) {
      return {
        status: "rejected",
        requestId: command.id,
        error: {
          code: "long_agents.list_failed",
          message:
            error instanceof Error ? error.message : "加载长篇智能体设置失败。",
          details: safeErrorDetails(error)
        }
      };
    }
  }
  const promptTemplateResult = await handlePromptTemplateCommands(ctx, command);
  if (promptTemplateResult) return promptTemplateResult;
  if (command.type === "longAgents.save") {
    try {
      return {
        status: "accepted",
        requestId: command.id,
        payload: LongAgentSettingsSchema.parse(
          await ctx.requireLongAgentConfigStore().save(command.payload)
        )
      };
    } catch (error: unknown) {
      return {
        status: "rejected",
        requestId: command.id,
        error: {
          code: "long_agents.save_failed",
          message:
            error instanceof Error ? error.message : "保存长篇智能体设置失败。",
          details: safeErrorDetails(error)
        }
      };
    }
  }
  if (command.type === "longAgents.reset") {
    try {
      return {
        status: "accepted",
        requestId: command.id,
        payload: LongAgentSettingsSchema.parse(
          await ctx.requireLongAgentConfigStore().reset(command.payload.agentId)
        )
      };
    } catch (error: unknown) {
      return {
        status: "rejected",
        requestId: command.id,
        error: {
          code: "long_agents.reset_failed",
          message:
            error instanceof Error
              ? error.message
              : "恢复长篇智能体默认设置失败。",
          details: safeErrorDetails(error)
        }
      };
    }
  }
  if (command.type === "libraryAgents.list") {
    try {
      return {
        status: "accepted",
        requestId: command.id,
        payload: LibraryAgentSettingsSchema.parse(
          await ctx.requireLibraryAgentConfigStore().list()
        )
      };
    } catch (error: unknown) {
      return {
        status: "rejected",
        requestId: command.id,
        error: {
          code: "library_agents.list_failed",
          message:
            error instanceof Error
              ? error.message
              : "加载资料库智能体设置失败。",
          details: safeErrorDetails(error)
        }
      };
    }
  }
  if (command.type === "libraryAgents.save") {
    try {
      return {
        status: "accepted",
        requestId: command.id,
        payload: LibraryAgentSettingsSchema.parse(
          await ctx.requireLibraryAgentConfigStore().save(command.payload)
        )
      };
    } catch (error: unknown) {
      return {
        status: "rejected",
        requestId: command.id,
        error: {
          code: "library_agents.save_failed",
          message:
            error instanceof Error
              ? error.message
              : "保存资料库智能体设置失败。",
          details: safeErrorDetails(error)
        }
      };
    }
  }
  if (command.type === "libraryAgents.reset") {
    try {
      return {
        status: "accepted",
        requestId: command.id,
        payload: LibraryAgentSettingsSchema.parse(
          await ctx
            .requireLibraryAgentConfigStore()
            .reset(command.payload.domain)
        )
      };
    } catch (error: unknown) {
      return {
        status: "rejected",
        requestId: command.id,
        error: {
          code: "library_agents.reset_failed",
          message:
            error instanceof Error
              ? error.message
              : "恢复资料库智能体默认设置失败。",
          details: safeErrorDetails(error)
        }
      };
    }
  }
  return undefined;
}
