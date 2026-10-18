import { describe, expect, it } from "vitest";
import * as contracts from "./index";

describe("chapter image contracts", () => {
  const target = {
    bookId: "longbook_example",
    chapterCardId: "chapter_example",
    filename: "001.png"
  };
  it("accepts bounded chapter-local targets, rejecting traversal and extra fields", () => {
    expect(contracts.LongReadChapterImageInputSchema.parse(target)).toEqual(
      target
    );
    for (const filename of [
      "../001.png",
      "images/001.png",
      ".secret.png",
      "001.svg",
      "001.png?x=1"
    ]) {
      expect(
        contracts.LongReadChapterImageInputSchema.safeParse({
          ...target,
          filename
        }).success
      ).toBe(false);
    }
    expect(
      contracts.LongReadChapterImageInputSchema.safeParse({
        ...target,
        path: "/tmp/image.png"
      }).success
    ).toBe(false);
  });
  it("requires a canonical PNG clipboard value and the original revision", () => {
    const input = {
      ...target,
      pngDataUrl: "data:image/png;base64,iVBORw0KGgo=",
      expectedRevision: "a".repeat(64)
    };
    expect(
      contracts.LongReplaceChapterImageInputSchema.safeParse(input).success
    ).toBe(true);
    expect(
      contracts.LongReplaceChapterImageInputSchema.safeParse({
        ...input,
        pngDataUrl: "data:text/html;base64,AAAA"
      }).success
    ).toBe(false);
    expect(
      contracts.LongReplaceChapterImageInputSchema.safeParse({
        ...input,
        expectedRevision: ""
      }).success
    ).toBe(false);
  });
  it("requires a precise image occurrence and both document and image revisions for deletion", () => {
    const input = {
      ...target,
      offset: 10,
      expectedContent: "![](images/001.png)",
      expectedRevision: "a".repeat(64)
    };
    expect(
      contracts.LongDeleteChapterImageInputSchema.safeParse(input).success
    ).toBe(true);
    expect(
      contracts.LongDeleteChapterImageInputSchema.safeParse({
        ...input,
        offset: -1
      }).success
    ).toBe(false);
    expect(
      contracts.LongDeleteChapterImageInputSchema.safeParse({
        ...input,
        expectedRevision: ""
      }).success
    ).toBe(false);
  });
  it.each([0, 1, 2])(
    "validates multi-megabyte image payloads with padding variant %s without overflowing the stack",
    (extraBytes) => {
      const pngDataUrl =
        "data:image/png;base64," +
        "f39/".repeat(3 * 1024 * 1024) +
        ["", "fw==", "f38="][extraBytes];
      const values = [
        [
          contracts.LongReadChapterImageResultSchema,
          { pngDataUrl, revision: "a".repeat(64) }
        ],
        [contracts.LongReadClipboardImageResultSchema, { pngDataUrl }],
        [
          contracts.LongReplaceChapterImageInputSchema,
          { ...target, pngDataUrl, expectedRevision: "a".repeat(64) }
        ]
      ] as const;
      for (const [schema, value] of values) {
        expect(() => schema.safeParse(value)).not.toThrow();
        expect(schema.safeParse(value).success).toBe(true);
      }
    }
  );
  it.each([
    "",
    "A",
    "AAA",
    "AAAA=",
    "AAAA==",
    "A===",
    "AA=A",
    "AA-_",
    "AAA\n",
    "AAA=\n"
  ])("rejects malformed base64 payload %j", (encoded) => {
    expect(
      contracts.LongReadClipboardImageResultSchema.safeParse({
        pngDataUrl: `data:image/png;base64,${encoded}`
      }).success
    ).toBe(false);
  });
});
