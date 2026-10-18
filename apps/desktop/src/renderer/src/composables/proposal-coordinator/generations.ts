import type { AgentEditProposal } from "../../types/conversation";
import type { AgentConversationController } from "../useAgentConversation";
import { latestAgentEditProposalInLane } from "../../utils/agentEditReview";
import type { ProposalQueue } from "./queue";

export function autoApproveEditPriority(
  conversation: AgentConversationController,
  runId: string,
  proposalId: string
): number {
  const proposal = conversation.getEditProposal(runId, proposalId);
  if (!proposal) return 2;
  if (proposal.longWorldbuildingTarget?.file.operation === "create") return 0;
  if (
    proposal.longCharacterTarget?.files.every(
      ({ operation }) => operation === "create"
    )
  )
    return 0;
  if (proposal.longWorldbuildingTarget) {
    return proposal.predecessorProposalId ? 1 : 2;
  }
  if (
    proposal.longCharacterTarget &&
    proposal.longCharacterTarget.files.some(
      ({ operation }) => operation !== "create"
    )
  ) {
    return proposal.predecessorProposalId ? 1 : 2;
  }
  if (proposal.longPlotDesignTarget) {
    return 2;
  }
  if (proposal.longDraftTarget) {
    return proposal.predecessorProposalId ? 1 : 2;
  }
  return 2;
}

export function latestProposalForLane(
  conversation: AgentConversationController,
  runId: string,
  laneId: string
): AgentEditProposal | undefined {
  return latestAgentEditProposalInLane(
    conversation.listEditProposals(runId),
    laneId
  );
}

export function blockedAgentEditLaneMessage(
  proposal: AgentEditProposal | undefined
): string | undefined {
  if (proposal?.status === "rejected") {
    return "前序修改已被拒绝；为避免把被拒内容随后续全文重新带回，本次变更已阻断。";
  }
  if (proposal?.status === "conflict") {
    return "前序修改存在冲突，本次后续变更已阻断，未覆盖当前文稿。";
  }
  return undefined;
}

export function canReviewAgentEditDuringRun(
  proposal: AgentEditProposal
): boolean {
  return (
    Boolean(proposal.libraryTarget) ||
    Boolean(proposal.longWorldbuildingTarget) ||
    Boolean(proposal.longCharacterTarget) ||
    Boolean(proposal.longPlotDesignTarget) ||
    Boolean(proposal.longDraftTarget)
  );
}

export function blockLaterAgentEditGenerations(
  conversation: AgentConversationController,
  rejected: AgentEditProposal,
  removeQueuedAgentEdit: ProposalQueue["removeQueuedAgentEdit"]
): void {
  const laneId = rejected.laneId ?? rejected.id;
  const generation = rejected.generation ?? 1;
  for (const candidate of conversation.listEditProposals(rejected.runId)) {
    if (
      candidate.id === rejected.id ||
      (candidate.laneId ?? candidate.id) !== laneId ||
      (candidate.generation ?? 1) <= generation ||
      (candidate.status !== "pending" && candidate.status !== "error")
    ) {
      continue;
    }
    removeQueuedAgentEdit(conversation, candidate.runId, candidate.id);
    conversation.updateEditProposal(candidate.runId, candidate.id, {
      status: "conflict",
      proposedText: undefined,
      statusMessage:
        "前序正文修改已被拒绝；这项后续修改继承了被拒内容，因此未写入本地文件。"
    });
  }
}

export function conflictDependentLongWorldbuildingProposals(
  conversation: AgentConversationController,
  proposal: AgentEditProposal,
  message: string,
  removeQueuedAgentEdit: ProposalQueue["removeQueuedAgentEdit"]
): void {
  for (const candidate of conversation.listEditProposals(proposal.runId)) {
    if (
      candidate.predecessorProposalId !== proposal.id ||
      !candidate.longWorldbuildingTarget ||
      (candidate.status !== "pending" && candidate.status !== "error")
    ) {
      continue;
    }
    removeQueuedAgentEdit(conversation, candidate.runId, candidate.id);
    conversation.updateEditProposal(candidate.runId, candidate.id, {
      status: "conflict",
      proposedText: undefined,
      statusMessage: message
    });
  }
}

export function conflictDependentLongCharacterProposals(
  conversation: AgentConversationController,
  proposal: AgentEditProposal,
  message: string,
  removeQueuedAgentEdit: ProposalQueue["removeQueuedAgentEdit"]
): void {
  const createdFileIds = new Set(
    proposal.longCharacterTarget?.files
      .filter(({ operation }) => operation === "create")
      .map(({ fileId }) => fileId) ?? []
  );
  if (!createdFileIds.size) return;
  for (const candidate of conversation.listEditProposals(proposal.runId)) {
    if (
      candidate.predecessorProposalId !== proposal.id ||
      !candidate.longCharacterTarget?.files.some(({ fileId }) =>
        createdFileIds.has(fileId)
      ) ||
      (candidate.status !== "pending" && candidate.status !== "error")
    ) {
      continue;
    }
    removeQueuedAgentEdit(conversation, candidate.runId, candidate.id);
    conversation.updateEditProposal(candidate.runId, candidate.id, {
      status: "conflict",
      proposedText: undefined,
      statusMessage: message
    });
  }
}
