import { describe, expect, it } from "vitest";
import moduleSource from "./LongWorkspaceModule.vue?raw";
import editorSource from "./LongWorkspaceEditor.vue?raw";
import manuscriptSource from "./LongManuscriptEditor.vue?raw";
import menuSource from "../../../main/text-context-menu-items.ts?raw";

describe("long editor selection insertion", () => {
  it("offers the shared right-click action from every long-form text editor", () => {
    expect(
      editorSource.match(/@contextmenu="handleEditorContextMenu"/g)
    ).toHaveLength(3);
    expect(editorSource).not.toContain(
      '@contextmenu="handlePreviewContextMenu"'
    );
    expect(editorSource).toContain(
      '@preview-contextmenu="handlePreviewContextMenu"'
    );
    expect(manuscriptSource).toContain('@contextmenu="handleContextMenu"');
    expect(manuscriptSource).toContain('emit("contextmenu", event)');
    expect(manuscriptSource).toContain(
      "@contextmenu=\"emit('previewContextmenu', $event)\""
    );
    expect(editorSource).not.toContain("<EditorSelectionMenu");
    expect(menuSource).toContain("插入输入框");
    expect(editorSource).toContain('emit("insertSelection", reference)');
  });

  it("disables the composer action without removing native editing or illustrations", () => {
    expect(moduleSource).not.toContain(":editor-references");
    expect(moduleSource).not.toContain("@insert-selection");
    expect(editorSource).toContain("allowReferences: false");
    expect(editorSource).toContain("handleEditorContextMenu");
    expect(editorSource).toContain("useLongEditorIllustrationCommit");
  });
});
