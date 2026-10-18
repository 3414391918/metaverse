import type { AgentEditProposal } from "../../types/conversation";
import {
  agentEditProposalGenerationId,
  agentEditProposalId
} from "../../utils/agentEditReview";
import { buildAgentTextDiff } from "../../utils/agentTextDiff";
import { longWorldbuildingBatchForFile } from "./long-file-proposal-batches";
import type {
  LongWorldbuildingFileMutationEvent,
  LongProposalStagingContext
} from "./types";
import type { ProposalQueue } from "./queue";
import {
  latestProposalForLane,
  blockedAgentEditLaneMessage
} from "./generations";

export function createLongWorldbuildingProposalStager(
  context: LongProposalStagingContext,
  queueAgentEdit: ProposalQueue["queueAgentEdit"]
) {
  const { notifications: uiMessage } = context;
  const { rememberWorkspaceMutationEvent } = context.editor;
  const { forLongProposal: longConversationForProposalEvent } =
    context.conversations;
  function stageLongWorldbuildingEditProposal(
    event: LongWorldbuildingFileMutationEvent
  ): void {
    if (!rememberWorkspaceMutationEvent(event.id)) return;
    const sourceConversation = longConversationForProposalEvent(event);
    if (!sourceConversation) return;
    const file = event.payload.files[0];
    const batch = longWorldbuildingBatchForFile(event);
    if (!file || !batch) {
      const message =
        "世界观文件工具必须一次只形成一个独立文件变更，本次结果未进入审批。";
      sourceConversation.markToolConflict(
        event.payload.runId,
        event.payload.toolCallId,
        message
      );
      uiMessage.warning(message);
      return;
    }
    const runApprovalMode =
      sourceConversation.approvalModeForRun(
        event.payload.sessionId,
        event.payload.runId
      ) ?? "request-approval";
    const workspaceId = `long:${event.payload.bookId}`;
    const laneDocumentId =
      file.operation === "create" ? `create:${file.fileId}` : file.fileId;
    const laneId = agentEditProposalId(
      event.payload.runId,
      workspaceId,
      "long-worldbuilding",
      laneDocumentId
    );
    const existing = latestProposalForLane(
      sourceConversation,
      event.payload.runId,
      laneId
    );
    if (existing?.toolCallIds.includes(event.payload.toolCallId)) return;
    const blockedMessage = blockedAgentEditLaneMessage(existing);
    if (blockedMessage) {
      sourceConversation.markToolConflict(
        event.payload.runId,
        event.payload.toolCallId,
        blockedMessage
      );
      return;
    }
    const creationPredecessor =
      file.operation === "create"
        ? undefined
        : sourceConversation
            .listEditProposals(event.payload.runId)
            .find(
              (proposal) =>
                proposal.longWorldbuildingTarget?.file.fileId === file.fileId &&
                proposal.longWorldbuildingTarget.file.operation === "create" &&
                proposal.status !== "rejected" &&
                proposal.status !== "conflict"
            );
    const generation = existing ? (existing.generation ?? 1) + 1 : 1;
    const proposalId = agentEditProposalGenerationId(laneId, generation);
    const predecessorProposalId = existing?.id ?? creationPredecessor?.id;
    const diff = buildAgentTextDiff(file.beforeText, file.afterText);
    const noChanges =
      file.operation !== "create" && file.beforeText === file.afterText;
    const proposal: AgentEditProposal = {
      id: proposalId,
      laneId,
      generation,
      approvalMode: runApprovalMode,
      ...(predecessorProposalId ? { predecessorProposalId } : {}),
      runId: event.payload.runId,
      workspaceId,
      stageId: "long-worldbuilding",
      documentId: file.fileId,
      title: file.title,
      summary: event.payload.summary,
      status: noChanges ? "accepted" : "pending",
      ...(noChanges ? {} : { proposedText: file.afterText }),
      toolCallIds: [event.payload.toolCallId],
      additions: diff.additions,
      deletions: diff.deletions,
      hunks: diff.hunks,
      ...(diff.truncated ? { truncated: true } : {}),
      ...(noChanges ? { statusMessage: "文本没有实际变化，无需保存。" } : {}),
      createdAt: event.timestamp,
      updatedAt: event.timestamp,
      longWorldbuildingTarget: {
        bookId: event.payload.bookId,
        batch,
        file
      }
    };
    sourceConversation.upsertEditProposal(event.payload.runId, proposal);
    if (!noChanges && runApprovalMode === "auto-approve") {
      queueAgentEdit(
        sourceConversation,
        event.payload.sessionId,
        event.payload.runId,
        proposal.id,
        true,
        true
      );
    }
  }
  return stageLongWorldbuildingEditProposal;
}
