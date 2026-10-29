import type { AgentConversationContext } from "./context";
import { cloneMessage } from "./clone";
import { finalizeUnfinishedMessageTools } from "./attempt-state";
import { finalizeRunningSubagents } from "./run-lifecycle";
import { id } from "./shared";

type SessionLifecycleContext = Pick<
  AgentConversationContext,
  | "pendingAttemptId"
  | "activeRunId"
  | "newConversation"
  | "epoch"
  | "submitting"
  | "runtime"
  | "conversationError"
  | "finishedRunIds"
  | "runMessageIds"
  | "seenTurnIds"
  | "seenSubagentTurnIds"
  | "observedRunByAttempt"
  | "approvalModeByAttempt"
  | "approvalModeByRun"
  | "messages"
  | "messageMutations"
  | "runPersistenceBatch"
  | "stopStreamingMessages"
  | "storeCurrentConversation"
  | "resetTransientConversationState"
  | "nextConversationTimestamp"
  | "sessionId"
  | "draft"
  | "currentCreatedAt"
  | "currentUpdatedAt"
  | "isBusy"
  | "storedConversations"
  | "historyOperationPending"
>;
export function resetTransientConversationState(
  ctx: SessionLifecycleContext
): void {
  ctx.epoch += 1;
  ctx.submitting.value = false;
  ctx.pendingAttemptId.value = null;
  ctx.activeRunId.value = null;
  ctx.runtime.value = null;
  ctx.conversationError.value = null;
  ctx.finishedRunIds.clear();
  ctx.runMessageIds.clear();
  ctx.seenTurnIds.clear();
  ctx.seenSubagentTurnIds.clear();
  ctx.observedRunByAttempt.clear();
  ctx.approvalModeByAttempt.clear();
  ctx.approvalModeByRun.clear();
}
export function stopStreamingMessages(ctx: SessionLifecycleContext): void {
  const completedAt = new Date().toISOString();
  for (const message of ctx.messages.value) {
    if (message.status !== "streaming") continue;
    message.status = "stopped";
    if (message.retry) delete message.retry;
    finalizeRunningSubagents(
      message,
      "stopped",
      completedAt,
      "会话已切换或关闭，子任务同步停止。"
    );
    finalizeUnfinishedMessageTools(
      message,
      completedAt,
      "会话已切换或关闭，工具调用未返回完整终态。"
    );
    for (const run of message.subagentRuns ?? []) {
      if (run.retry) delete run.retry;
    }
    if (message.processingStartedAt && !message.processingCompletedAt) {
      message.processingCompletedAt = completedAt;
    }
  }
}
export function newConversation(ctx: SessionLifecycleContext): void {
  if (ctx.historyOperationPending.value) return;
  ctx.runPersistenceBatch(() => {
    ctx.stopStreamingMessages();
    ctx.storeCurrentConversation();
    ctx.resetTransientConversationState();
    const timestamp = ctx.nextConversationTimestamp();
    ctx.sessionId.value = id("session");
    ctx.messages.value = [];
    ctx.draft.value = "";
    ctx.currentCreatedAt.value = timestamp;
    ctx.currentUpdatedAt.value = timestamp;
  });
}
export function selectConversation(
  ctx: SessionLifecycleContext,
  nextSessionId: string
): boolean {
  if (nextSessionId === ctx.sessionId.value) return true;
  if (ctx.isBusy.value) return false;
  // A selectable conversation should already be idle. Normalize any stale
  // presentation state before persisting so a detached streaming card cannot
  // be restored without an owning run.
  let selected = false;
  ctx.runPersistenceBatch(() => {
    ctx.stopStreamingMessages();
    ctx.storeCurrentConversation();
    const selectedConversation = ctx.storedConversations.value.find(
      (conversation) => conversation.sessionId === nextSessionId
    );
    if (!selectedConversation) return;
    ctx.resetTransientConversationState();
    ctx.sessionId.value = selectedConversation.sessionId;
    ctx.messageMutations.replaceLoaded(
      selectedConversation.messages.map(cloneMessage)
    );
    ctx.draft.value = selectedConversation.draft;
    ctx.currentCreatedAt.value = selectedConversation.createdAt;
    ctx.currentUpdatedAt.value = selectedConversation.updatedAt;
    selected = true;
  });
  return selected;
}
