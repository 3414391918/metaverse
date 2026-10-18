import { describe, expect, it } from "vitest";
import { expectSourceToContain } from "../../../test-utils/sourceText";
import dialogSource from "./ExportLongManuscriptDialog.vue?raw";
import chapterListSource from "./ExportLongManuscriptChapterList.vue?raw";

describe("ExportLongManuscriptDialog", () => {
  it("offers all four selectable long-form export sections", () => {
    expect(dialogSource).toContain('id: "worldbuilding"');
    expect(dialogSource).toContain('id: "characters"');
    expect(dialogSource).toContain('id: "plot"');
    expect(dialogSource).toContain('id: "manuscript"');
    expect(dialogSource).toContain("不使用内部 ID");
    expect(dialogSource).toContain("可勾选单章或多章，每章一个 TXT");
  });

  it("emits the selected sections together with manuscript chapter ids", () => {
    expectSourceToContain(
      dialogSource,
      "export: [request: LongManuscriptExportRequest]"
    );
    expect(dialogSource).toContain("manuscriptChapterCardIds");
    expect(dialogSource).toContain("<ExportLongManuscriptChapterList");
    expect(dialogSource).toContain('v-if="manuscriptSelected"');
    expect(dialogSource).toContain("getWorkspaceIndex");
    expect(dialogSource).toContain("listLongManuscriptExportChapters");
    expect(dialogSource).toContain("uiMessage.error");
    expect(dialogSource).not.toContain(
      'import("../utils/longManuscriptExport"'
    );
  });
});

describe("ExportLongManuscriptChapterList", () => {
  it("lets users select one chapter, many chapters, or a whole volume", () => {
    expect(chapterListSource).toContain("选择正文章节");
    expect(chapterListSource).toContain("全选");
    expect(chapterListSource).toContain("取消全选");
    expect(chapterListSource).toContain("toggleVolume");
    expect(chapterListSource).toContain("toggleChapter");
    expect(chapterListSource).toContain('type="checkbox"');
    expect(chapterListSource).not.toContain("<select");
    expect(chapterListSource).toContain("longManuscriptExportChapters");
  });
});
