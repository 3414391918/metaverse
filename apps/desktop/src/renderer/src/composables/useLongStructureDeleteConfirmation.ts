import { computed, ref, shallowRef, type ComputedRef } from "vue";
import type {
  LongWorkspaceImpactConfirmation,
  LongWorkspaceIndexSnapshot,
  LongWorkspaceOperationBatch
} from "@deepwrite/contracts";
import { previewLongWorkspaceOperations } from "@deepwrite/contracts/renderer";
import { createLongStructureMutationBuilder } from "../types/longStructureMutations";
import {
  isLongMigrationEvidenceCategoryId,
  type LongStructureMutationCompletion
} from "../types/longWorkspace";

export interface LongStructureDeleteRow {
  kind: "worldbuilding" | "characterType";
  id: string;
  title: string;
  detail: string;
  readOnly?: boolean;
}

export type PendingLongStructureDelete = LongStructureDeleteRow & {
  previewPending: boolean;
  batch?: LongWorkspaceOperationBatch;
  expectedImpact?: LongWorkspaceImpactConfirmation;
};

interface Options {
  snapshot: ComputedRef<LongWorkspaceIndexSnapshot>;
  locked: () => boolean;
  mutate(
    batch: LongWorkspaceOperationBatch,
    completion: LongStructureMutationCompletion
  ): void;
  notify: {
    info(message: string): void;
    warning(message: string): void;
  };
}

export function useLongStructureDeleteConfirmation(options: Options) {
  // Electron cannot structured-clone Vue proxies. Keep the cached IPC batch and
  // impact confirmation raw while replacing the top-level value for updates.
  const pendingDelete = shallowRef<PendingLongStructureDelete | null>(null);
  const moveCharactersToTypeId = ref("");
  const characterTypeDeleteMode = ref<"move" | "cascade">("move");
  const submitting = ref(false);

  const deletingCharacterCount = computed(() =>
    pendingDelete.value?.kind === "characterType"
      ? options.snapshot.value.characters.filter(
          ({ group }) => group === pendingDelete.value?.id
        ).length
      : 0
  );
  const deletingLastCharacterType = computed(
    () =>
      pendingDelete.value?.kind === "characterType" &&
      options.snapshot.value.characterTypes.length <= 1
  );
  const characterTypeMoveOptions = computed(() =>
    options.snapshot.value.characterTypes
      .filter(({ id }) => id !== pendingDelete.value?.id)
      .sort((left, right) => left.order - right.order)
      .map(({ id, title }) => ({ value: id, label: title }))
  );
  const pendingWorldbuildingDeleteDescription = computed(() => {
    const target = pendingDelete.value;
    if (target?.kind !== "worldbuilding") return "";
    if (target.previewPending) return "正在核对关联关系与删除影响…";
    const category = options.snapshot.value.worldbuilding.find(
      ({ id }) => id === target.id
    );
    if (!category) return "该分类已不存在。";
    if (category.format === "list" && category.items.length > 0) {
      return `删除会直接保存到本机，并级联删除 ${category.items.length} 个从属内容及其文件。`;
    }
    return "该分类没有从属条目；确认后将直接删除分类及其内容文件。";
  });

  function reset(): void {
    pendingDelete.value = null;
    moveCharactersToTypeId.value = "";
    characterTypeDeleteMode.value = "move";
    submitting.value = false;
  }

  function openDelete(row: LongStructureDeleteRow): void {
    if (options.locked()) return;
    if (
      row.readOnly ||
      (row.kind === "worldbuilding" &&
        isLongMigrationEvidenceCategoryId(row.id))
    ) {
      options.notify.info("迁移证据是只读资料，不能删除。");
      return;
    }
    moveCharactersToTypeId.value = "";
    characterTypeDeleteMode.value =
      row.kind === "characterType" &&
      options.snapshot.value.characterTypes.length <= 1
        ? "cascade"
        : "move";
    pendingDelete.value = { ...row, previewPending: true };
    if (
      row.kind === "worldbuilding" ||
      !options.snapshot.value.characters.some(
        ({ group }) => group === row.id
      ) ||
      characterTypeDeleteMode.value === "cascade"
    ) {
      previewPendingDelete();
    }
  }

  function closeDelete(): void {
    if (options.locked() || submitting.value) return;
    reset();
  }

  function setMoveCharactersToTypeId(value: unknown): void {
    moveCharactersToTypeId.value = typeof value === "string" ? value : "";
    if (moveCharactersToTypeId.value) previewPendingDelete();
  }

  function setCharacterTypeDeleteMode(mode: "move" | "cascade"): void {
    const target = pendingDelete.value;
    if (
      !target ||
      target.kind !== "characterType" ||
      options.locked() ||
      submitting.value
    ) {
      return;
    }
    characterTypeDeleteMode.value = mode;
    moveCharactersToTypeId.value = "";
    const { batch: _batch, expectedImpact: _expectedImpact, ...row } = target;
    pendingDelete.value = { ...row, previewPending: true };
    if (mode === "cascade") previewPendingDelete();
  }

  function previewPendingDelete(): void {
    const target = pendingDelete.value;
    if (!target) return;
    try {
      const builder = createLongStructureMutationBuilder(
        options.snapshot.value
      );
      const batch =
        target.kind === "characterType"
          ? builder.deleteCharacterType(
              target.id,
              characterTypeDeleteMode.value === "move"
                ? moveCharactersToTypeId.value || undefined
                : undefined
            )
          : builder.deleteWorldbuilding(target.id);
      const pending: PendingLongStructureDelete = {
        ...target,
        previewPending: false,
        batch,
        expectedImpact: previewLongWorkspaceOperations(
          options.snapshot.value,
          batch
        ).confirmation
      };
      pendingDelete.value = pending;
    } catch (error: unknown) {
      options.notify.warning(
        error instanceof Error ? error.message : "无法读取结构删除影响。"
      );
      reset();
    }
  }

  function confirmDelete(): void {
    const target = pendingDelete.value;
    if (
      !target ||
      target.previewPending ||
      !target.batch ||
      !target.expectedImpact ||
      submitting.value
    ) {
      return;
    }
    submitting.value = true;
    options.mutate(
      { ...target.batch, expectedImpact: target.expectedImpact },
      {
        succeed: reset,
        fail: (_message, changedImpact) => {
          submitting.value = false;
          if (!changedImpact || pendingDelete.value !== target) return;
          pendingDelete.value = {
            ...target,
            previewPending: false,
            expectedImpact: changedImpact
          };
        },
        appliedButRefreshFailed: reset
      }
    );
  }

  return {
    pendingDelete,
    moveCharactersToTypeId,
    characterTypeDeleteMode,
    submitting,
    deletingCharacterCount,
    deletingLastCharacterType,
    characterTypeMoveOptions,
    pendingWorldbuildingDeleteDescription,
    openDelete,
    closeDelete,
    setMoveCharactersToTypeId,
    setCharacterTypeDeleteMode,
    confirmDelete
  };
}
