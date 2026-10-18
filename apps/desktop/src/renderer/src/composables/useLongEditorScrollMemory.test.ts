import { effectScope, nextTick, ref } from "vue";
import { beforeEach, describe, expect, it } from "vitest";
import { clearEditorScrollMemory } from "../utils/editorScrollMemory";
import { rememberEditorScrollPosition } from "../utils/editorScrollMemory";
import {
  longEditorScrollMemoryKey,
  useLongEditorScrollMemory,
  type LongEditorScrollIdentity
} from "./useLongEditorScrollMemory";
import { useLongEditorViewport } from "./useLongEditorViewport";

function identity(
  overrides: Partial<LongEditorScrollIdentity> = {}
): LongEditorScrollIdentity {
  return {
    bookId: "book-1",
    selectionKey: "worldbuilding:rules",
    fileId: "file-1",
    worldbuildingItemId: "rule-1",
    bookLineVolumeId: "",
    bookLineContentTab: "outline",
    plotPointId: "",
    plotPointTab: "summary",
    storyPlotId: "",
    chapterCardId: "",
    ...overrides
  };
}

function scrollElement(scrollTop = 0): HTMLElement {
  return { scrollTop } as HTMLElement;
}

async function flushScrollRestore(): Promise<void> {
  await nextTick();
  await nextTick();
}

beforeEach(() => {
  clearEditorScrollMemory();
});

describe("long editor scroll memory", () => {
  it("remembers the visible chapter scroller instead of its hidden source textarea", async () => {
    const scope = effectScope();
    const first = longEditorScrollMemoryKey(identity({ fileId: "body-1" }));
    const second = longEditorScrollMemoryKey(identity({ fileId: "body-2" }));
    const key = ref(first);
    const preview = scrollElement(540);
    const hidden = scrollElement(0) as HTMLTextAreaElement;
    const memory = scope.run(() =>
      useLongEditorViewport({
        documentKey: () => key.value,
        viewMode: ref("edit"),
        editorInput: ref(hidden),
        documentPreview: ref(preview),
        visualMode: () => true,
        contentReady: () => true
      })
    )!;
    memory.handleScroll({ currentTarget: preview } as unknown as Event);
    key.value = second;
    await flushScrollRestore();
    expect(preview.scrollTop).toBe(0);
    key.value = first;
    await flushScrollRestore();
    expect(preview.scrollTop).toBe(540);
    scope.stop();
  });
  it("waits for preview content and ignores layout scroll events during loading", async () => {
    const scope = effectScope();
    const key = longEditorScrollMemoryKey(identity());
    rememberEditorScrollPosition(key, "preview", 760);
    const ready = ref(false);
    const preview = scrollElement();
    const memory = scope.run(() =>
      useLongEditorViewport({
        documentKey: () => key,
        viewMode: ref("preview"),
        editorInput: ref(null),
        documentPreview: ref(preview),
        contentReady: () => ready.value
      })
    )!;
    await memory.restoreScroll();
    expect(preview.scrollTop).toBe(0);
    memory.handleScroll({ currentTarget: preview } as unknown as Event);
    ready.value = true;
    await flushScrollRestore();
    expect(preview.scrollTop).toBe(760);
    scope.stop();
  });
  it("restores a reopened preview when its element appears after document loading", async () => {
    const scope = effectScope();
    const key = longEditorScrollMemoryKey(identity());
    rememberEditorScrollPosition(key, "preview", 760);
    const preview = ref<HTMLElement | null>(null);
    scope.run(() =>
      useLongEditorViewport({
        documentKey: () => key,
        viewMode: ref("preview"),
        editorInput: ref(null),
        documentPreview: preview,
        contentReady: () => true
      })
    );
    await flushScrollRestore();
    preview.value = scrollElement();
    await flushScrollRestore();
    expect(preview.value.scrollTop).toBe(760);
    scope.stop();
  });
  it("starts an unseen item at the top and restores each previous position", async () => {
    const scope = effectScope();
    const firstKey = longEditorScrollMemoryKey(identity());
    const activeKey = ref(firstKey);
    const editor = scrollElement(640) as HTMLTextAreaElement;
    const memory = scope.run(() =>
      useLongEditorScrollMemory({
        documentKey: () => activeKey.value,
        viewMode: ref("edit"),
        editorInput: ref(editor),
        documentPreview: ref(null)
      })
    );
    expect(memory).toBeDefined();
    memory!.handleScroll({ currentTarget: editor } as unknown as Event);

    const secondKey = longEditorScrollMemoryKey(
      identity({ fileId: "file-2", worldbuildingItemId: "rule-2" })
    );
    activeKey.value = secondKey;
    await nextTick();
    editor.scrollTop = 640;
    memory!.handleScroll({ currentTarget: editor } as unknown as Event);
    await nextTick();
    expect(editor.scrollTop).toBe(0);

    editor.scrollTop = 180;
    memory!.handleScroll({ currentTarget: editor } as unknown as Event);
    activeKey.value = firstKey;
    await flushScrollRestore();
    expect(editor.scrollTop).toBe(640);

    activeKey.value = secondKey;
    await flushScrollRestore();
    expect(editor.scrollTop).toBe(180);
    scope.stop();
  });

  it("isolates editing and preview positions for the same item", async () => {
    const scope = effectScope();
    const viewMode = ref<"edit" | "preview">("edit");
    const editor = scrollElement(320) as HTMLTextAreaElement;
    const preview = scrollElement(0);
    const memory = scope.run(() =>
      useLongEditorScrollMemory({
        documentKey: () => longEditorScrollMemoryKey(identity()),
        viewMode,
        editorInput: ref(editor),
        documentPreview: ref(preview)
      })
    );
    memory!.handleScroll({ currentTarget: editor } as unknown as Event);

    viewMode.value = "preview";
    await flushScrollRestore();
    expect(preview.scrollTop).toBe(0);
    preview.scrollTop = 95;
    memory!.handleScroll({ currentTarget: preview } as unknown as Event);

    viewMode.value = "edit";
    await flushScrollRestore();
    expect(editor.scrollTop).toBe(320);

    viewMode.value = "preview";
    await flushScrollRestore();
    expect(preview.scrollTop).toBe(95);
    scope.stop();
  });

  it("uses the item, chapter, plot, and book identities in the key", () => {
    const base = longEditorScrollMemoryKey(identity());
    expect(
      longEditorScrollMemoryKey(identity({ worldbuildingItemId: "rule-2" }))
    ).not.toBe(base);
    expect(
      longEditorScrollMemoryKey(identity({ chapterCardId: "chapter-2" }))
    ).not.toBe(base);
    expect(
      longEditorScrollMemoryKey(identity({ storyPlotId: "story-2" }))
    ).not.toBe(base);
    expect(longEditorScrollMemoryKey(identity({ bookId: "book-2" }))).not.toBe(
      base
    );
  });
});
