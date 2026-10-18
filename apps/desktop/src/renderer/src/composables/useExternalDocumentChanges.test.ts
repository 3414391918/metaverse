import { computed, effectScope, ref } from "vue";
import { afterEach, expect, it, vi } from "vitest";
import { useExternalDocumentChanges } from "./useExternalDocumentChanges";
import type { LongDocumentState } from "./useLongEditorDocumentSession";

const scopes: ReturnType<typeof effectScope>[] = [];
afterEach(() => scopes.splice(0).forEach((scope) => scope.stop()));

it("prompts on an external change, then merges it with unsaved text", async () => {
  const file = {
    id: "file_body",
    path: "long/chapters/chapter_example/body.md",
    updatedAt: "2026-10-16T00:00:00.000Z"
  };
  const base = "first\nsecond\nthird\n";
  const state = ref<LongDocumentState>({
    bookId: "longbook_example",
    file,
    content: "first\nsecond revised\nthird\n",
    savedContent: base,
    loaded: true,
    loading: false,
    saving: false,
    loadError: null
  });
  const remote = "first\nsecond\n![](images/001.png)\nthird\n";
  const restore = vi.fn(async () => undefined);
  const scope = effectScope();
  scopes.push(scope);
  const watcher = scope.run(() =>
    useExternalDocumentChanges({
      bookId: () => "longbook_example",
      fileId: () => file.id,
      state: computed(() => state.value),
      read: vi.fn(async () => ({ content: remote, file })),
      captureView: () => ({ start: 12 }),
      restoreView: restore,
      persistRecovery: vi.fn(),
      clearRecovery: vi.fn()
    })
  )!;
  await watcher.check();
  expect(watcher.changed.value).toBe(true);
  expect(state.value.content).toBe("first\nsecond revised\nthird\n");
  await watcher.reload();
  expect(state.value.savedContent).toBe(remote);
  expect(state.value.content).toBe(
    "first\nsecond revised\n![](images/001.png)\nthird\n"
  );
  expect(watcher.changed.value).toBe(false);
  expect(restore).toHaveBeenCalledOnce();
});
