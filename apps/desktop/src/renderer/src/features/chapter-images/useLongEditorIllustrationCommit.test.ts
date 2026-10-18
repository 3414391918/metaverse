import { computed, ref } from "vue";
import { expect, it, vi } from "vitest";
import type { LongWorkspaceFileReference } from "@deepwrite/contracts";
import type { LongDocumentState } from "../../composables/useLongEditorDocumentSession";
import type { LongWorkspaceSelection } from "../../types/longWorkspace";
import { useLongEditorIllustrationCommit } from "./useLongEditorIllustrationCommit";

it("offers insertion for a chapter body stored under its chapter id", () => {
  const chapterCardId = "chapter_071894ed";
  const imageContext = useLongEditorIllustrationCommit({
    bookId: () => "longbook_example",
    selection: () => ({ chapterCardId }) as LongWorkspaceSelection,
    selectedFile: computed(() => ({
      role: "body" as const,
      label: "正文",
      file: {
        path: `long/chapters/${chapterCardId}/body.md`
      } as LongWorkspaceFileReference
    })),
    currentState: computed(() => undefined),
    documentStates: ref({}),
    pending: ref(false),
    recordChange: vi.fn(),
    clearRecovery: vi.fn(),
    persistRecovery: vi.fn(),
    saved: vi.fn()
  }).imageContext;

  expect(imageContext.value).toEqual({
    bookId: "longbook_example",
    chapterCardId
  });
});

it("adopts a deleted image without discarding a later local edit", () => {
  const original = "before\n\n![](images/001.png)\n\nafter";
  const local = original + "\nnew words";
  const key = "longbook_example\u0000file_body";
  const documentStates = ref<Record<string, LongDocumentState>>({
    [key]: {
      bookId: "longbook_example",
      file: {
        id: "file_body",
        path: "long/chapters/chapter_example/body.md",
        updatedAt: "2026-10-16T00:00:00.000Z"
      },
      content: local,
      savedContent: original,
      loaded: true,
      loading: false,
      saving: false,
      loadError: null
    }
  });
  const recovery = vi.fn();
  const editor = useLongEditorIllustrationCommit({
    bookId: () => "longbook_example",
    selection: () =>
      ({ chapterCardId: "chapter_example" }) as LongWorkspaceSelection,
    selectedFile: computed(() => undefined),
    currentState: computed(() => documentStates.value[key]),
    documentStates,
    pending: ref(false),
    recordChange: vi.fn(),
    clearRecovery: vi.fn(),
    persistRecovery: recovery,
    saved: vi.fn()
  });
  editor.acceptDeletion(
    {
      content: "before\n\nafter",
      fileDeleted: true,
      selectionOffset: 8,
      document: {
        bookId: "longbook_example",
        file: documentStates.value[key]!.file,
        summary: {} as never
      }
    },
    original
  );
  expect(documentStates.value[key]!.content).toBe("before\n\nafter\nnew words");
  expect(documentStates.value[key]!.savedContent).toBe("before\n\nafter");
  expect(recovery).toHaveBeenCalledWith(key);
});
