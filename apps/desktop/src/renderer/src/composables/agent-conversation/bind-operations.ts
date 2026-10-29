import * as persistenceController from "./persistence-controller";
import * as runLifecycle from "./run-lifecycle";
import * as approvals from "./approvals";
import * as sessionLifecycle from "./session-lifecycle";
import * as runSettings from "./run-settings";
import type { AgentConversationContext } from "./context";
export function bindConversationOperations(
  ctx: AgentConversationContext
): void {
  ctx.nextConversationTimestamp =
    persistenceController.nextConversationTimestamp.bind(undefined, ctx);
  ctx.storeCurrentConversation =
    persistenceController.storeCurrentConversation.bind(undefined, ctx);
  ctx.capturePersistenceSnapshot =
    persistenceController.capturePersistenceSnapshot.bind(undefined, ctx);
  ctx.reportPersistenceError =
    persistenceController.reportPersistenceError.bind(undefined, ctx);
  ctx.observePersistenceResult =
    persistenceController.observePersistenceResult.bind(undefined, ctx);
  ctx.holdPersistenceEmits = persistenceController.holdPersistenceEmits.bind(
    undefined,
    ctx
  );
  ctx.releasePersistenceEmits =
    persistenceController.releasePersistenceEmits.bind(undefined, ctx);
  ctx.emitPersistenceSnapshot =
    persistenceController.emitPersistenceSnapshot.bind(undefined, ctx);
  ctx.runPersistenceBatch = (operation) =>
    persistenceController.runPersistenceBatch(ctx, operation);
  ctx.restorePersistenceSnapshot =
    persistenceController.restorePersistenceSnapshot.bind(undefined, ctx);
  ctx.finalizeRunningSubagents = runLifecycle.finalizeRunningSubagents;
  ctx.acceptsRunEvent = approvals.acceptsRunEvent.bind(undefined, ctx);
  ctx.rememberRunApprovalMode = approvals.rememberRunApprovalMode.bind(
    undefined,
    ctx
  );
  ctx.approvalModeForRun = approvals.approvalModeForRun.bind(undefined, ctx);
  ctx.markToolConflict = approvals.markToolConflict.bind(undefined, ctx);
  ctx.messageForEditProposal = approvals.messageForEditProposal.bind(
    undefined,
    ctx
  );
  ctx.ensureEditProposalMessage = approvals.ensureEditProposalMessage.bind(
    undefined,
    ctx
  );
  ctx.getEditProposal = approvals.getEditProposal.bind(undefined, ctx);
  ctx.listEditProposals = approvals.listEditProposals.bind(undefined, ctx);
  ctx.upsertEditProposal = approvals.upsertEditProposal.bind(undefined, ctx);
  ctx.updateEditProposal = approvals.updateEditProposal.bind(undefined, ctx);
  ctx.resetTransientConversationState =
    sessionLifecycle.resetTransientConversationState.bind(undefined, ctx);
  ctx.stopStreamingMessages = sessionLifecycle.stopStreamingMessages.bind(
    undefined,
    ctx
  );
  ctx.newConversation = sessionLifecycle.newConversation.bind(undefined, ctx);
  ctx.selectConversation = sessionLifecycle.selectConversation.bind(
    undefined,
    ctx
  );
  ctx.applyRunSettings = runSettings.applyRunSettings.bind(undefined, ctx);
  ctx.applyModelSettings = runSettings.applyModelSettings.bind(undefined, ctx);
  ctx.selectModel = runSettings.selectModel.bind(undefined, ctx);
  ctx.selectThinkingLevel = runSettings.selectThinkingLevel.bind(
    undefined,
    ctx
  );
  ctx.selectWebSearchEnabled = runSettings.selectWebSearchEnabled.bind(
    undefined,
    ctx
  );
  ctx.selectTemperature = runSettings.selectTemperature.bind(undefined, ctx);
  ctx.selectApprovalMode = runSettings.selectApprovalMode.bind(undefined, ctx);
  ctx.selectAgentTeamMode = runSettings.selectAgentTeamMode.bind(
    undefined,
    ctx
  );
}
