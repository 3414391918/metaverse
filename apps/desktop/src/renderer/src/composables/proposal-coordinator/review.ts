import type { AgentConversationController } from "../useAgentConversation";
import type {
  AgentEditReviewRequest,
  AgentProposalAcceptor,
  ProposalCoordinatorContext
} from "./types";
import type { ProposalQueue } from "./queue";
import {
  blockLaterAgentEditGenerations,
  canReviewAgentEditDuringRun,
  conflictDependentLongWorldbuildingProposals,
  conflictDependentLongCharacterProposals
} from "./generations";

interface ProposalCommits {
  acceptLibraryCreationProposal: AgentProposalAcceptor;
  acceptLibraryTextEdit: AgentProposalAcceptor;
  acceptLongWorldbuildingFileProposal: AgentProposalAcceptor;
  acceptLongCharacterFileProposal: AgentProposalAcceptor;
  acceptLongPlotDesignProposal: AgentProposalAcceptor;
  acceptLongDraftProposal: AgentProposalAcceptor;
}
export function createProposalReview(
  context: ProposalCoordinatorContext,
  queue: ProposalQueue,
  commits: ProposalCommits
) {
  const { notifications: uiMessage } = context;
  const { snapshot: catalogSnapshot } = context.catalog;
  const {
    all: allConversations,
    active: activeConversation,
    activeLong: activeLongConversation
  } = context.conversations;
  const { queueAgentEdit, removeQueuedAgentEdit } = queue;
  const {
    acceptLibraryCreationProposal,
    acceptLibraryTextEdit,
    acceptLongWorldbuildingFileProposal,
    acceptLongCharacterFileProposal,
    acceptLongPlotDesignProposal,
    acceptLongDraftProposal
  } = commits;
  async function applyAgentEdit(
    conversation: AgentConversationController,
    request: AgentEditReviewRequest,
    automatic = false,
    reservation?: {
      decisionToken: string;
      expectedProposedRevision: string;
    }
  ): Promise<void> {
    const proposal = conversation.getEditProposal(
      request.runId,
      request.proposalId
    );
    if (!proposal) {
      uiMessage.error("待审阅的智能体变更已不存在，请重新生成修改。");
      return;
    }
    const reserved = Boolean(
      reservation &&
      proposal.status === "accepting" &&
      proposal.decisionToken === reservation.decisionToken &&
      (proposal.proposedRevision ?? proposal.id) ===
        reservation.expectedProposedRevision
    );
    if (reservation && !reserved) {
      return;
    }
    if (conversation.isBusy.value && !canReviewAgentEditDuringRun(proposal)) {
      uiMessage.info("请等待本轮智能体完成后再审阅文稿变更");
      return;
    }

    if (request.decision === "reject") {
      if (proposal.status === "accepting" || proposal.status === "accepted")
        return;
      removeQueuedAgentEdit(conversation, request.runId, request.proposalId);
      conversation.updateEditProposal(request.runId, request.proposalId, {
        status: "rejected",
        proposedText: undefined,
        statusMessage: proposal.longPlotDesignTarget
          ? "已拒绝，剧情设计保持不变。"
          : proposal.longDraftTarget
            ? "已拒绝，章节正文保持不变。"
            : "已拒绝，原文保持不变。"
      });
      if (proposal.longWorldbuildingTarget?.file.operation === "create") {
        conflictDependentLongWorldbuildingProposals(
          conversation,
          proposal,
          "空白世界观文件创建已被拒绝，相关正文写入无法落盘。",
          removeQueuedAgentEdit
        );
      }
      if (
        proposal.longCharacterTarget?.files.every(
          ({ operation }) => operation === "create"
        )
      ) {
        conflictDependentLongCharacterProposals(
          conversation,
          proposal,
          "人物创建已被拒绝，相关人物档案写入无法落盘。",
          removeQueuedAgentEdit
        );
      }
      blockLaterAgentEditGenerations(
        conversation,
        proposal,
        removeQueuedAgentEdit
      );
      uiMessage.info(
        proposal.longPlotDesignTarget
          ? "已拒绝剧情设计变更，当前结构未改变"
          : proposal.longDraftTarget
            ? "已拒绝章节正文变更，当前正文未改变"
            : "已拒绝智能体修改，原文未改变"
      );
      return;
    }

    if (
      (proposal.status === "accepting" && !reserved) ||
      proposal.status === "accepted" ||
      proposal.status === "rejected" ||
      proposal.status === "conflict"
    ) {
      return;
    }

    if (proposal.predecessorProposalId) {
      const predecessor = conversation.getEditProposal(
        request.runId,
        proposal.predecessorProposalId
      );
      if (
        !predecessor ||
        predecessor.status === "rejected" ||
        predecessor.status === "conflict" ||
        predecessor.status === "error"
      ) {
        const message =
          "前序智能体修改未能落盘，当前这项依赖已阻断，没有覆盖当前文稿。";
        conversation.updateEditProposal(request.runId, request.proposalId, {
          status: "conflict",
          proposedText: undefined,
          statusMessage: message
        });
        return;
      }
      if (predecessor.status !== "accepted") {
        conversation.updateEditProposal(request.runId, request.proposalId, {
          status: "pending",
          statusMessage: "正在等待前序修改完成落盘…"
        });
        return;
      }
    }

    if (proposal.libraryTarget?.operation === "create") {
      await acceptLibraryCreationProposal(
        conversation,
        request,
        proposal,
        automatic
      );
      return;
    }

    if (proposal.longWorldbuildingTarget) {
      await acceptLongWorldbuildingFileProposal(
        conversation,
        request,
        proposal,
        automatic
      );
      return;
    }

    if (proposal.longCharacterTarget) {
      await acceptLongCharacterFileProposal(
        conversation,
        request,
        proposal,
        automatic
      );
      return;
    }

    if (proposal.longPlotDesignTarget) {
      await acceptLongPlotDesignProposal(
        conversation,
        request,
        proposal,
        automatic
      );
      return;
    }

    if (proposal.longDraftTarget) {
      await acceptLongDraftProposal(conversation, request, proposal, automatic);
      return;
    }

    if (proposal.libraryTarget) {
      await acceptLibraryTextEdit(conversation, request, proposal, automatic);
      return;
    }
    const message = "该提案不属于当前小说或资料库创作流程，请重新生成。";
    conversation.updateEditProposal(request.runId, request.proposalId, {
      status: "conflict",
      proposedText: undefined,
      statusMessage: message
    });
    uiMessage.warning(message);
  }

  async function reviewAgentEdit(
    request: AgentEditReviewRequest
  ): Promise<void> {
    const conversation = activeConversation.value;
    const proposal = conversation.getEditProposal(
      request.runId,
      request.proposalId
    );
    if (
      request.decision === "accept" &&
      proposal &&
      canReviewAgentEditDuringRun(proposal)
    ) {
      queueAgentEdit(
        conversation,
        conversation.sessionId.value,
        request.runId,
        request.proposalId,
        false,
        true
      );
      return;
    }
    await applyAgentEdit(conversation, request);
  }

  async function reviewLongAgentEdit(
    request: AgentEditReviewRequest
  ): Promise<void> {
    const conversation = activeLongConversation.value;
    if (!conversation) return;
    const proposal = conversation.getEditProposal(
      request.runId,
      request.proposalId
    );
    if (
      request.decision === "accept" &&
      proposal &&
      canReviewAgentEditDuringRun(proposal)
    ) {
      queueAgentEdit(
        conversation,
        conversation.sessionId.value,
        request.runId,
        request.proposalId,
        false,
        true
      );
      return;
    }
    await applyAgentEdit(conversation, request);
  }
  function resumeRecoveredAutomaticAgentEdits(
    conversationsToScan: readonly AgentConversationController[] = allConversations()
  ): void {
    if (!catalogSnapshot.value) return;
    for (const conversation of conversationsToScan) {
      for (const message of conversation.messages.value) {
        for (const proposal of message.editProposals ?? []) {
          if (
            proposal.approvalMode !== "auto-approve" ||
            proposal.status !== "pending" ||
            !canReviewAgentEditDuringRun(proposal)
          ) {
            continue;
          }
          queueAgentEdit(
            conversation,
            conversation.sessionId.value,
            proposal.runId,
            proposal.id,
            true,
            true
          );
        }
      }
    }
  }
  return {
    applyAgentEdit,
    reviewAgentEdit,
    reviewLongAgentEdit,
    resumeRecoveredAutomaticAgentEdits
  };
}
