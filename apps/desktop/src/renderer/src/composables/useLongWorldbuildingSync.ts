import { computed, ref, shallowRef } from "vue";
import type {
  LongWorldbuildingSyncCompletion,
  LongWorldbuildingSyncPreparedChange,
  LongWorldbuildingSyncRequest
} from "../types/longWorkspace";
import type { LongWorldbuildingSyncBookOption } from "../utils/longWorldbuildingSync";
import type { PopupSelectValue } from "../components/PopupSelect.vue";
import type { LongStructureMutationController } from "./useLongStructureMutation";

export function useLongWorldbuildingSync(options: {
  books(): readonly LongWorldbuildingSyncBookOption[];
  currentBookId(): string | null | undefined;
  mutations: LongStructureMutationController;
  sync(
    request: LongWorldbuildingSyncRequest,
    completion: LongWorldbuildingSyncCompletion
  ): void;
  notify: { warning(message: string): void };
}) {
  const syncOpen = ref(false);
  const selectedSyncBookId = ref("");
  // Prepared operations cross IPC and must retain plain objects for structured clone.
  const syncPreparedChange =
    shallowRef<LongWorldbuildingSyncPreparedChange | null>(null);
  const syncBookSelectOptions = computed(() =>
    options
      .books()
      .filter((book) => book.id !== options.currentBookId())
      .map((book) => ({
        value: book.id,
        label:
          book.categoryCount > 0
            ? `${book.title}（${book.categoryCount} 个分类）`
            : book.title
      }))
  );
  const selectedSyncBook = computed(
    () =>
      options.books().find((book) => book.id === selectedSyncBookId.value) ??
      null
  );

  function resetSync(): void {
    syncOpen.value = false;
    selectedSyncBookId.value = "";
    syncPreparedChange.value = null;
  }
  function openSync(): void {
    if (options.mutations.mutationLocked.value) return;
    if (!syncBookSelectOptions.value.length) {
      options.notify.warning("当前没有其他可同步的小说。");
      return;
    }
    selectedSyncBookId.value = String(
      syncBookSelectOptions.value[0]?.value ?? ""
    );
    syncPreparedChange.value = null;
    syncOpen.value = true;
  }
  function closeSync(): void {
    if (!options.mutations.mutationLocked.value) resetSync();
  }
  function setSyncBook(value: PopupSelectValue): void {
    selectedSyncBookId.value = typeof value === "string" ? value : "";
    syncPreparedChange.value = null;
  }
  function confirmSync(): void {
    if (options.mutations.mutationLocked.value) return;
    const source = selectedSyncBook.value;
    if (!source) {
      options.notify.warning("请选择要同步的小说。");
      return;
    }
    if (source.categoryCount <= 0) {
      options.notify.warning("所选小说没有可同步的世界观分类。");
      return;
    }
    const prepared = syncPreparedChange.value;
    const id = options.mutations.begin("sync");
    if (id === null) return;
    options.sync(
      {
        sourceBookId: source.id,
        sourceTitle: source.title,
        ...(prepared ? { prepared } : {})
      },
      {
        succeed: () => {
          options.mutations.finish(id, "succeeded");
        },
        fail: (_message, changedImpact) => {
          if (
            !options.mutations.finish(id, "failed") ||
            !changedImpact ||
            !prepared
          )
            return;
          syncPreparedChange.value = {
            ...prepared,
            confirmation: changedImpact
          };
        },
        appliedButRefreshFailed: () => {
          options.mutations.finish(id, "applied-refresh-failed");
        },
        review: (nextPrepared) => {
          if (options.mutations.finish(id, "failed"))
            syncPreparedChange.value = nextPrepared;
        }
      }
    );
  }
  return {
    syncOpen,
    selectedSyncBookId,
    syncPreparedChange,
    openSync,
    closeSync,
    resetSync,
    setSyncBook,
    confirmSync
  };
}
