import { computed, onScopeDispose, ref, watch, type ComputedRef } from "vue";
import type { LongWorkspaceFileReference } from "@deepwrite/contracts";
import type { LongDocumentState } from "./useLongEditorDocumentSession";
import { mergeExternalDocument } from "./mergeExternalDocument";

interface Snapshot {
  content: string;
  file: LongWorkspaceFileReference;
}

async function readCompleteDocument(
  bookId: string,
  fileId: string
): Promise<Snapshot> {
  const api = window.deepwrite?.long;
  if (!api) throw new Error("桌面服务不可用。");
  const chunks: string[] = [];
  let offset = 0;
  let first: Awaited<ReturnType<typeof api.readDocument>> | undefined;
  while (true) {
    const page = await api.readDocument({
      bookId,
      fileId,
      offset,
      maxCharacters: 256 * 1024
    });
    if (
      first &&
      (page.file.id !== first.file.id ||
        page.file.updatedAt !== first.file.updatedAt ||
        page.totalCharacters !== first.totalCharacters)
    )
      throw new Error("文件在读取期间再次变化，请重试。");
    first ??= page;
    chunks.push(page.content);
    if (page.nextOffset === null) break;
    if (page.nextOffset <= offset) throw new Error("文件分页游标无效。");
    offset = page.nextOffset;
  }
  if (!first) throw new Error("文件读取失败。");
  return { content: chunks.join(""), file: first.file };
}

export function useExternalDocumentChanges(options: {
  bookId(): string;
  fileId(): string | undefined;
  state: ComputedRef<LongDocumentState | undefined>;
  read?: (bookId: string, fileId: string) => Promise<Snapshot>;
  captureView(): unknown;
  restoreView(
    snapshot: unknown,
    previous: string,
    merged: string
  ): Promise<void>;
  persistRecovery(key: string): void;
  clearRecovery(key: string, bookId: string, fileId: string): void;
}) {
  const noticeKey = ref<string | null>(null);
  const busy = ref(false);
  const error = ref<string | null>(null);
  const currentKey = () => {
    const id = options.fileId();
    return id ? `${options.bookId()}\u0000${id}` : null;
  };
  const changed = computed(
    () => noticeKey.value !== null && noticeKey.value === currentKey()
  );
  let pendingCheck: Promise<void> | null = null;
  let timer: ReturnType<typeof setInterval> | undefined;

  async function read(key: string): Promise<Snapshot | undefined> {
    const [bookId, fileId] = key.split("\u0000");
    if (!bookId || !fileId) return undefined;
    return await (options.read ?? readCompleteDocument)(bookId, fileId);
  }

  async function check(): Promise<void> {
    if (pendingCheck) return await pendingCheck;
    const key = currentKey();
    const state = options.state.value;
    if (!key || !state?.loaded || state.loading || state.saving) return;
    const task = (async () => {
      try {
        const remote = await read(key);
        if (!remote || currentKey() !== key) return;
        const current = options.state.value;
        if (
          !current ||
          current.saving ||
          current.bookId + "\u0000" + current.file.id !== key
        )
          return;
        current.externalChanged = remote.content !== current.savedContent;
        noticeKey.value = current.externalChanged ? key : null;
        error.value = null;
      } catch (cause) {
        if (currentKey() === key)
          error.value =
            cause instanceof Error ? cause.message : "检查文件变化失败。";
      }
    })();
    pendingCheck = task;
    try {
      await task;
    } finally {
      if (pendingCheck === task) pendingCheck = null;
    }
  }

  async function reload(): Promise<void> {
    const key = currentKey();
    if (!key || !changed.value || busy.value) return;
    busy.value = true;
    const viewport = options.captureView();
    try {
      const remote = await read(key);
      if (!remote || currentKey() !== key) return;
      const state = options.state.value;
      if (!state || state.bookId + "\u0000" + state.file.id !== key) return;
      const previous = state.content;
      const merged = mergeExternalDocument(
        state.savedContent,
        previous,
        remote.content
      );
      state.content = merged.content;
      state.savedContent = remote.content;
      state.file = remote.file;
      state.mergeConflict = merged.conflicts;
      state.externalChanged = false;
      noticeKey.value = null;
      error.value = null;
      if (state.content === state.savedContent)
        options.clearRecovery(key, state.bookId, state.file.id);
      else options.persistRecovery(key);
      await options.restoreView(viewport, previous, merged.content);
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : "重新加载失败。";
      throw cause;
    } finally {
      busy.value = false;
    }
  }

  function resolveConflict(): boolean {
    const state = options.state.value;
    if (!state?.mergeConflict) return true;
    if (
      /^(?:<<<<<<< 本地未保存|=======|>>>>>>> 外部修改)$/mu.test(state.content)
    )
      return false;
    state.mergeConflict = false;
    return true;
  }

  watch(
    currentKey,
    () => {
      noticeKey.value = null;
      error.value = null;
      if (timer) clearInterval(timer);
      if (currentKey()) {
        timer = setInterval(() => void check(), 3000);
        void check();
      }
    },
    { immediate: true }
  );
  onScopeDispose(() => {
    if (timer) clearInterval(timer);
  });
  return { changed, busy, error, check, reload, resolveConflict };
}
