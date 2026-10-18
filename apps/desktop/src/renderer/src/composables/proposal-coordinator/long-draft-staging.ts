import type { AgentEditProposal } from "../../types/conversation";
import {
  agentEditProposalGenerationId,
  agentEditProposalId
} from "../../utils/agentEditReview";
import { buildAgentTextDiff } from "../../utils/agentTextDiff";
import type {
  LongDraftMutationEvent,
  LongProposalStagingContext
} from "./types";
import type { ProposalQueue } from "./queue";
import {
  latestProposalForLane,
  blockedAgentEditLaneMessage
} from "./generations";

export function createLongDraftProposalStager(
  context: LongProposalStagingContext,
  queueAgentEdit: ProposalQueue["queueAgentEdit"]
) {
  const { rememberWorkspaceMutationEvent } = context.editor;
  const { forLongProposal: longConversationForProposalEvent } =
    context.conversations;
  function stageLongDraftEditProposal(event: LongDraftMutationEvent): void {
    if (!rememberWorkspaceMutationEvent(event.id)) return;
    const sourceConversation = longConversationForProposalEvent(event);
    if (!sourceConversation) return;
    const file = event.payload.file;
    const runApprovalMode =
      sourceConversation.approvalModeForRun(
        event.payload.sessionId,
        event.payload.runId
      ) ?? "request-approval";
    const workspaceId = `long:${event.payload.bookId}`;
    const laneId = agentEditProposalId(
      event.payload.runId,
      workspaceId,
      "long-draft",
      file.fileId
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
    const generation = existing ? (existing.generation ?? 1) + 1 : 1;
    const proposalId = agentEditProposalGenerationId(laneId, generation);
    const diff = buildAgentTextDiff(file.beforeText, file.afterText);
    const noChanges = file.beforeText === file.afterText;
    const proposal: AgentEditProposal = {
      id: proposalId,
      laneId,
      generation,
      approvalMode: runApprovalMode,
      ...(existing ? { predecessorProposalId: existing.id } : {}),
      runId: event.payload.runId,
      workspaceId,
      stageId: "long-draft",
      documentId: file.fileId,
      title: `${file.chapterTitle} / 正文`,
      summary: event.payload.summary,
      status: noChanges ? "accepted" : "pending",
      ...(noChanges ? {} : { proposedText: file.afterText }),
      toolCallIds: [event.payload.toolCallId],
      additions: diff.additions,
      deletions: diff.deletions,
      hunks: diff.hunks,
      ...(diff.truncated ? { truncated: true } : {}),
      ...(noChanges ? { statusMessage: "正文没有实际变化，无需保存。" } : {}),
      createdAt: event.timestamp,
      updatedAt: event.timestamp,
      longDraftTarget: {
        bookId: event.payload.bookId,
        batch: event.payload.batch,
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
  return stageLongDraftEditProposal;
}
