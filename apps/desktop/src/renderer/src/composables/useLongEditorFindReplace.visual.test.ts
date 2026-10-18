import { computed, effectScope, nextTick, ref } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useLongEditorFindReplace } from "./useLongEditorFindReplace";

const scopes: ReturnType<typeof effectScope>[] = [];
afterEach(() => scopes.splice(0).forEach((scope) => scope.stop()));

describe("visual chapter find", () => {
  it("selects a Markdown text match in the visible chapter editor", async () => {
    const content = ref("前文\n\n![](images/001.png)\n\n后文");
    const focus = vi.fn();
    const scope = effectScope();
    scopes.push(scope);
    const api = scope.run(() =>
      useLongEditorFindReplace({
        currentVisibleContent: computed(() => content.value),
        currentReadOnly: computed(() => false),
        canUseTextTools: computed(() => true),
        viewMode: ref("edit"),
        editorInput: ref(null),
        editorToolsElement: ref(undefined),
        updateVisibleContent: (value) => {
          content.value = value;
        },
        updateVisibleCharacterCount: vi.fn(),
        recordProgrammaticChange: vi.fn(),
        undo: vi.fn(),
        redo: vi.fn(),
        closeStoryPlotActionMenu: vi.fn(),
        storyPlotActionMenuId: ref(null),
        visualMode: () => true,
        visualSelection: () => ({ start: 0, end: 0 }),
        visualFocusRange: focus
      })
    )!;

    await api.toggleFindPanel("find");
    api.searchQuery.value = "后文";
    api.findMatch(1);
    await nextTick();
    expect(focus).toHaveBeenCalledWith(
      content.value.indexOf("后文"),
      content.value.indexOf("后文") + 2
    );
  });
});
