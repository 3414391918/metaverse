import { effectScope, reactive } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TextViewMode } from "@deepwrite/contracts";
import { useTextViewMode } from "./useTextViewMode";
import {
  clearLongEditorViewMemory,
  useLongEditorViewSession
} from "./useLongEditorViewSession";

const scopes: ReturnType<typeof effectScope>[] = [];
beforeEach(clearLongEditorViewMemory);
afterEach(() => scopes.splice(0).forEach((scope) => scope.stop()));
function mount(
  bookId = "book_a",
  fileId = "file_a",
  defaultMode: TextViewMode = "edit",
  editOnly = false
) {
  const props = reactive({
    bookId,
    file: { id: fileId, updatedAt: 1 },
    defaultMode,
    readOnly: false
  });
  const mode = useTextViewMode({ defaultMode: () => props.defaultMode });
  const changed = vi.fn();
  const scope = effectScope();
  scopes.push(scope);
  scope.run(() =>
    useLongEditorViewSession({
      documentKey: () => `${props.bookId}:${props.file.id}`,
      defaultMode: () => props.defaultMode,
      readOnly: () => props.readOnly,
      editOnly,
      ...mode,
      onDocumentChange: changed
    })
  );
  return { props, mode, scope, changed };
}

describe("long editor view session", () => {
  it("preserves preview and editor history when a focus refresh replaces file objects", () => {
    const editor = mount();
    editor.mode.setViewMode("preview");
    editor.changed.mockClear();
    editor.props.file = { ...editor.props.file, updatedAt: 2 };
    expect(editor.mode.viewMode.value).toBe("preview");
    expect(editor.changed).not.toHaveBeenCalled();
  });
  it("restores preview when the workspace is unmounted and reopened", () => {
    const first = mount();
    first.mode.setViewMode("preview");
    first.scope.stop();
    expect(mount().mode.viewMode.value).toBe("preview");
  });
  it("remembers each document independently and applies the default to unseen documents", () => {
    const editor = mount();
    editor.mode.setViewMode("preview");
    editor.props.file = { id: "file_b", updatedAt: 1 };
    expect(editor.mode.viewMode.value).toBe("edit");
    editor.props.file = { id: "file_a", updatedAt: 1 };
    expect(editor.mode.viewMode.value).toBe("preview");
    expect(mount("book_b").mode.viewMode.value).toBe("edit");
  });
  it("preserves a manual edit choice with a preview default", () => {
    const first = mount("book_a", "file_a", "preview");
    first.mode.setViewMode("edit");
    first.scope.stop();
    expect(mount("book_a", "file_a", "preview").mode.viewMode.value).toBe(
      "edit"
    );
  });
  it("still applies an explicit default setting change and read-only restrictions", () => {
    const editor = mount();
    editor.mode.setViewMode("preview");
    editor.props.defaultMode = "preview";
    editor.props.defaultMode = "edit";
    expect(editor.mode.viewMode.value).toBe("edit");
    editor.props.readOnly = true;
    expect(editor.mode.viewMode.value).toBe("preview");
  });
  it("keeps an edit-only workspace in edit mode across refreshes and read-only files", () => {
    const editor = mount("book_a", "file_a", "preview", true);
    expect(editor.mode.viewMode.value).toBe("edit");
    editor.mode.setViewMode("preview");
    expect(editor.mode.viewMode.value).toBe("edit");
    editor.props.readOnly = true;
    editor.props.file = { id: "file_b", updatedAt: 1 };
    expect(editor.mode.viewMode.value).toBe("edit");
  });
});
