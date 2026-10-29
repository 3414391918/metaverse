import { createPersistenceJournal } from "./agent-conversation/persistence-journal";
import { createHistoryLoader } from "./agent-conversation/history-loading";
import { createHistoryManagement } from "./agent-conversation/history-management";
import { computed } from "vue";
import {
  createAgentConversationState,
  type AgentConversationContext
} from "./agent-conversation/context";
import { bindConversationOperations } from "./agent-conversation/bind-operations";
import { createConversationHistory } from "./agent-conversation/conversation-history";
import { watchConversationPersistence } from "./agent-conversation/persistence-watch";
import type {
  AgentConversationController,
  UseAgentConversationOptions
} from "./agent-conversation/types";
export type {
  AgentConversationController,
  AgentConversationPersistenceRecord,
  AgentConversationPersistenceSnapshot,
  AgentConversationHistorySnapshot,
  AgentRunSettings,
  ConversationStorage,
  UseAgentConversationOptions
} from "./agent-conversation/types";
export {
  parseAgentConversationPersistenceSnapshot,
  mergeAgentConversationPersistenceSnapshots,
  mergeStoredConversationHistories
} from "./agent-conversation/persistence-snapshot";

/**
 * Read-only conversation controller: loads, displays and persists the
 * conversation history (including flush and history management), but no
 * longer starts or stops agent runs — execution lives in the external
 * assistant harness now.
 */
export function useAgentConversation(
  options: UseAgentConversationOptions
): AgentConversationController {
  const ctx = createAgentConversationState(options) as AgentConversationContext;
  bindConversationOperations(ctx);
  ctx.isBusy = computed(
    () =>
      ctx.pendingAttemptId.value !== null ||
      ctx.submitting.value ||
      ctx.historyOperationPending.value ||
      ctx.activeRunId.value !== null
  );
  ctx.hasPendingEditReview = computed(() =>
    ctx.messages.value.some((message) =>
      message.editProposals?.some(
        (proposal) =>
          proposal.status === "pending" || proposal.status === "accepting"
      )
    )
  );
  ctx.history = createConversationHistory({
    ...ctx,
    createdAt: ctx.currentCreatedAt,
    updatedAt: ctx.currentUpdatedAt
  });
  ctx.persistenceJournal = createPersistenceJournal(ctx);
  const historyLoader = createHistoryLoader(ctx);
  const historyManagement = createHistoryManagement(ctx, historyLoader);
  ctx.stopPersistenceWatch = watchConversationPersistence(
    ctx.messageMutations,
    [
      ctx.sessionId,
      ctx.draft,
      ctx.approvalMode,
      ctx.selectedModelId,
      ctx.thinkingLevel,
      ctx.temperature,
      ctx.webSearchEnabled
    ],
    (mutation) => {
      if (
        ctx.applyingPersistenceSnapshot ||
        !ctx.persistenceNotificationsEnabled
      )
        return;
      ctx.persistenceMutationRevision += 1;
      ctx.currentUpdatedAt.value = ctx.nextConversationTimestamp();
      ctx.persistenceJournal.record(mutation);
      if (ctx.persistenceBatchDepth > 0) {
        ctx.persistenceBatchChanged = true;
        return;
      }
      ctx.emitPersistenceSnapshot();
    }
  );
  return {
    messages: ctx.messages,
    draft: ctx.draft,
    sessionId: ctx.sessionId,
    approvalMode: ctx.approvalMode,
    agentTeamMode: ctx.agentTeamMode,
    thinkingLevel: ctx.thinkingLevel,
    temperature: ctx.temperature,
    webSearchEnabled: ctx.webSearchEnabled,
    configuredModels: ctx.configuredModels,
    selectedModelId: ctx.selectedModelId,
    runtime: ctx.runtime,
    conversationError: ctx.conversationError,
    history: ctx.history,
    isBusy: ctx.isBusy,
    hasPendingEditReview: ctx.hasPendingEditReview,
    acceptsRunEvent: ctx.acceptsRunEvent,
    approvalModeForRun: ctx.approvalModeForRun,
    markToolConflict: ctx.markToolConflict,
    getEditProposal: ctx.getEditProposal,
    listEditProposals: ctx.listEditProposals,
    upsertEditProposal: ctx.upsertEditProposal,
    updateEditProposal: ctx.updateEditProposal,
    newConversation: ctx.newConversation,
    selectConversation: ctx.selectConversation,
    openConversation: historyLoader.openConversation,
    restorePersistenceHistory: historyLoader.restorePersistenceHistory,
    ...historyManagement,
    applyModelSettings: ctx.applyModelSettings,
    applyRunSettings: ctx.applyRunSettings,
    selectModel: ctx.selectModel,
    selectThinkingLevel: ctx.selectThinkingLevel,
    selectWebSearchEnabled: ctx.selectWebSearchEnabled,
    selectTemperature: ctx.selectTemperature,
    selectApprovalMode: ctx.selectApprovalMode,
    selectAgentTeamMode: ctx.selectAgentTeamMode,
    capturePersistenceSnapshot: ctx.capturePersistenceSnapshot,
    capturePersistenceChanges() {
      return ctx.persistenceJournal.capture(
        ctx.deferredPersistenceSessions.value
      );
    },
    acknowledgePersistenceChanges: ctx.persistenceJournal.acknowledge,
    initializePersistenceBaseline: ctx.persistenceJournal.initializeBaseline,
    restorePersistenceSnapshot: ctx.restorePersistenceSnapshot,
    holdPersistenceEmits: ctx.holdPersistenceEmits,
    releasePersistenceEmits: ctx.releasePersistenceEmits,
    dispose(disposeOptions): void {
      ctx.persistenceNotificationsEnabled = false;
      ctx.stopPersistenceWatch();
      // Disposing invalidates run ownership. Settle presentation state first
      // so `status: streaming` cannot outlive `activeRunId`.
      ctx.stopStreamingMessages();
      if (disposeOptions?.clearPersistence && ctx.options.onPersistenceRemove) {
        void Promise.resolve().then(() => {
          try {
            ctx.observePersistenceResult(ctx.options.onPersistenceRemove?.());
          } catch {
            ctx.reportPersistenceError();
          }
        });
      }
      ctx.epoch += 1;
      ctx.pendingAttemptId.value = null;
      ctx.activeRunId.value = null;
      ctx.approvalModeByAttempt.clear();
      ctx.approvalModeByRun.clear();
      ctx.sessionsRequiringHistoryReplacement.clear();
      ctx.seenTurnIds.clear();
      ctx.seenSubagentTurnIds.clear();
    }
  };
}
