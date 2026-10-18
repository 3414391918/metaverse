import { describe, expect, it } from "vitest";
import { expectSourceToContain } from "../../../test-utils/sourceText";
import source from "./CreateLongVolumeDialog.vue?raw";

describe("CreateLongVolumeDialog", () => {
  it("uses a focused create form instead of the full structure manager", () => {
    expect(source).toContain("新建分卷");
    expect(source).toContain("分卷名称");
    expect(source).toContain("卷纲");
    expect(source).toContain('uiMessage.warning("请输入分卷名称。")');
    expect(source).toContain('<Teleport to="body">');
    expect(source).not.toContain("LongStructureManager");
  });

  it("warns that creating from the manuscript tree also creates the plot outline", () => {
    expect(source).toContain('source?: "book-line" | "draft"');
    expect(source).toContain('props.source === "draft"');
    expectSourceToContain(
      source,
      'fromDraft ? "正文" : "剧情设计 · 全书故事线"'
    );
    expectSourceToContain(
      source,
      "确认后，剧情阶段会同步生成对应卷纲。可在「剧情设计 → 全书故事线」中继续完善。"
    );
    expect(source).toContain(
      'pending ? "创建中…" : fromDraft ? "确认新建" : "创建分卷"'
    );
    expect(source).not.toContain("is-danger");
  });

  it("submits the title and initial outline", () => {
    expect(source).toContain(
      "submit: [input: { title: string; summary: string }]"
    );
    expect(source).toContain("title: normalizedTitle");
    expect(source).toContain("summary: summary.value");
  });
});
