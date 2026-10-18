import type {
  LongWorkspaceImpactConfirmation,
  LongWorkspaceIndexSnapshot,
  LongWorkspaceOperationBatch
} from "@deepwrite/contracts";
import { longWorkspaceOperationsRequireImpactConfirmation } from "@deepwrite/contracts/renderer";
import {
  replaceLongBookSummary,
  type LongStructureMutationCompletion,
  type LongWorldbuildingSyncCompletion,
  type LongWorldbuildingSyncRequest
} from "../../types/longWorkspace";
import type { LongStructureLease } from "./lease";
import type { LongStructureMutationLease } from "./types";

const LONG_STRUCTURE_PREVIEW_TIMEOUT_MS = 15_000;

async function previewWithTimeout<T>(preview: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      preview,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error("核对小说结构影响超时，请重试。")),
          LONG_STRUCTURE_PREVIEW_TIMEOUT_MS
        );
      })
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export function createLongStructureSync(
  host: LongStructureLease,
  _loadLongStructureMutationModule: () => Promise<
    typeof import("../../types/longStructureMutations")
  >
) {
  const {
    uiMessage,
    resources,
    session,
    state,
    resolveLongWorkspaceApi,
    isDisposed,
    captureLongStructureMutationTarget,
    mutationIsCurrent,
    assertCurrentLongStructureMutationTarget,
    withMutation
  } = host;
  const {
    longBooks,
    activeBookId: activeLongBookId,
    activeBookSummary: activeLongBookSummary,
    workspaceIndex: activeLongWorkspaceIndex,
    selection: activeLongSelection,
    structureDialogOpen: longStructureDialogOpen
  } = state;
  const {
    saveActiveEditorChanges: saveActiveLongEditorChanges,
    refreshActiveWorkspace: refreshActiveLongWorkspace,
    refreshWorkspaceAfterProposal: refreshLongProposalWorkspace,
    editor: longWorkspaceEditor
  } = session;

  async function handleLongWorldbuildingSync(
    payload: LongWorldbuildingSyncRequest,
    completion: LongWorldbuildingSyncCompletion
  ): Promise<void> {
    const expectedBookId = activeLongBookSummary.value?.id;
    await withMutation(
      expectedBookId,
      (message) => {
        uiMessage.warning(message);
        completion.fail(message);
      },
      async (lease) => {
        const api = resolveLongWorkspaceApi();
        const summary = activeLongBookSummary.value;
        const index = activeLongWorkspaceIndex.value;
        if (!api || !summary || !index) {
          const message = "当前小说结构尚未就绪。";
          uiMessage.warning(message);
          completion.fail(message);
          return;
        }
        if (payload.sourceBookId === summary.id) {
          const message = "不能从当前小说同步到自身。";
          uiMessage.warning(message);
          completion.fail(message);
          return;
        }
        try {
          if (payload.prepared) {
            await executeLongStructureMutation(
              lease,
              payload.prepared.batch,
              completion,
              {
                successMessage: `已从「${payload.sourceTitle}」同步世界观（${payload.prepared.createdCategoryCount} 个分类）`,
                expectedImpact: payload.prepared.confirmation
              }
            );
            return;
          }
          const {
            buildLongWorldbuildingSyncBatch,
            filterSyncableWorldbuildingCategories,
            loadSourceWorldbuildingContents
          } = await import("../../utils/longWorldbuildingSync");
          assertCurrentLongStructureMutationTarget(lease.target, lease);
          if (!(await saveActiveLongEditorChanges())) {
            completion.fail("当前小说修改尚未保存。");
            return;
          }
          if (!mutationIsCurrent(lease)) return;
          if (!captureLongStructureMutationTarget(lease.target.bookId)) {
            throw new Error("活动小说已切换，本次世界观同步未保存。");
          }
          if (!(await refreshActiveLongWorkspace(lease.target.bookId))) {
            throw new Error("无法同步最新小说结构，本次修改未保存。");
          }
          if (!mutationIsCurrent(lease)) return;
          const latestTarget = captureLongStructureMutationTarget(
            lease.target.bookId
          );
          const latestIndex = latestTarget?.index;
          if (!latestTarget || !latestIndex) {
            throw new Error("活动小说已切换，本次世界观同步未保存。");
          }
          const source = await api.getWorkspaceIndex({
            bookId: payload.sourceBookId
          });
          assertCurrentLongStructureMutationTarget(
            latestTarget,
            lease,
            "活动小说或结构已切换，本次世界观同步未保存。"
          );
          if (source.bookId !== payload.sourceBookId) {
            throw new Error("来源小说工作区读取结果不一致。");
          }
          const sourceCategories = filterSyncableWorldbuildingCategories(
            source.workspaceIndex.worldbuilding
          );
          if (sourceCategories.length === 0) {
            throw new Error("所选小说没有可同步的世界观分类。");
          }
          const contents = await loadSourceWorldbuildingContents(
            (input) => api.readDocument(input),
            payload.sourceBookId,
            sourceCategories
          );
          assertCurrentLongStructureMutationTarget(
            latestTarget,
            lease,
            "活动小说或结构已切换，本次世界观同步未保存。"
          );
          const plan = await buildLongWorldbuildingSyncBatch({
            target: latestIndex,
            source: source.workspaceIndex,
            contents
          });
          assertCurrentLongStructureMutationTarget(
            latestTarget,
            lease,
            "活动小说或结构已切换，本次世界观同步未保存。"
          );
          const confirmation = await previewLongStructureImpact(
            lease.target.bookId,
            plan.batch
          );
          assertCurrentLongStructureMutationTarget(
            latestTarget,
            lease,
            "活动小说或结构已切换，本次世界观同步影响已变化。"
          );
          completion.review({
            batch: plan.batch,
            confirmation,
            createdCategoryCount: plan.createdCategoryCount,
            deletedCategoryCount: plan.deletedCategoryCount,
            writtenFileCount: plan.writtenFileCount
          });
        } catch (error: unknown) {
          if (isDisposed()) return;
          const message =
            error instanceof Error ? error.message : "同步世界观失败。";
          completion.fail(message);
          uiMessage.error(message);
        }
      }
    );
  }

  async function executeLongStructureMutation(
    lease: LongStructureMutationLease,
    batch: LongWorkspaceOperationBatch,
    completion: LongStructureMutationCompletion,
    options: {
      saveEditor?: boolean;
      successMessage?: string;
      expectedImpact?: LongWorkspaceImpactConfirmation;
      onImpactChanged?: (impact: LongWorkspaceImpactConfirmation) => void;
    } = {},
    _beforeIndex: LongWorkspaceIndexSnapshot = lease.target.index
  ): Promise<void> {
    const workspaceApi = resolveLongWorkspaceApi();
    if (!workspaceApi || !mutationIsCurrent(lease)) {
      if (!isDisposed()) {
        const message = "当前小说结构尚未就绪。";
        uiMessage.warning(message);
        completion.fail(message);
      }
      return;
    }
    const expectedBookId = lease.target.bookId;
    const updatesItemLayout = batch.operations.some(
      (operation) => operation.type === "featureSettings.update"
    );
    if (updatesItemLayout && activeLongSelection.value) {
      activeLongSelection.value = {
        ...activeLongSelection.value,
        ...longWorkspaceEditor.value?.captureNavigationSelection()
      };
    }
    if (
      options.saveEditor !== false &&
      !(await saveActiveLongEditorChanges())
    ) {
      if (mutationIsCurrent(lease)) completion.fail("当前小说修改尚未保存。");
      return;
    }
    if (!mutationIsCurrent(lease)) return;
    if (!captureLongStructureMutationTarget(expectedBookId)) {
      const message = "活动小说已切换，本次结构修改未保存。";
      completion.fail(message);
      uiMessage.warning(message);
      return;
    }
    let previewImpact: LongWorkspaceImpactConfirmation | null = null;
    try {
      if (!(await refreshActiveLongWorkspace(expectedBookId))) {
        throw new Error("无法同步最新小说结构，本次修改未保存。");
      }
      if (!mutationIsCurrent(lease)) return;
      const latestTarget = captureLongStructureMutationTarget(expectedBookId);
      const latestIndex = latestTarget?.index;
      if (
        !latestTarget ||
        !latestIndex ||
        activeLongBookSummary.value?.id !== expectedBookId
      ) {
        throw new Error("活动小说已切换，本次结构修改未保存。");
      }
      assertCurrentLongStructureMutationTarget(latestTarget, lease);
      const { expectedImpact: batchExpectedImpact, ...unconfirmedBatch } =
        batch;
      const confirmedImpact = options.expectedImpact ?? batchExpectedImpact;
      const preview = await previewWithTimeout(
        workspaceApi.previewOperations({
          bookId: expectedBookId,
          batch: unconfirmedBatch
        })
      );
      assertCurrentLongStructureMutationTarget(latestTarget, lease);
      if (preview.bookId !== expectedBookId) {
        throw new Error("结构影响预览返回了其他小说项目。");
      }
      previewImpact = preview.preview.confirmation;
      assertCurrentLongStructureMutationTarget(latestTarget, lease);
      if (
        longWorkspaceOperationsRequireImpactConfirmation(
          batch.operations,
          previewImpact
        ) &&
        !confirmedImpact
      ) {
        const message = "请先核对关联关系与删除影响，再确认执行。";
        options.onImpactChanged?.(previewImpact);
        completion.fail(message, previewImpact);
        uiMessage.warning(message);
        return;
      }
      const applyResult = await workspaceApi.applyOperations({
        bookId: expectedBookId,
        batch: {
          ...batch,
          expectedImpact: confirmedImpact ?? preview.preview.confirmation
        }
      });
      lease.applied = true;
      if (isDisposed()) return;
      if (
        applyResult.bookId !== expectedBookId ||
        activeLongBookId.value !== expectedBookId ||
        activeLongBookSummary.value?.id !== expectedBookId
      ) {
        throw new Error("活动小说已切换，无法发布结构保存结果。");
      }
      longBooks.value = replaceLongBookSummary(
        longBooks.value,
        applyResult.summary
      );
      const refreshed = await refreshLongProposalWorkspace(expectedBookId);
      if (isDisposed()) return;
      if (!refreshed) {
        longStructureDialogOpen.value = false;
        completion.appliedButRefreshFailed(
          "结构修改已保存，但界面未能同步最新结构。"
        );
        uiMessage.warning(
          "结构修改已保存，但界面未能同步最新结构；请重新打开小说设置。"
        );
        return;
      }
      if (updatesItemLayout) {
        resources.synchronizeSelectedResourceForLayout(expectedBookId);
      }
      completion.succeed();
      uiMessage.success(
        options.successMessage ??
          `已直接保存 ${batch.operations.length} 项小说结构修改`
      );
    } catch (error: unknown) {
      if (isDisposed()) return;
      const rawMessage =
        error instanceof Error ? error.message : "保存小说结构修改失败。";
      const message = /impact_mismatch|影响.*变化/iu.test(rawMessage)
        ? "关联关系已变化，请核对最新影响后再次确认。"
        : rawMessage;
      if (message !== rawMessage && previewImpact) {
        options.onImpactChanged?.(previewImpact);
      }
      if (lease.applied) {
        longStructureDialogOpen.value = false;
        completion.appliedButRefreshFailed(message);
      } else {
        completion.fail(
          message,
          message === rawMessage ? undefined : (previewImpact ?? undefined)
        );
      }
      if (message === rawMessage) uiMessage.error(message);
      else uiMessage.warning(message);
    }
  }

  async function previewLongStructureImpact(
    bookId: string,
    batch: LongWorkspaceOperationBatch
  ): Promise<LongWorkspaceImpactConfirmation> {
    const workspaceApi = resolveLongWorkspaceApi();
    if (!workspaceApi) {
      throw new Error("当前小说结构尚未就绪。");
    }
    const { expectedImpact: _expectedImpact, ...unconfirmedBatch } = batch;
    const preview = await previewWithTimeout(
      workspaceApi.previewOperations({
        bookId,
        batch: unconfirmedBatch
      })
    );
    if (preview.bookId !== bookId) {
      throw new Error("结构影响预览返回了其他小说项目。");
    }
    return preview.preview.confirmation;
  }

  return {
    handleLongWorldbuildingSync,
    executeLongStructureMutation,
    previewLongStructureImpact
  };
}

export type LongStructureSync = ReturnType<typeof createLongStructureSync>;
