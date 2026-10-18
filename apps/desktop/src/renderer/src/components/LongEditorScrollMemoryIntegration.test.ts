import { describe, expect, it } from "vitest";
import manuscriptSource from "./LongManuscriptEditor.vue?raw";
import workspaceEditorSource from "./LongWorkspaceEditor.vue?raw";
import viewportSource from "../composables/useLongEditorViewport.ts?raw";

describe("long editor scroll-memory integration", () => {
  it("connects every long-form text surface to per-entry scroll memory", () => {
    expect(workspaceEditorSource).toContain("useLongEditorViewport({");
    expect(viewportSource).toContain("useLongEditorScrollMemory({");
    expect(workspaceEditorSource).toContain("worldbuildingItemId:");
    expect(workspaceEditorSource).toContain("chapterCardId:");
    expect(workspaceEditorSource).toContain(
      '@editor-scroll="handleEditorScroll"'
    );
    expect(workspaceEditorSource).toContain('@scroll="handleEditorScroll"');
    expect(manuscriptSource).toContain(
      "previewElementChange: [element: HTMLElement | null]"
    );
    expect(manuscriptSource).toContain("editorScroll: [event: Event]");
    expect(manuscriptSource).toContain("emit('editorScroll', $event)");
  });
});
