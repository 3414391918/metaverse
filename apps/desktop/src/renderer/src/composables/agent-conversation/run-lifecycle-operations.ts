import type { ChatMessage } from "../../types/conversation";

export interface RunLifecycleOperations {
  finalizeRunningSubagents(
    message: ChatMessage,
    status: "error" | "stopped",
    completedAt: string,
    reason: string
  ): void;
}
