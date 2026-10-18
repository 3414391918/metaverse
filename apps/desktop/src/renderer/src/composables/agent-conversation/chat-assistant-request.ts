import type { ChatAssistantRequestContext } from "@deepwrite/contracts";

export function normalizeChatAssistantRequestContext(
  context: ChatAssistantRequestContext | undefined
): ChatAssistantRequestContext | undefined {
  if (context?.mode === "roleplay")
    return { mode: "roleplay", roleId: context.roleId };
  if (context?.mode === "project") {
    return {
      mode: "project",
      project: {
        projectType: context.project.projectType,
        projectId: context.project.projectId
      },
      ...(context.webSearchEnabled === true ? { webSearchEnabled: true } : {})
    };
  }
  if (context?.mode === "normal") {
    return {
      mode: "normal",
      ...(context.webSearchEnabled === true ? { webSearchEnabled: true } : {})
    };
  }
  return undefined;
}
