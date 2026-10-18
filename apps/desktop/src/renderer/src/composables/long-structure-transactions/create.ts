import type { LongWorkspaceOperationBatch } from "@deepwrite/contracts";
import { nextTick } from "vue";
import {
  createLongCharacterGroupSelection,
  createLongChapterSelection
} from "../../types/longWorkspace";
import type { ResourceTreeNode } from "../../types/workspace";
import { longNavigationNodeId } from "../../utils/longWorkspaceResourceTree";
import type { LongStructureLease } from "./lease";
import type { LongStructureSync } from "./sync";
import type { LongStructureMutationLease } from "./types";

type MutationModule = typeof import("../../types/longStructureMutations");

export function createLongStructureCreate(
  host: LongStructureLease,
  sync: LongStructureSync,
  loadLongStructureMutationModule: () => Promise<MutationModule>
) {
  const {
    uiMessage,
    resources,
    session,
    state,
    isDisposed,
    captureLongStructureMutationTarget,
    mutationIsCurrent,
    assertCurrentLongStructureMutationTarget,
    withMutation,
    runTracked,
    beginDialogRequest,
    dialogRequestIsCurrent
  } = host;
  const { executeLongStructureMutation } = sync;
  const {
    activeBookId: activeLongBookId,
    activeBookSummary: activeLongBookSummary,
    workspaceIndex: activeLongWorkspaceIndex,
    selection: activeLongSelection,
    characterCreateTarget: longCharacterCreate,
    worldbuildingItemCreateTarget: longWorldbuildingItemCreate,
    plotPointCreateTarget: longPlotPointCreate,
    chapterCardCreateTarget: longChapterCardCreate,
    volumeCreateTarget: longVolumeCreate,
    selectedResourceId
  } = state;
  const {
    saveActiveEditorChanges: saveActiveLongEditorChanges,
    saveActiveEditorBeforeLeaving: saveActiveLongEditorBeforeLeaving,
    openBook: openLongBook,
    selectWorkspaceFile: selectLongWorkspaceFile,
    selectChapterCardTab: selectLongChapterCardTab,
    editor: longWorkspaceEditor
  } = session;
  const resourceNode = resources.node;
  const selectResource = resources.select;
  type BuilderFactory = MutationModule["createLongStructureMutationBuilder"];

  async function buildMutationBatch(
    lease: LongStructureMutationLease,
    failMessage: string,
    build: (
      createLongStructureMutationBuilder: BuilderFactory,
      index: typeof lease.target.index
    ) => LongWorkspaceOperationBatch
  ): Promise<LongWorkspaceOperationBatch | null> {
    try {
      const { createLongStructureMutationBuilder } =
        await loadLongStructureMutationModule();
      assertCurrentLongStructureMutationTarget(lease.target, lease);
      const index = lease.target.index;
      return build(createLongStructureMutationBuilder, index);
    } catch (error: unknown) {
      if (isDisposed()) return null;
      uiMessage.warning(error instanceof Error ? error.message : failMessage);
      return null;
    }
  }

  function trackApply() {
    let succeeded = false;
    let applied = false;
    return {
      completion: {
        succeed: () => {
          succeeded = true;
          applied = true;
        },
        fail: () => undefined,
        appliedButRefreshFailed: () => {
          applied = true;
        }
      },
      didSucceed: () => succeeded,
      didApply: () => applied
    };
  }

  async function openLongChapterCardCreateInternal(
    requestId: number,
    target?: {
      bookId: string;
      volumeId: string;
      source?: "chapter-card" | "draft";
    }
  ): Promise<void> {
    const volumeId =
      target?.volumeId ?? activeLongSelection.value?.chapterCardVolumeId;
    const bookId = target?.bookId ?? activeLongBookId.value;
    const source = target?.source ?? "chapter-card";
    if (!volumeId || !bookId) {
      return;
    }
    if (activeLongBookId.value !== bookId) {
      if (!(await saveActiveLongEditorBeforeLeaving(bookId))) return;
      if (!dialogRequestIsCurrent(requestId)) return;
      await openLongBook(bookId);
    } else if (!(await saveActiveLongEditorChanges())) {
      return;
    }
    if (!dialogRequestIsCurrent(requestId)) return;
    const index = activeLongWorkspaceIndex.value;
    const volume = index?.plot.volumes.find(({ id }) => id === volumeId);
    if (activeLongBookId.value !== bookId || !index || !volume) {
      uiMessage.warning("该分卷已不存在，请刷新后重试。");
      return;
    }
    longChapterCardCreate.value = {
      bookId,
      volumeId,
      volumeTitle: volume.title,
      arcOptions: index.plot.arcs
        .filter((arc) => arc.volumeId === volumeId)
        .sort(
          (left, right) =>
            left.order - right.order || left.id.localeCompare(right.id)
        )
        .map((arc) => ({ value: arc.id, label: arc.title })),
      source
    };
  }

  async function openLongChapterCardCreate(target?: {
    bookId: string;
    volumeId: string;
    source?: "chapter-card" | "draft";
  }): Promise<void> {
    const requestId = beginDialogRequest();
    if (requestId === null) return;
    await runTracked(() =>
      openLongChapterCardCreateInternal(requestId, target)
    );
  }

  async function requestCreateLongDraftSection(
    node: ResourceTreeNode
  ): Promise<void> {
    if (!node.longBookId || !node.longDraftVolumeId) {
      uiMessage.warning("当前分卷尚未准备好新建小节。");
      return;
    }
    await openLongChapterCardCreate({
      bookId: node.longBookId,
      volumeId: node.longDraftVolumeId,
      source: "draft"
    });
  }

  async function openLongWorldbuildingItemCreateForCategoryInternal(
    requestId: number,
    bookId: string,
    categoryId: string
  ): Promise<void> {
    if (activeLongBookId.value !== bookId) {
      if (!(await saveActiveLongEditorBeforeLeaving(bookId))) return;
      if (!dialogRequestIsCurrent(requestId)) return;
      await openLongBook(bookId);
    } else if (!(await saveActiveLongEditorChanges())) {
      return;
    }
    if (!dialogRequestIsCurrent(requestId)) return;
    const index = activeLongWorkspaceIndex.value;
    const category = index?.worldbuilding.find(({ id }) => id === categoryId);
    if (activeLongBookId.value !== bookId || !index || !category) {
      uiMessage.warning("该世界观分类已不存在，请刷新后重试。");
      return;
    }
    if (category.format !== "list") {
      uiMessage.warning("只有列表型世界观分类可以新增条目。");
      return;
    }
    if (category.items.length >= 10_000) {
      uiMessage.warning("单个世界观分类最多支持 10000 个条目。");
      return;
    }
    longWorldbuildingItemCreate.value = {
      bookId,
      categoryId,
      categoryTitle: category.title
    };
  }

  function openLongCharacterCreate(): void {
    const requestId = beginDialogRequest();
    if (requestId === null) return;
    const group = activeLongSelection.value?.characterGroup;
    const bookId = activeLongBookSummary.value?.id;
    const index = activeLongWorkspaceIndex.value;
    if (!group || !bookId || !index) {
      uiMessage.warning("当前人物分组尚未就绪。");
      return;
    }
    const groupOption = index.characterTypes.find(({ id }) => id === group);
    if (!groupOption || !dialogRequestIsCurrent(requestId)) return;
    longCharacterCreate.value = {
      bookId,
      group,
      groupLabel: groupOption.title
    };
  }

  async function openLongWorldbuildingItemCreate(): Promise<void> {
    const bookId = activeLongBookId.value;
    const selection = activeLongSelection.value;
    if (
      !bookId ||
      !selection?.key.startsWith("worldbuilding:") ||
      selection.key === "worldbuilding:reveals"
    ) {
      uiMessage.warning("当前世界观分类尚未就绪。");
      return;
    }
    const categoryId = selection.key.slice("worldbuilding:".length);
    const requestId = beginDialogRequest();
    if (requestId === null) return;
    await runTracked(() =>
      openLongWorldbuildingItemCreateForCategoryInternal(
        requestId,
        bookId,
        categoryId
      )
    );
  }

  async function openLongVolumeCreateInternal(
    requestId: number,
    target: { bookId: string; source: "book-line" | "draft" }
  ): Promise<void> {
    if (activeLongBookId.value !== target.bookId) {
      if (!(await saveActiveLongEditorBeforeLeaving(target.bookId))) return;
      if (!dialogRequestIsCurrent(requestId)) return;
      await openLongBook(target.bookId);
    } else if (!(await saveActiveLongEditorChanges())) {
      return;
    }
    if (!dialogRequestIsCurrent(requestId)) return;
    if (
      activeLongBookId.value !== target.bookId ||
      !activeLongWorkspaceIndex.value ||
      !captureLongStructureMutationTarget(target.bookId)
    ) {
      uiMessage.warning("当前小说工作区尚未准备好新建分卷。");
      return;
    }
    longVolumeCreate.value = {
      bookId: target.bookId,
      source: target.source
    };
  }

  async function openLongVolumeCreate(): Promise<void> {
    const requestId = beginDialogRequest();
    if (requestId === null) return;
    await runTracked(async () => {
      const bookId = activeLongBookId.value;
      if (
        !bookId ||
        !activeLongWorkspaceIndex.value ||
        activeLongSelection.value?.key !== "plot-design:book-line"
      ) {
        return;
      }
      await openLongVolumeCreateInternal(requestId, {
        bookId,
        source: "book-line"
      });
      if (
        dialogRequestIsCurrent(requestId) &&
        longVolumeCreate.value?.bookId === bookId &&
        activeLongSelection.value?.key !== "plot-design:book-line"
      ) {
        longVolumeCreate.value = null;
        uiMessage.warning("活动小说已切换，本次新建分卷已取消。");
      }
    });
  }

  async function openLongPlotPointCreateForVolumeInternal(
    requestId: number,
    bookId: string,
    volumeId: string
  ): Promise<void> {
    if (activeLongBookId.value !== bookId) {
      if (!(await saveActiveLongEditorBeforeLeaving(bookId))) return;
      if (!dialogRequestIsCurrent(requestId)) return;
      await openLongBook(bookId);
    } else if (!(await saveActiveLongEditorChanges())) {
      return;
    }
    if (!dialogRequestIsCurrent(requestId)) return;
    const index = activeLongWorkspaceIndex.value;
    const volume = index?.plot.volumes.find(({ id }) => id === volumeId);
    if (activeLongBookId.value !== bookId || !index || !volume) {
      uiMessage.warning("该分卷已不存在，请刷新后重试。");
      return;
    }
    longPlotPointCreate.value = {
      bookId,
      volumeId,
      volumeTitle: volume.title
    };
  }

  async function openLongPlotPointCreateForVolume(
    bookId: string,
    volumeId: string
  ): Promise<void> {
    const requestId = beginDialogRequest();
    if (requestId === null) return;
    await runTracked(() =>
      openLongPlotPointCreateForVolumeInternal(requestId, bookId, volumeId)
    );
  }

  async function openLongPlotPointCreate(): Promise<void> {
    const bookId = activeLongBookId.value;
    const volumeId = activeLongSelection.value?.plotPointVolumeId;
    if (!bookId || !volumeId) {
      uiMessage.warning("当前分卷尚未就绪。");
      return;
    }
    await openLongPlotPointCreateForVolume(bookId, volumeId);
  }

  async function selectCreatedLongTreeResource(
    lease: LongStructureMutationLease,
    resourceId: string
  ): Promise<boolean> {
    await nextTick();
    if (!mutationIsCurrent(lease)) return false;
    const node = resourceNode(resourceId);
    if (!node?.longTreeItem) return false;
    await selectResource(node);
    return mutationIsCurrent(lease) && selectedResourceId.value === node.id;
  }

  async function createLongVolume(input: {
    title: string;
    summary: string;
  }): Promise<void> {
    const target = longVolumeCreate.value;
    if (!target) {
      uiMessage.warning("当前小说工作区尚未准备好新建分卷。");
      return;
    }
    await withMutation(
      target.bookId,
      (message) => uiMessage.info(message),
      async (lease) => {
        const index = lease.target.index;
        const batch = await buildMutationBatch(
          lease,
          "无法创建分卷。",
          (createLongStructureMutationBuilder, index) => {
            if (longVolumeCreate.value !== target) {
              throw new Error("新建分卷目标已切换，本次操作已取消。");
            }
            return createLongStructureMutationBuilder(index).createVolume(
              input
            );
          }
        );
        if (!batch) return;
        const created = batch.operations.find(
          (operation) => operation.type === "volume.create"
        );
        if (!created || created.type !== "volume.create") {
          uiMessage.warning("无法确定新建分卷。");
          return;
        }
        const apply = trackApply();
        await executeLongStructureMutation(
          lease,
          batch,
          apply.completion,
          {
            saveEditor: false,
            ...(target.source === "draft"
              ? {
                  successMessage: `已新建分卷“${input.title}”，剧情阶段已同步生成卷纲`
                }
              : {})
          },
          index
        );
        if (!apply.didApply() || isDisposed()) return;
        if (longVolumeCreate.value === target) longVolumeCreate.value = null;
        if (!apply.didSucceed() || !mutationIsCurrent(lease)) return;
        if (target.source === "draft") {
          await nextTick();
          if (!mutationIsCurrent(lease)) return;
          if (
            activeLongBookId.value === target.bookId &&
            activeLongSelection.value?.root === "draft"
          ) {
            return;
          }
          const draftRoot = resourceNode(
            longNavigationNodeId(target.bookId, "root:draft")
          );
          if (draftRoot) {
            await selectResource(draftRoot);
          }
          return;
        }
        if (
          await selectCreatedLongTreeResource(
            lease,
            longNavigationNodeId(
              target.bookId,
              `plot-design:book-line:volume:${created.volume.id}`
            )
          )
        ) {
          return;
        }
        if (mutationIsCurrent(lease)) {
          longWorkspaceEditor.value?.selectBookLineVolume(created.volume.id);
        }
      }
    );
  }

  async function createLongWorldbuildingItem(input: {
    title: string;
  }): Promise<void> {
    const target = longWorldbuildingItemCreate.value;
    if (!target) {
      uiMessage.warning("当前世界观分类尚未准备好新建条目。");
      return;
    }
    await withMutation(
      target.bookId,
      (message) => uiMessage.info(message),
      async (lease) => {
        const index = lease.target.index;
        const batch = await buildMutationBatch(
          lease,
          "无法创建世界观条目。",
          (createLongStructureMutationBuilder, index) => {
            if (longWorldbuildingItemCreate.value !== target) {
              throw new Error("新建世界观条目目标已切换，本次操作已取消。");
            }
            return createLongStructureMutationBuilder(
              index
            ).createWorldbuildingItem(target.categoryId, input.title);
          }
        );
        if (!batch) return;
        const created = batch.operations.find(
          (operation) => operation.type === "worldbuildingItem.create"
        );
        if (!created || created.type !== "worldbuildingItem.create") {
          uiMessage.warning("无法确定新建世界观条目。");
          return;
        }
        const apply = trackApply();
        await executeLongStructureMutation(
          lease,
          batch,
          apply.completion,
          {
            saveEditor: false,
            successMessage: `已创建世界观条目“${input.title}”`
          },
          index
        );
        if (apply.didApply() && longWorldbuildingItemCreate.value === target) {
          longWorldbuildingItemCreate.value = null;
        }
        if (!apply.didSucceed() || !mutationIsCurrent(lease)) return;
        await selectCreatedLongTreeResource(
          lease,
          longNavigationNodeId(
            target.bookId,
            `worldbuilding:${target.categoryId}:item:${created.item.id}`
          )
        );
      }
    );
  }

  async function createLongPlotPoint(input: {
    title: string;
    summary: string;
  }): Promise<void> {
    const target = longPlotPointCreate.value;
    if (!target) {
      uiMessage.warning("当前分卷尚未准备好新建剧情点。");
      return;
    }
    await withMutation(
      target.bookId,
      (message) => uiMessage.info(message),
      async (lease) => {
        const index = lease.target.index;
        const batch = await buildMutationBatch(
          lease,
          "无法创建剧情点。",
          (createLongStructureMutationBuilder, index) => {
            if (longPlotPointCreate.value !== target) {
              throw new Error("新建剧情点目标已切换，本次操作已取消。");
            }
            return createLongStructureMutationBuilder(index).createArc({
              volumeId: target.volumeId,
              title: input.title,
              summary: input.summary,
              outline: ""
            });
          }
        );
        if (!batch) return;
        const created = batch.operations.find(
          (operation) => operation.type === "arc.create"
        );
        if (!created || created.type !== "arc.create") {
          uiMessage.warning("无法确定新建剧情点。");
          return;
        }
        const apply = trackApply();
        await executeLongStructureMutation(
          lease,
          batch,
          apply.completion,
          { saveEditor: false, successMessage: `已创建剧情点“${input.title}”` },
          index
        );
        if (apply.didApply() && longPlotPointCreate.value === target) {
          longPlotPointCreate.value = null;
        }
        if (!apply.didSucceed() || !mutationIsCurrent(lease)) return;
        await selectCreatedLongTreeResource(
          lease,
          longNavigationNodeId(
            target.bookId,
            `plot-design:plot-point:${created.arc.id}`
          )
        );
      }
    );
  }

  async function createLongChapterCard(input: {
    title: string;
    primaryArcId: string | null;
  }): Promise<void> {
    const target = longChapterCardCreate.value;
    const fromDraft = target?.source === "draft";
    if (!target) {
      uiMessage.warning(
        fromDraft
          ? "当前分卷尚未准备好新建小节。"
          : "当前分卷尚未准备好新建章卡。"
      );
      return;
    }
    await withMutation(
      target.bookId,
      (message) => uiMessage.info(message),
      async (lease) => {
        const index = lease.target.index;
        if (
          input.primaryArcId !== null &&
          !target.arcOptions.some(({ value }) => value === input.primaryArcId)
        ) {
          uiMessage.warning("所选剧情点已不存在，请重新打开弹窗。");
          return;
        }
        let batch: LongWorkspaceOperationBatch;
        try {
          const { createLongStructureMutationBuilder } =
            await loadLongStructureMutationModule();
          assertCurrentLongStructureMutationTarget(lease.target, lease);
          if (longChapterCardCreate.value !== target) {
            throw new Error(
              fromDraft
                ? "新建小节目标已切换，本次操作已取消。"
                : "新建章卡目标已切换，本次操作已取消。"
            );
          }
          batch = createLongStructureMutationBuilder(index).createChapter({
            volumeId: target.volumeId,
            primaryArcId: input.primaryArcId,
            title: input.title
          });
        } catch (error: unknown) {
          if (isDisposed()) return;
          uiMessage.warning(
            error instanceof Error
              ? error.message
              : fromDraft
                ? "无法创建小节。"
                : "无法创建章卡。"
          );
          return;
        }
        const created = batch.operations.find(
          (operation) => operation.type === "chapter.create"
        );
        if (!created || created.type !== "chapter.create") {
          uiMessage.warning(
            fromDraft ? "无法确定新建小节。" : "无法确定新建章卡。"
          );
          return;
        }
        const apply = trackApply();
        await executeLongStructureMutation(
          lease,
          batch,
          apply.completion,
          {
            saveEditor: false,
            successMessage: fromDraft
              ? `已新建小节“${input.title}”，并同步创建章卡`
              : `已创建章卡“${input.title}”`
          },
          index
        );
        if (!apply.didApply() || isDisposed()) return;
        if (longChapterCardCreate.value === target) {
          longChapterCardCreate.value = null;
        }
        if (!apply.didSucceed() || !mutationIsCurrent(lease)) return;
        await nextTick();
        if (!mutationIsCurrent(lease)) return;
        if (fromDraft) {
          const summary = activeLongBookSummary.value;
          const nextIndex = activeLongWorkspaceIndex.value;
          const selection =
            summary && nextIndex
              ? createLongChapterSelection(
                  summary,
                  nextIndex,
                  created.chapterCard.id
                )
              : undefined;
          if (selection) {
            selectedResourceId.value = longNavigationNodeId(
              target.bookId,
              selection.key
            );
            await selectLongWorkspaceFile(selection);
          }
          return;
        }
        if (
          await selectCreatedLongTreeResource(
            lease,
            longNavigationNodeId(
              target.bookId,
              `plot-design:chapter-card:${created.chapterCard.id}`
            )
          )
        ) {
          return;
        }
        if (mutationIsCurrent(lease)) {
          await selectLongChapterCardTab(created.chapterCard.id);
        }
      }
    );
  }

  async function createLongCharacter(input: {
    name: string;
    aliases: string[];
  }): Promise<void> {
    const target = longCharacterCreate.value;
    if (!target) {
      uiMessage.warning("当前人物分组尚未就绪。");
      return;
    }
    await withMutation(
      target.bookId,
      (message) => uiMessage.info(message),
      async (lease) => {
        const summary = activeLongBookSummary.value;
        const index = lease.target.index;
        if (!summary || summary.id !== target.bookId) {
          uiMessage.warning("当前人物分组尚未就绪。");
          return;
        }
        const batch = await buildMutationBatch(
          lease,
          "无法创建人物。",
          (createLongStructureMutationBuilder, index) => {
            if (longCharacterCreate.value !== target) {
              throw new Error("新建人物目标已切换，本次操作已取消。");
            }
            return createLongStructureMutationBuilder(index).createCharacter({
              name: input.name,
              group: target.group,
              aliases: input.aliases
            });
          }
        );
        if (!batch) return;
        const created = batch.operations.find(
          (operation) => operation.type === "character.create"
        );
        if (!created || created.type !== "character.create") {
          uiMessage.warning("无法确定新建人物。");
          return;
        }
        const apply = trackApply();
        await executeLongStructureMutation(
          lease,
          batch,
          apply.completion,
          {},
          index
        );
        if (!apply.didApply() || isDisposed()) return;
        if (longCharacterCreate.value === target) {
          longCharacterCreate.value = null;
        }
        if (!apply.didSucceed() || !mutationIsCurrent(lease)) return;
        const latestSummary = activeLongBookSummary.value;
        const latestIndex = activeLongWorkspaceIndex.value;
        if (
          !latestSummary ||
          !latestIndex ||
          latestSummary.id !== target.bookId
        ) {
          return;
        }
        if (
          await selectCreatedLongTreeResource(
            lease,
            longNavigationNodeId(
              target.bookId,
              `character:${created.character.id}`
            )
          )
        ) {
          resources.revealEditor();
          return;
        }
        const selection = createLongCharacterGroupSelection(
          latestSummary,
          latestIndex,
          target.group,
          created.character.id
        );
        selectedResourceId.value = longNavigationNodeId(
          target.bookId,
          `character-group:${target.group}`
        );
        resources.revealEditor();
        await selectLongWorkspaceFile(selection);
      }
    );
  }

  return {
    openLongChapterCardCreate,
    openLongChapterCardCreateInternal,
    requestCreateLongDraftSection,
    openLongWorldbuildingItemCreateForCategoryInternal,
    openLongCharacterCreate,
    openLongWorldbuildingItemCreate,
    openLongVolumeCreateInternal,
    openLongVolumeCreate,
    openLongPlotPointCreateForVolumeInternal,
    openLongPlotPointCreate,
    createLongVolume,
    createLongWorldbuildingItem,
    createLongPlotPoint,
    createLongChapterCard,
    createLongCharacter
  };
}

export type LongStructureCreate = ReturnType<typeof createLongStructureCreate>;
