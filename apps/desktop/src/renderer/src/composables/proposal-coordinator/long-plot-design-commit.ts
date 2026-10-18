import { nextTick } from "vue";
import {
  LongWorkspaceOperationBatchSchema,
  type LongWorkspaceOperationBatch
} from "@deepwrite/contracts/renderer";
import type { AgentEditProposal } from "../../types/conversation";
import {
  replaceLongBookSummary,
  resolveLongWorkspaceApi
} from "../../types/longWorkspace";
import {
  holdLongProposalForManualReview,
  isLongImpactMismatch,
  moveLongProposalToManualReview,
  previewLongProposalImpact
} from "./long-impact-approval";
import type { AgentConversationController } from "../useAgentConversation";
import type {
  AgentEditReviewRequest,
  LongProposalCommitOptions
} from "./types";

export function createLongPlotDesignProposalCommit(
  options: LongProposalCommitOptions
) {
  const {
    acceptingAgentEditWorkspaceIds,
    setAgentEditWorkspaceAccepting,
    activeLongBookId,
    longBooks,
    saveActiveLongEditorChanges,
    refreshLongProposalWorkspace,
    removeQueuedAgentEdit,
    uiMessage
  } = options;
  async function acceptLongPlotDesignProposal(
    conversation: AgentConversationController,
    request: AgentEditReviewRequest,
    proposal: AgentEditProposal,
    automatic: boolean
  ): Promise<void> {
    const target = proposal.longPlotDesignTarget;
    const api = resolveLongWorkspaceApi();
    if (!target || !api) {
      const message = "剧情设计服务当前不可用。";
      conversation.updateEditProposal(request.runId, request.proposalId, {
        status: "error",
        statusMessage: message
      });
      uiMessage.error(message);
      return;
    }
    if (acceptingAgentEditWorkspaceIds.value.has(proposal.workspaceId)) {
      const message = automatic
        ? "检测到本书正在保存其他内容，剧情设计实时自动落盘已暂停，请稍后重试。"
        : "同一本书正在保存其他修改，请稍候再接受";
      conversation.updateEditProposal(request.runId, request.proposalId, {
        status: automatic ? "error" : "pending",
        statusMessage: message
      });
      uiMessage.info(message);
      return;
    }

    conversation.updateEditProposal(request.runId, request.proposalId, {
      status: "accepting",
      statusMessage: automatic
        ? "正在自动批准、校验影响并保存剧情设计…"
        : "正在校验影响并保存剧情设计…"
    });
    setAgentEditWorkspaceAccepting(proposal.workspaceId, true);
    let applied = false;
    let attemptedBatch: LongWorkspaceOperationBatch | undefined;
    try {
      if (activeLongBookId.value === target.bookId) {
        await nextTick();
        if (!(await saveActiveLongEditorChanges())) {
          throw new Error("当前创作空间内容尚未保存，未覆盖剧情设计。");
        }
      }
      const batch = LongWorkspaceOperationBatchSchema.parse(target.batch);
      attemptedBatch = batch;
      let expectedImpact = target.expectedImpact;
      if (!expectedImpact) {
        expectedImpact = await previewLongProposalImpact(
          api,
          target.bookId,
          batch,
          "剧情设计"
        );
      }
      if (
        holdLongProposalForManualReview({
          automatic,
          hadExpectedImpact: Boolean(target.expectedImpact),
          batch,
          confirmation: expectedImpact,
          conversation,
          runId: request.runId,
          proposalId: request.proposalId,
          patch: {
            longPlotDesignTarget: { ...target, batch, expectedImpact }
          },
          statusMessage:
            "已读取本次结构与关联影响，请核对下方影响后再次确认保存。",
          notificationMessage: "请核对剧情设计及关联影响后再次确认保存",
          removeQueued: removeQueuedAgentEdit,
          notify: uiMessage.info
        })
      ) {
        return;
      }
      const result = await api.applyOperations({
        bookId: target.bookId,
        batch: LongWorkspaceOperationBatchSchema.parse({
          ...batch,
          expectedImpact
        })
      });
      applied = true;
      longBooks.value = replaceLongBookSummary(longBooks.value, result.summary);
      const refreshed = await refreshLongProposalWorkspace(target.bookId);
      conversation.updateEditProposal(request.runId, request.proposalId, {
        status: "accepted",
        proposedText: undefined,
        statusMessage: refreshed
          ? `${automatic ? "已自动批准并" : "已接受并"}保存剧情设计。`
          : "剧情设计已保存，但界面刷新失败；请手动刷新创作空间。"
      });
      if (!automatic) {
        uiMessage.success("已接受并保存剧情设计");
      }
    } catch (error: unknown) {
      let currentError = error;
      if (
        !applied &&
        target.expectedImpact &&
        attemptedBatch &&
        isLongImpactMismatch(error)
      ) {
        try {
          const expectedImpact = await previewLongProposalImpact(
            api,
            target.bookId,
            attemptedBatch,
            "剧情设计"
          );
          moveLongProposalToManualReview({
            conversation,
            runId: request.runId,
            proposalId: request.proposalId,
            patch: {
              longPlotDesignTarget: {
                ...target,
                batch: attemptedBatch,
                expectedImpact
              }
            },
            statusMessage:
              "关联影响已变化，已更新下方影响；请重新核对并再次确认保存。",
            notificationMessage: "剧情设计的关联影响已变化，请重新确认",
            removeQueued: removeQueuedAgentEdit,
            notify: uiMessage.warning
          });
          return;
        } catch (previewError: unknown) {
          currentError = previewError;
        }
      }
      const message =
        currentError instanceof Error
          ? currentError.message
          : "保存剧情设计失败，当前结构保持不变。";
      conversation.updateEditProposal(request.runId, request.proposalId, {
        status: applied ? "accepted" : "error",
        statusMessage: applied
          ? `剧情设计已经保存，但刷新失败：${message}`
          : message
      });
      if (applied) {
        uiMessage.warning(`剧情设计已经保存，但刷新失败：${message}`);
      } else {
        uiMessage.error(message);
      }
    } finally {
      setAgentEditWorkspaceAccepting(proposal.workspaceId, false);
    }
  }
  return acceptLongPlotDesignProposal;
}
