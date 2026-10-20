import { describe, expect, it } from "vitest";
import {
  replaceChapterVisualText,
  splitChapterVisualSegments
} from "./chapterVisualSegments";

describe("chapter visual segments", () => {
  const resolve = (source: string) =>
    source.startsWith("images/")
      ? `deepwrite-image://book/test/${source}`
      : undefined;

  it("keeps the exact Markdown source and offsets around chapter images", () => {
    const source = "甲\n\n![](images/001.png)\n\n乙\n![](images/002.png)\n";
    const parts = splitChapterVisualSegments(source, resolve);

    expect(parts.map((part) => part.source).join("")).toBe(source);
    expect(parts.map((part) => part.kind)).toEqual([
      "text",
      "image",
      "text",
      "image",
      "text"
    ]);
    expect(parts[2]).toMatchObject({
      kind: "text",
      start: source.indexOf("\n\n乙"),
      source: "\n\n乙\n"
    });
  });

  it("leaves unsupported and incomplete image syntax editable as source", () => {
    const source = "前 ![](https://example.test/a.png) 后 ![](images/missing";
    expect(splitChapterVisualSegments(source, resolve)).toEqual([
      { kind: "text", start: 0, end: source.length, source }
    ]);
  });

  it("replaces only the edited text segment without changing image references", () => {
    const source = "开头\n\n![](images/001.png)\n\n结尾";
    const parts = splitChapterVisualSegments(source, resolve);
    const last = parts[2]!;
    expect(replaceChapterVisualText(source, last, "\n\n新结尾")).toBe(
      "开头\n\n![](images/001.png)\n\n新结尾"
    );
  });

  it("provides editable text before and after an image-only chapter", () => {
    const source = "![](images/001.png)";
    const parts = splitChapterVisualSegments(source, resolve);
    expect(parts.map((part) => part.kind)).toEqual(["text", "image", "text"]);
    expect(parts[0]).toMatchObject({ start: 0, end: 0, source: "" });
    expect(parts[2]).toMatchObject({
      start: source.length,
      end: source.length,
      source: ""
    });
  });
  it("keeps video references at their exact source offsets", () => {
    const source = "开头\n\n!video[](videos/001.mp4)\n\n结尾";
    const parts = splitChapterVisualSegments(source, (value) =>
      value.startsWith("videos/")
        ? `deepwrite-image://book/test/${value}`
        : undefined
    );
    expect(parts.map((part) => part.kind)).toEqual(["text", "video", "text"]);
    expect(parts.map((part) => part.source).join("")).toBe(source);
    expect(parts[1]).toMatchObject({
      kind: "video",
      start: source.indexOf("!video"),
      imageSource: "videos/001.mp4"
    });
  });
});
