import type {
  AgentSubagentRun,
  AgentToolTrace,
  ChatMessage
} from "../types/conversation";

export type ProcessingItem =
  | { id: string; type: "thinking"; content: string; createdAt: string }
  | { id: string; type: "response"; content: string; createdAt: string }
  | { id: string; type: "tool"; tool: AgentToolTrace; createdAt: string }
  | { id: string; type: "subagent"; run: AgentSubagentRun; createdAt: string };

function subagentItem(
  run: AgentSubagentRun,
  createdAt: string
): ProcessingItem {
  return {
    id: `subagent:${run.parentToolCallId}`,
    type: "subagent",
    run,
    createdAt
  };
}

export function processingItems(message: ChatMessage): ProcessingItem[] {
  const items: ProcessingItem[] = [];
  const runs = new Map(
    message.subagentRuns?.map((run) => [run.parentToolCallId, run])
  );
  const placedRuns = new Set<string>();
  const tools = new Map(message.toolCalls?.map((tool) => [tool.id, tool]));

  function appendTool(toolCallId: string, id: string, createdAt: string): void {
    const run = runs.get(toolCallId);
    if (run) {
      if (!placedRuns.has(toolCallId)) {
        items.push(subagentItem(run, createdAt));
        placedRuns.add(toolCallId);
      }
      return;
    }
    const tool = tools.get(toolCallId);
    if (tool) items.push({ id, type: "tool", tool, createdAt });
  }

  if (message.processingSteps?.length) {
    let lastResponseIndex = -1;
    for (
      let index = message.processingSteps.length - 1;
      index >= 0;
      index -= 1
    ) {
      if (message.processingSteps[index]?.type === "response") {
        lastResponseIndex = index;
        break;
      }
    }
    for (const [index, step] of message.processingSteps.entries()) {
      if (step.type === "tool") {
        appendTool(step.toolCallId, step.id, step.createdAt);
      } else if (
        step.type === "thinking" ||
        message.status === "streaming" ||
        index !== lastResponseIndex
      ) {
        // Only the final response leaves the timeline when the parent run ends.
        items.push({ ...step });
      }
    }
  } else {
    if (message.thinking) {
      items.push({
        id: `${message.id}_thinking`,
        type: "thinking",
        content: message.thinking,
        createdAt: message.createdAt
      });
    }
    for (const tool of message.toolCalls ?? []) {
      appendTool(tool.id, `${message.id}_${tool.id}`, tool.requestedAt);
    }
  }

  // Older or partial histories may have a child run without its parent step.
  // Preserve existing step order and insert these cards using their start time.
  for (const run of runs.values()) {
    if (placedRuns.has(run.parentToolCallId)) continue;
    const createdAt =
      tools.get(run.parentToolCallId)?.requestedAt ?? run.startedAt;
    const laterIndex = items.findIndex(
      (item) => item.createdAt.localeCompare(createdAt) > 0
    );
    items.splice(
      laterIndex < 0 ? items.length : laterIndex,
      0,
      subagentItem(run, createdAt)
    );
  }
  return items;
}
