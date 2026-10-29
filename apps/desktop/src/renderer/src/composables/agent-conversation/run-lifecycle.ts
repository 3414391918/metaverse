import type { ChatMessage } from "../../types/conversation";

/**
 * Normalizes subagent runs that can no longer receive terminal events.
 * Retained so conversation switching/closing can finalize stale presentation
 * state restored from persisted history.
 */
export function finalizeRunningSubagents(
  message: ChatMessage,
  status: "error" | "stopped",
  completedAt: string,
  reason: string
): void {
  for (const run of message.subagentRuns ?? []) {
    if (run.status !== "running") continue;
    run.status = status;
    run.completedAt = completedAt;
    run.errorMessage = reason;
    for (const toolCall of run.toolCalls) {
      if (toolCall.status !== "preparing" && toolCall.status !== "running") {
        continue;
      }
      toolCall.status = "error";
      toolCall.completedAt = completedAt;
      toolCall.resultSummary ??= reason;
      toolCall.isError = true;
    }
  }
}
