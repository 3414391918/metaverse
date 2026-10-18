import type {
  SessionPromptCommandPayload,
  ModelUsageModule
} from "@deepwrite/contracts";
export function usageModuleForPrompt(
  payload: SessionPromptCommandPayload
): ModelUsageModule {
  if (payload.mode === "chat-assistant") return "assistant-chat";
  const context = payload.workspaceContext;
  if (!context) return "unknown";
  if (context.longWorkspace) return "long-writing";
  if (context.libraryWorkspace) {
    return context.libraryWorkspace.domain === "skill"
      ? "skill-library"
      : "material-library";
  }
  if (context.revisionAnalysis) return "revision-analysis";
  if (context.subagentAuthoring) return "subagent-authoring";
  return "unknown";
}
