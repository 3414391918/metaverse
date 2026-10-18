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

export function createLongCharacterProposalCommit(
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
  async function acceptLongCharacterFileProposal(
    conversation: AgentConversationController,
    request: AgentEditReviewRequest,
    proposal: AgentEditProposal,
    automatic: boolean
  ): Promise<void> {
    const target = proposal.longCharacterTarget;
    const api = resolveLongWorkspaceApi();
    if (!target || !api) {
      const message = "人物文件服务当前不可用。";
      conversation.updateEditProposal(request.runId, request.proposalId, {
        status: "error",
        statusMessage: message
      });
      uiMessage.error(message);
      return;
    }
    if (acceptingAgentEditWorkspaceIds.value.has(proposal.workspaceId)) {
      const message = automatic
        ? "检测到本书正在保存其他内容，实时自动落盘已暂停，请稍后重试。"
        : "同一本书正在保存其他修改，请稍候再接受";
      conversation.updateEditProposal(request.runId, request.proposalId, {
        status: automatic ? "error" : "pending",
        statusMessage: message
      });
      uiMessage.info(message);
      return;
    }

    const isCreation = target.files.every(
      ({ operation }) => operation === "create"
    );
    conversation.updateEditProposal(request.runId, request.proposalId, {
      status: "accepting",
      statusMessage: isCreation
        ? automatic
          ? "正在自动批准并创建人物档案…"
          : "正在创建人物档案…"
        : automatic
          ? "正在自动批准并保存人物档案…"
          : "正在保存人物档案…"
    });
    setAgentEditWorkspaceAccepting(proposal.workspaceId, true);
    let applied = false;
    let attemptedBatch: LongWorkspaceOperationBatch | undefined;
    try {
      if (activeLongBookId.value === target.bookId) {
        await nextTick();
        if (!(await saveActiveLongEditorChanges())) {
          throw new Error("当前创作空间内容尚未保存，未覆盖人物档案。");
        }
      }
      const latest = await api.getWorkspaceIndex({ bookId: target.bookId });
      const currentFiles = new Map([
        ...(latest.workspaceIndex.characterOverview
          ? [
              [
                latest.workspaceIndex.characterOverview.id,
                latest.workspaceIndex.characterOverview
              ] as const
            ]
          : []),
        ...latest.workspaceIndex.characterFiles.flatMap((entry) => [
          [entry.coreProfile.id, entry.coreProfile] as const,
          [entry.relationships.id, entry.relationships] as const
        ])
      ]);
      if (isCreation) {
        if (target.files.some((file) => currentFiles.has(file.fileId))) {
          const message = "人物目录已存在同一人物的部分档案，未重复创建。";
          conversation.updateEditProposal(request.runId, request.proposalId, {
            status: "conflict",
            statusMessage: message
          });
          uiMessage.warning(message);
          return;
        }
      } else {
        const missing = target.files.find(
          (file) => !currentFiles.has(file.fileId)
        );
        if (missing) {
          const message = "目标人物档案已经不存在，无法保存本次修改。";
          conversation.updateEditProposal(request.runId, request.proposalId, {
            status: "conflict",
            statusMessage: message
          });
          await refreshLongProposalWorkspace(target.bookId);
          uiMessage.warning(message);
          return;
        }
      }

      const batch = target.expectedImpact
        ? LongWorkspaceOperationBatchSchema.parse(target.batch)
        : LongWorkspaceOperationBatchSchema.parse({
            ...target.batch,
            operations: (() => {
              const nextOrderByGroup = new Map<string, number>();
              return target.batch.operations.map((operation) => {
                if (operation.type !== "character.create") return operation;
                const group = operation.character.group;
                const nextOrder =
                  (nextOrderByGroup.get(group) ??
                    latest.workspaceIndex.characters.filter(
                      (character) => character.group === group
                    ).length) + 1;
                nextOrderByGroup.set(group, nextOrder);
                return {
                  ...operation,
                  character: { ...operation.character, order: nextOrder }
                };
              });
            })()
          });
      attemptedBatch = batch;
      let expectedImpact = target.expectedImpact;
      if (!expectedImpact) {
        expectedImpact = await previewLongProposalImpact(
          api,
          target.bookId,
          batch,
          "人物档案"
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
            longCharacterTarget: { ...target, batch, expectedImpact }
          },
          statusMessage:
            "已读取本次档案与关联影响，请核对下方影响后再次确认保存。",
          notificationMessage: "请核对人物档案及关联影响后再次确认保存",
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
        statusMessage: isCreation
          ? automatic
            ? "已自动批准并创建人物及两份档案。"
            : "已创建人物及两份档案并保存到本地 Markdown。"
          : refreshed
            ? `${automatic ? "已自动批准并" : "已接受并"}保存到本地 Markdown。`
            : "已保存到本地 Markdown，但界面刷新失败；请手动刷新创作空间。"
      });
      if (!automatic) {
        uiMessage.success(
          isCreation ? "已创建人物档案" : "已接受并保存人物档案"
        );
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
            "人物档案"
          );
          moveLongProposalToManualReview({
            conversation,
            runId: request.runId,
            proposalId: request.proposalId,
            patch: {
              longCharacterTarget: {
                ...target,
                batch: attemptedBatch,
                expectedImpact
              }
            },
            statusMessage:
              "关联影响已变化，已更新下方影响；请重新核对并再次确认保存。",
            notificationMessage: "人物档案的关联影响已变化，请重新确认",
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
          : "保存人物档案失败，原文件保持不变。";
      conversation.updateEditProposal(request.runId, request.proposalId, {
        status: applied ? "accepted" : "error",
        statusMessage: applied
          ? `人物档案已经保存，但刷新失败：${message}`
          : message
      });
      if (applied) {
        uiMessage.warning(`人物档案已经保存，但刷新失败：${message}`);
      } else {
        uiMessage.error(message);
      }
    } finally {
      setAgentEditWorkspaceAccepting(proposal.workspaceId, false);
    }
  }
  return acceptLongCharacterFileProposal;
}
