import { z } from "zod";
import type { ChatAssistantRuntimeContext } from "../chat-assistant";
import {
  ChatAssistantRoleplayRuntimeContextSchema,
  type ChatAssistantRequestContext
} from "../chat-assistant-base";
/**
 * Main fully parses the authoritative snapshot before creating agent.prompt.
 * This internal transport guard deliberately validates only the discriminator
 * needed for cross-process matching, while preserving the already-validated
 * snapshot without making Renderer load the large catalog/usage schema graph.
 */
export const ChatAssistantRuntimeContextTransportSchema =
  z.custom<ChatAssistantRuntimeContext>((value) => {
    if (!value || typeof value !== "object") return false;
    const candidate = value as { mode?: unknown; project?: unknown };
    if (candidate.mode === "normal") return true;
    if (candidate.mode === "roleplay")
      return ChatAssistantRoleplayRuntimeContextSchema.safeParse(value).success;
    if (candidate.mode !== "project") return false;
    const project = candidate.project;
    return Boolean(
      project &&
      typeof project === "object" &&
      typeof (project as { projectId?: unknown }).projectId === "string" &&
      ["short", "script", "long"].includes(
        String((project as { projectType?: unknown }).projectType)
      )
    );
  });

export function validateChatAssistantRuntimeContext(
  value: {
    mode?: string | undefined;
    chatAssistant?: ChatAssistantRequestContext | undefined;
    chatAssistantRuntimeContext?: ChatAssistantRuntimeContext | undefined;
  },
  context: z.RefinementCtx
): void {
  if (value.mode === "chat-assistant") {
    const requestedMode = value.chatAssistant?.mode ?? "normal";
    if (!value.chatAssistantRuntimeContext) {
      context.addIssue({
        code: "custom",
        path: ["chatAssistantRuntimeContext"],
        message: "Chat assistant runs require an authoritative runtime context."
      });
    } else if (
      value.chatAssistant?.mode === "roleplay" &&
      value.chatAssistantRuntimeContext.mode === "roleplay" &&
      value.chatAssistant.roleId !== value.chatAssistantRuntimeContext.roleId
    ) {
      context.addIssue({
        code: "custom",
        path: ["chatAssistantRuntimeContext", "roleId"],
        message: "Roleplay character must match the requested character."
      });
    } else if (value.chatAssistantRuntimeContext.mode !== requestedMode) {
      context.addIssue({
        code: "custom",
        path: ["chatAssistantRuntimeContext", "mode"],
        message: "Chat assistant runtime mode must match the requested mode."
      });
    } else if (
      requestedMode === "project" &&
      value.chatAssistant?.mode === "project" &&
      value.chatAssistantRuntimeContext.mode === "project" &&
      (value.chatAssistant.project.projectId !==
        value.chatAssistantRuntimeContext.project.projectId ||
        value.chatAssistant.project.projectType !==
          value.chatAssistantRuntimeContext.project.projectType)
    ) {
      context.addIssue({
        code: "custom",
        path: ["chatAssistantRuntimeContext", "project"],
        message:
          "Chat assistant runtime project must match the requested project."
      });
    }
  } else if (value.chatAssistantRuntimeContext !== undefined) {
    context.addIssue({
      code: "custom",
      path: ["chatAssistantRuntimeContext"],
      message: "Chat assistant runtime context requires chat-assistant mode."
    });
  }
}
