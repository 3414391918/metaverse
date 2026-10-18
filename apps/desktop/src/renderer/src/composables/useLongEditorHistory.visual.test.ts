import { computed, effectScope, nextTick, reactive, ref } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LongWorkspaceSelectionFile } from "../types/longWorkspace";
import type { LongDocumentState } from "./useLongEditorDocumentSession";
import { useLongEditorHistory } from "./useLongEditorHistory";

const scopes: ReturnType<typeof effectScope>[] = [];
afterEach(() => scopes.splice(0).forEach((scope) => scope.stop()));

describe("visual chapter history", () => {
  it("records an inline text edit and restores the visible caret on undo", async () => {
    const original = "前文\n\n![](images/001.png)\n\n后文";
    const edited = "前文\n\n![](images/001.png)\n\n新后文";
    const caret = original.indexOf("后文");
    const state = reactive({
      bookId: "book-test",
      file: { id: "body-test" },
      content: original,
      savedContent: original,
      loaded: true,
      loading: false
    } as LongDocumentState);
    const states = ref<Record<string, LongDocumentState>>({
      "book-test\u0000body-test": state
    });
    const focus = vi.fn();
    const scope = effectScope();
    scopes.push(scope);
    const history = scope.run(() =>
      useLongEditorHistory({
        documentStates: states,
        currentState: computed(() => state),
        currentSelectionFile: computed(
          () => ({ file: state.file }) as LongWorkspaceSelectionFile
        ),
        currentVisibleContent: computed(() => state.content),
        currentReadOnly: computed(() => false),
        isDocumentContentBusy: computed(() => false),
        isDocumentSwitchPending: computed(() => false),
        canUseTextTools: computed(() => true),
        viewMode: ref("edit"),
        editorInput: ref(null),
        characterCount: ref(0),
        stateKey: () => "book-test\u0000body-test",
        updateVisibleContent: (content) => {
          state.content = content;
        },
        scrollEditorToRange: vi.fn(),
        clearRecoveryRecordForKey: vi.fn(),
        scheduleRecoveryWrite: vi.fn(),
        visualMode: () => true,
        visualSelection: () => ({ start: caret, end: caret }),
        visualFocusRange: focus
      })
    )!;

    history.recordVisualInput({
      content: edited,
      selectionBefore: { start: caret, end: caret },
      selectionAfter: { start: caret + 1, end: caret + 1 },
      inputType: "insertText",
      timestamp: 1
    });
    expect(state.content).toBe(edited);
    expect(history.textHistory.stats().undoEntries).toBe(1);
    expect(history.canUndo.value).toBe(true);
    history.undo();
    await nextTick();
    expect(state.content).toBe(original);
    expect(focus).toHaveBeenCalledWith(caret, caret);
  });
});
