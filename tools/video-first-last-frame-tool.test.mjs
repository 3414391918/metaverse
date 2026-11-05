import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repository = new URL("../", import.meta.url).pathname;
const directory = join(
  repository,
  "toolkit/defaults/video-first-last-frame"
);

describe("影视设计（首尾帧）默认工具模板", () => {
  it("保留两帧身份、预览、绝对路径和独立提示词约束", async () => {
    const manifest = JSON.parse(
      await readFile(join(directory, "tool.json"), "utf8")
    );
    const skill = await readFile(join(directory, "SKILL.md"), "utf8");
    const template = await readFile(
      join(directory, "prompt-template.md"),
      "utf8"
    );

    expect(manifest).toMatchObject({
      version: 1,
      id: "video-first-last-frame",
      name: "影视设计（首尾帧）",
      entryFile: "SKILL.md",
      relatedToolIds: ["creation", "video"]
    });
    for (const marker of [
      "首帧（image 1）",
      "尾帧（image 2）",
      "Markdown 图片预览",
      "绝对路径",
      "独立使用",
      "正文情节",
      "人物设定"
    ])
      expect(`${skill}\n${template}`).toContain(marker);
    expect(template).toContain("![首帧预览](首帧绝对路径)");
    expect(template).toContain("![尾帧预览](尾帧绝对路径)");
    expect(template).toContain("不得写“如上图”");
  });
});
