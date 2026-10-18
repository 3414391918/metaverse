import { computed, reactive, ref, type Ref } from "vue";
import type {
  LongWorkspaceIndexSnapshot,
  LongWorkspaceOperationBatch,
  LongWorldbuildingFormat
} from "@deepwrite/contracts";
import { isLongMigrationEvidenceCategoryId } from "../types/longWorkspace";
import type {
  LongOrderDirection,
  LongStructureMutationBuilder
} from "../types/longStructureMutations";
import type { LongStructureDeleteRow as ManagerRow } from "./useLongStructureDeleteConfirmation";
import type {
  LongStructureMutationController,
  LongStructureMutationSurface
} from "./useLongStructureMutation";
import { useLongStructureFormImpact } from "./useLongStructureFormImpact";

export type LongFoundationSection = "worldbuilding" | "characterTypes";
interface StructureDraft {
  id: string | null;
  title: string;
  format: LongWorldbuildingFormat;
}

export function useLongStructureForm(options: {
  snapshot(): LongWorkspaceIndexSnapshot;
  section: Ref<LongFoundationSection>;
  mutations: LongStructureMutationController;
  emitMutation(
    build: (
      builder: LongStructureMutationBuilder
    ) => LongWorkspaceOperationBatch,
    surface?: LongStructureMutationSurface
  ): boolean;
  applyMutationBatch(
    batch: LongWorkspaceOperationBatch,
    surface: LongStructureMutationSurface
  ): boolean;
  notify: { warning(message: string): void; info(message: string): void };
}) {
  const formOpen = ref(false);
  const formMode = ref<"create" | "edit">("create");
  const draft = reactive<StructureDraft>(emptyDraft());
  const {
    pendingFormImpact,
    clearPendingFormImpact,
    capturePendingFormImpact,
    confirmedFormBatch
  } = useLongStructureFormImpact({
    fields: () => [draft.title, draft.format] as const,
    mutationPending: () => options.mutations.pendingMutation.value !== null
  });
  const worldbuildingRows = computed<ManagerRow[]>(() =>
    [...options.snapshot().worldbuilding]
      .sort((left, right) => left.order - right.order)
      .map((category) => ({
        kind: "worldbuilding" as const,
        id: category.id,
        title: category.title,
        detail: category.format === "list" ? "条目列表" : "连续文本",
        readOnly: isLongMigrationEvidenceCategoryId(category.id)
      }))
  );

  const characterTypeRows = computed<ManagerRow[]>(() =>
    [...options.snapshot().characterTypes]
      .sort((left, right) => left.order - right.order)
      .map((characterType) => {
        const count = options
          .snapshot()
          .characters.filter(({ group }) => group === characterType.id).length;
        return {
          kind: "characterType" as const,
          id: characterType.id,
          title: characterType.title,
          detail: `连续文本 · ${count} 人`
        };
      })
  );
  const rows = computed(() =>
    options.section.value === "worldbuilding"
      ? worldbuildingRows.value
      : characterTypeRows.value
  );
  const formTitle = computed(() =>
    options.section.value === "characterTypes"
      ? formMode.value === "create"
        ? "新建人物类型"
        : "编辑人物类型"
      : formMode.value === "create"
        ? "新建世界观分类"
        : "编辑世界观分类"
  );

  function emptyDraft(): StructureDraft {
    return {
      id: null,
      title: "",
      format: "text"
    };
  }

  function resetDraft(): void {
    Object.assign(draft, emptyDraft());
  }

  function openCreate(): void {
    resetDraft();
    clearPendingFormImpact();
    formMode.value = "create";
    formOpen.value = true;
  }

  function openEdit(row: ManagerRow): void {
    if (row.readOnly) {
      options.notify.info("迁移证据是只读资料，不能改名、改格式或删除。");
      return;
    }
    resetDraft();
    clearPendingFormImpact();
    formMode.value = "edit";
    if (row.kind === "characterType") {
      const characterType = options
        .snapshot()
        .characterTypes.find((candidate) => candidate.id === row.id);
      if (!characterType) return;
      draft.id = characterType.id;
      draft.title = characterType.title;
      draft.format = "text";
    } else {
      const category = options
        .snapshot()
        .worldbuilding.find((candidate) => candidate.id === row.id);
      if (!category) return;
      draft.id = category.id;
      draft.title = category.title;
      draft.format = category.format;
    }
    formOpen.value = true;
  }

  function closeForm(): void {
    if (options.mutations.mutationLocked.value) return;
    formOpen.value = false;
    clearPendingFormImpact();
  }

  function submitForm(): void {
    const title = draft.title.trim();
    if (!title) {
      options.notify.warning("请输入标题。");
      return;
    }

    const confirmed = confirmedFormBatch();
    if (confirmed) {
      options.applyMutationBatch(confirmed, "form");
      return;
    }

    options.emitMutation((builder) => {
      if (options.section.value === "characterTypes") {
        if (formMode.value === "create") {
          return builder.createCharacterType({ title });
        }
        if (!draft.id) throw new Error("缺少待编辑人物类型的稳定 ID。");
        return builder.updateCharacterType(draft.id, { title });
      }
      if (formMode.value === "create") {
        return builder.createWorldbuilding({
          title,
          format: draft.format
        });
      }
      if (!draft.id) {
        throw new Error("缺少待编辑条目的稳定 ID。");
      }
      return builder.updateWorldbuilding(draft.id, {
        title,
        format: draft.format
      });
    }, "form");
  }

  function canMove(row: ManagerRow, direction: LongOrderDirection): boolean {
    if (row.readOnly) return false;
    const index = rows.value.findIndex((candidate) => candidate.id === row.id);
    return direction === "up"
      ? index > 0
      : index >= 0 && index < rows.value.length - 1;
  }

  function reorder(row: ManagerRow, direction: LongOrderDirection): void {
    if (row.readOnly) {
      options.notify.info("迁移证据保持稳定顺序，不能重排。");
      return;
    }
    options.emitMutation((builder) =>
      row.kind === "characterType"
        ? builder.reorderCharacterType(row.id, direction)
        : builder.reorderWorldbuilding(row.id, direction)
    );
  }
  function resetFormAfterApply(): void {
    formOpen.value = false;
    clearPendingFormImpact();
  }
  return {
    formOpen,
    formMode,
    draft,
    rows,
    formTitle,
    pendingFormImpact,
    capturePendingFormImpact,
    resetFormAfterApply,
    openCreate,
    openEdit,
    closeForm,
    submitForm,
    canMove,
    reorder
  };
}
