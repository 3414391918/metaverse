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

export function createLongDraftProposalCommit(
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
  async function acceptLongDraftProposal(
    conversation: AgentConversationController,
    request: AgentEditReviewRequest,
    proposal: AgentEditProposal,
    automatic: boolean
  ): Promise<void> {
    const target = proposal.longDraftTarget;
    const api = resolveLongWorkspaceApi();
    if (!target || !api) {
      const message = "正文服务当前不可用。";
      conversation.updateEditProposal(request.runId, request.proposalId, {
        status: "error",
        statusMessage: message
      });
      uiMessage.error(message);
      return;
    }
    if (acceptingAgentEditWorkspaceIds.value.has(proposal.workspaceId)) {
      const message = automatic
        ? "检测到本书正在保存其他内容，正文实时自动落盘已暂停，请稍后重试。"
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
        ? "正在自动批准并保存章节正文…"
        : "正在保存章节正文…"
    });
    setAgentEditWorkspaceAccepting(proposal.workspaceId, true);
    let applied = false;
    let attemptedBatch: LongWorkspaceOperationBatch | undefined;
    try {
      if (activeLongBookId.value === target.bookId) {
        await nextTick();
        if (!(await saveActiveLongEditorChanges())) {
          throw new Error("当前创作空间内容尚未保存，未覆盖章节正文。");
        }
      }
      const latest = await api.getWorkspaceIndex({ bookId: target.bookId });
      const chapter = latest.workspaceIndex.chapters.find(
        ({ chapterCardId }) => chapterCardId === target.file.chapterCardId
      );
      if (!chapter || chapter.body.id !== target.file.fileId) {
        const message = "目标章卡或章节正文已经不存在，未保存本次修改。";
        conversation.updateEditProposal(request.runId, request.proposalId, {
          status: "conflict",
          statusMessage: message
        });
        uiMessage.warning(message);
        return;
      }
      const batch = LongWorkspaceOperationBatchSchema.parse(target.batch);
      attemptedBatch = batch;
      let expectedImpact = target.expectedImpact;
      if (!expectedImpact) {
        expectedImpact = await previewLongProposalImpact(
          api,
          target.bookId,
          batch,
          "章节正文"
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
            longDraftTarget: { ...target, batch, expectedImpact }
          },
          statusMessage:
            "已读取本次正文与关联影响，请核对下方影响后再次确认保存。",
          notificationMessage: "请核对章节正文及关联影响后再次确认保存",
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
          ? `${automatic ? "已自动批准并" : "已接受并"}保存章节正文到本地 Markdown。`
          : "章节正文已保存，但界面刷新失败；请手动刷新创作空间。"
      });
      if (!automatic) {
        uiMessage.success("已接受并保存章节正文");
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
            "章节正文"
          );
          moveLongProposalToManualReview({
            conversation,
            runId: request.runId,
            proposalId: request.proposalId,
            patch: {
              longDraftTarget: {
                ...target,
                batch: attemptedBatch,
                expectedImpact
              }
            },
            statusMessage:
              "关联影响已变化，已更新下方影响；请重新核对并再次确认保存。",
            notificationMessage: "章节正文的关联影响已变化，请重新确认",
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
          : "保存章节正文失败，原文件保持不变。";
      conversation.updateEditProposal(request.runId, request.proposalId, {
        status: applied ? "accepted" : "error",
        statusMessage: applied
          ? `章节正文已经保存，但刷新失败：${message}`
          : message
      });
      if (applied) {
        uiMessage.warning(`章节正文已经保存，但刷新失败：${message}`);
      } else {
        uiMessage.error(message);
      }
    } finally {
      setAgentEditWorkspaceAccepting(proposal.workspaceId, false);
    }
  }
  return acceptLongDraftProposal;
}
