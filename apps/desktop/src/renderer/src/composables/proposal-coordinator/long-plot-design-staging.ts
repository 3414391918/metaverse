import {
  LongWorkspaceOperationBatchSchema,
  type LongWorkspaceOperationBatch
} from "@deepwrite/contracts/renderer";
import type { AgentEditProposal } from "../../types/conversation";
import {
  agentEditProposalGenerationId,
  agentEditProposalId
} from "../../utils/agentEditReview";
import { buildAgentTextDiff } from "../../utils/agentTextDiff";
import type {
  LongPlotDesignMutationEvent,
  LongProposalStagingContext
} from "./types";
import type { ProposalQueue } from "./queue";
import {
  latestProposalForLane,
  blockedAgentEditLaneMessage
} from "./generations";

export function createLongPlotDesignProposalStager(
  context: LongProposalStagingContext,
  queueAgentEdit: ProposalQueue["queueAgentEdit"]
) {
  const { rememberWorkspaceMutationEvent } = context.editor;
  const { forLongProposal: longConversationForProposalEvent } =
    context.conversations;
  function longPlotDesignProposalText(
    batch: LongWorkspaceOperationBatch
  ): string {
    return JSON.stringify(
      {
        structureOperations: batch.operations,
        documentWrites: batch.documentWrites
      },
      null,
      2
    );
  }

  function stageLongPlotDesignEditProposal(
    event: LongPlotDesignMutationEvent
  ): void {
    if (!rememberWorkspaceMutationEvent(event.id)) return;
    const sourceConversation = longConversationForProposalEvent(event);
    if (!sourceConversation) return;
    const runApprovalMode =
      sourceConversation.approvalModeForRun(
        event.payload.sessionId,
        event.payload.runId
      ) ?? "request-approval";
    const workspaceId = `long:${event.payload.bookId}`;
    const laneId = agentEditProposalId(
      event.payload.runId,
      workspaceId,
      "long-plot-design",
      "plot-design"
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
    const proposalText = longPlotDesignProposalText(event.payload.batch);
    const diff = buildAgentTextDiff("", proposalText);
    const proposal: AgentEditProposal = {
      id: proposalId,
      laneId,
      generation,
      approvalMode: runApprovalMode,
      ...(existing ? { predecessorProposalId: existing.id } : {}),
      runId: event.payload.runId,
      workspaceId,
      stageId: "long-plot-design",
      documentId: "plot-design",
      title: "剧情设计变更",
      summary: event.payload.summary,
      status: "pending",
      proposedText: proposalText,
      toolCallIds: [event.payload.toolCallId],
      additions: diff.additions,
      deletions: diff.deletions,
      hunks: diff.hunks,
      ...(diff.truncated ? { truncated: true } : {}),
      createdAt: event.timestamp,
      updatedAt: event.timestamp,
      longPlotDesignTarget: {
        bookId: event.payload.bookId,
        batch: LongWorkspaceOperationBatchSchema.parse(event.payload.batch)
      }
    };
    sourceConversation.upsertEditProposal(event.payload.runId, proposal);
    if (runApprovalMode === "auto-approve") {
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
  return stageLongPlotDesignEditProposal;
}
