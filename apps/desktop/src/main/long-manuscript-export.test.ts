import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import {
  safeLongExportName,
  writeLongManuscriptExport
} from "./long-manuscript-export";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true }))
  );
});

describe("long manuscript folder export", () => {
  it("uses display labels, creates list folders, and resolves duplicate names", async () => {
    const parent = await mkdtemp(join(tmpdir(), "deepwrite-long-export-"));
    temporaryDirectories.push(parent);
    const result = await writeLongManuscriptExport(parent, {
      title: "雾港:/长篇",
      sections: ["worldbuilding", "manuscript"],
      files: [
        { path: ["世界观", "势力", "巡夜司"], content: "第一份设定" },
        { path: ["世界观", "势力", "巡夜司"], content: "第二份设定" },
        { path: ["正文", "第一节"], content: "正文内容" }
      ]
    });

    expect(result.fileCount).toBe(3);
    expect(result.directoryPath).toContain("雾港 长篇-导出");
    expect(
      (await readdir(join(result.directoryPath, "世界观", "势力"))).sort()
    ).toEqual(["巡夜司 (2).txt", "巡夜司.txt"]);
    expect(
      await readFile(join(result.directoryPath, "正文", "第一节.txt"), "utf8")
    ).toBe("\ufeff正文内容");
  });

  it("sanitizes reserved and unsafe filename characters", () => {
    expect(safeLongExportName('  第一节:/\\*?<>|" ...  ')).toBe("第一节");
    expect(safeLongExportName("CON", "备用名")).toBe("备用名");
  });
});
