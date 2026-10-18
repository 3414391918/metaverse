import type { AgentEditProposal } from "../../types/conversation";
import {
  agentEditProposalGenerationId,
  agentEditProposalId
} from "../../utils/agentEditReview";
import { buildAgentTextDiff } from "../../utils/agentTextDiff";
import { longCharacterBatchForFiles } from "./long-file-proposal-batches";
import type {
  LongCharacterFileMutationEvent,
  LongProposalStagingContext
} from "./types";
import type { ProposalQueue } from "./queue";
import {
  latestProposalForLane,
  blockedAgentEditLaneMessage
} from "./generations";

export function createLongCharacterProposalStager(
  context: LongProposalStagingContext,
  queueAgentEdit: ProposalQueue["queueAgentEdit"]
) {
  const { notifications: uiMessage } = context;
  const { rememberWorkspaceMutationEvent } = context.editor;
  const { forLongProposal: longConversationForProposalEvent } =
    context.conversations;
  function stageLongCharacterEditProposal(
    event: LongCharacterFileMutationEvent
  ): void {
    if (!rememberWorkspaceMutationEvent(event.id)) return;
    const sourceConversation = longConversationForProposalEvent(event);
    if (!sourceConversation) return;
    const files = event.payload.files;
    const batch = longCharacterBatchForFiles(event);
    if (!files.length || !batch) {
      const message =
        "人物文件工具必须形成一名人物的完整创建变更，或一次只修改一份人物档案；本次结果未进入审批。";
      sourceConversation.markToolConflict(
        event.payload.runId,
        event.payload.toolCallId,
        message
      );
      uiMessage.warning(message);
      return;
    }
    const isCreation = files.every(({ operation }) => operation === "create");
    const primaryFile = files[0]!;
    const runApprovalMode =
      sourceConversation.approvalModeForRun(
        event.payload.sessionId,
        event.payload.runId
      ) ?? "request-approval";
    const workspaceId = `long:${event.payload.bookId}`;
    const laneDocumentId = isCreation
      ? `create:${primaryFile.characterId}`
      : primaryFile.fileId;
    const laneId = agentEditProposalId(
      event.payload.runId,
      workspaceId,
      "long-character",
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
    const creationPredecessor = isCreation
      ? undefined
      : sourceConversation
          .listEditProposals(event.payload.runId)
          .find(
            (proposal) =>
              proposal.longCharacterTarget?.files.some(
                (file) =>
                  file.fileId === primaryFile.fileId &&
                  file.operation === "create"
              ) &&
              proposal.status !== "rejected" &&
              proposal.status !== "conflict"
          );
    const generation = existing ? (existing.generation ?? 1) + 1 : 1;
    const proposalId = agentEditProposalGenerationId(laneId, generation);
    const predecessorProposalId = existing?.id ?? creationPredecessor?.id;
    const diff = buildAgentTextDiff(
      isCreation ? "" : primaryFile.beforeText,
      primaryFile.afterText
    );
    const noChanges =
      !isCreation && primaryFile.beforeText === primaryFile.afterText;
    const proposal: AgentEditProposal = {
      id: proposalId,
      laneId,
      generation,
      approvalMode: runApprovalMode,
      ...(predecessorProposalId ? { predecessorProposalId } : {}),
      runId: event.payload.runId,
      workspaceId,
      stageId: "long-character",
      documentId: laneDocumentId,
      title: isCreation
        ? `${primaryFile.characterName} / 新建人物`
        : primaryFile.title,
      summary: event.payload.summary,
      status: noChanges ? "accepted" : "pending",
      ...(!noChanges ? { proposedText: primaryFile.afterText } : {}),
      toolCallIds: [event.payload.toolCallId],
      additions: diff.additions,
      deletions: diff.deletions,
      hunks: diff.hunks,
      ...(diff.truncated ? { truncated: true } : {}),
      ...(noChanges ? { statusMessage: "文本没有实际变化，无需保存。" } : {}),
      createdAt: event.timestamp,
      updatedAt: event.timestamp,
      longCharacterTarget: {
        bookId: event.payload.bookId,
        batch,
        files
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
  return stageLongCharacterEditProposal;
}
