import type { AgentTool } from "@earendil-works/pi-agent-core";
import {
  getDefaultLongAgentProfile,
  type ChatAssistantRuntimeContext,
  type LongBookSummary
} from "@deepwrite/contracts";
import {
  buildLongWorkspaceTools,
  type LongCommandExecutor
} from "./long-agent-tools";
import { buildNormalTools } from "./chat-assistant-normal-tools";
import { buildShortProjectTools } from "./chat-assistant-project-tools";
const LONG_QUERY_TOOL_NAMES = new Set(["list", "read"]);

function buildLongProjectTools(input: {
  runId: string;
  sessionId: string;
  book: LongBookSummary;
  executor?: LongCommandExecutor;
}): AgentTool[] {
  const profile = getDefaultLongAgentProfile("long");
  const workspace = {
    bookId: input.book.id,
    title: input.book.title,
    activeRoot: "plot_design" as const,
    activeAgentId: "long" as const,
    navigation: input.book.navigation
  };
  const tools = buildLongWorkspaceTools({
    workspace,
    profile,
    sessionId: input.sessionId,
    runId: input.runId,
    ...(input.executor ? { executor: input.executor } : {})
  }).filter((tool) => LONG_QUERY_TOOL_NAMES.has(tool.name));
  return tools;
}

export function buildChatAssistantTools(input: {
  runId: string;
  sessionId: string;
  context: ChatAssistantRuntimeContext;
  longCommandExecutor?: LongCommandExecutor;
}): AgentTool[] {
  if (input.context.mode === "roleplay") return [];
  const tools = buildNormalTools(input.context);
  if (input.context.mode !== "project") return tools;
  if (input.context.projectBook.bookType === "long") {
    return [
      ...tools,
      ...buildLongProjectTools({
        runId: input.runId,
        sessionId: input.sessionId,
        book: input.context.projectBook,
        ...(input.longCommandExecutor
          ? { executor: input.longCommandExecutor }
          : {})
      })
    ];
  }
  return [...tools, ...buildShortProjectTools(input.context.projectBook)];
}
