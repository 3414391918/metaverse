import type { AgentEditProposal } from "../../types/conversation";
import {
  AcceptedEditDiscardConflictError,
  agentProposalSupportsDiscard,
  approvalUsesModificationTool,
  discardStatePatch
} from "../../utils/acceptedEditDiscard";
import type { AgentConversationController } from "../useAgentConversation";
import type {
  AgentEditReviewRequest,
  ProposalCoordinatorContext
} from "../proposal-coordinator/types";
import { discardAcceptedLibraryTextEdit } from "./library";

function proposalUsesModificationTool(
  conversation: AgentConversationController,
  proposal: AgentEditProposal
): boolean {
  return conversation.messages.value.some((message) =>
    approvalUsesModificationTool(message, proposal.toolCallIds)
  );
}

function updateDiscardState(
  conversation: AgentConversationController,
  proposal: AgentEditProposal,
  status: NonNullable<AgentEditProposal["discardState"]>["status"],
  message: string
): void {
  const state = discardStatePatch(status, message);
  conversation.updateEditProposal(proposal.runId, proposal.id, {
    discardState: state,
    updatedAt: state.updatedAt
  });
}

function conflictDependentProposals(
  conversation: AgentConversationController,
  proposal: AgentEditProposal
): void {
  for (const candidate of conversation.listEditProposals(proposal.runId)) {
    if (
      candidate.predecessorProposalId !== proposal.id ||
      (candidate.status !== "pending" && candidate.status !== "error")
    ) {
      continue;
    }
    conversation.updateEditProposal(candidate.runId, candidate.id, {
      status: "conflict",
      proposedText: undefined,
      statusMessage: "前一版修改已被舍弃，请基于当前文件重新生成本项修改。"
    });
  }
}

export function createAcceptedEditDiscardCoordinator(
  context: ProposalCoordinatorContext
) {
  async function discardProposal(
    conversation: AgentConversationController,
    request: Omit<AgentEditReviewRequest, "decision">
  ): Promise<void> {
    const proposal = conversation.getEditProposal(
      request.runId,
      request.proposalId
    );
    if (
      !proposal ||
      !proposal.libraryTarget ||
      !proposalUsesModificationTool(conversation, proposal) ||
      !agentProposalSupportsDiscard(proposal) ||
      proposal.discardState?.status === "discarding"
    ) {
      return;
    }
    if (context.editor.acceptingWorkspaceIds.value.has(proposal.workspaceId)) {
      context.notifications.info("同一作品正在保存其他修改，请稍候再舍弃");
      return;
    }
    updateDiscardState(
      conversation,
      proposal,
      "discarding",
      "正在舍弃本次修改…"
    );
    context.editor.setWorkspaceAccepting(proposal.workspaceId, true);
    try {
      await discardAcceptedLibraryTextEdit(context, proposal);
      updateDiscardState(
        conversation,
        proposal,
        "discarded",
        "已舍弃本次修改，并恢复修改前的内容。"
      );
      conflictDependentProposals(conversation, proposal);
      context.notifications.success("已舍弃本次修改");
    } catch (error: unknown) {
      const conflict =
        error instanceof AcceptedEditDiscardConflictError ||
        context.catalog.isConflict(error);
      const message =
        error instanceof Error ? error.message : "舍弃本次修改失败。";
      updateDiscardState(
        conversation,
        proposal,
        conflict ? "conflict" : "error",
        message
      );
      if (conflict) context.notifications.warning(message);
      else context.notifications.error(message);
    } finally {
      context.editor.setWorkspaceAccepting(proposal.workspaceId, false);
    }
  }

  return {
    discardAgentEdit: (request: Omit<AgentEditReviewRequest, "decision">) =>
      discardProposal(context.conversations.active.value, request)
  };
}
