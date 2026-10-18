import { describe, expect, it } from "vitest";
import { longChapterImageUrl } from "./longChapterImageUrl";

describe("longChapterImageUrl", () => {
  const body = `long/chapters/${"a".repeat(32)}/body.md`;

  it("maps a chapter-relative image to its registered-book protocol URL", () => {
    expect(
      longChapterImageUrl("longbook_example", body, "images/001.png")
    ).toBe(`deepwrite-image://book/longbook_example/${"a".repeat(32)}/001.png`);
  });

  it("resolves images from an indexed chapter-id directory", () => {
    expect(
      longChapterImageUrl(
        "longbook_example",
        "long/chapters/chapter_071894ed/body.md",
        "images/001.png"
      )
    ).toBe("deepwrite-image://book/longbook_example/chapter_071894ed/001.png");
  });

  it("rejects paths outside the selected chapter images directory", () => {
    expect(
      longChapterImageUrl("longbook_example", body, "../secret.png")
    ).toBeUndefined();
    expect(
      longChapterImageUrl("longbook_example", body, "images/../../secret.png")
    ).toBeUndefined();
    expect(
      longChapterImageUrl("longbook_example", body, "https://example.com/a.png")
    ).toBeUndefined();
    expect(
      longChapterImageUrl("longbook_example", body, "images/vector.svg")
    ).toBeUndefined();
    expect(
      longChapterImageUrl(
        "longbook_example",
        "stages/draft.md",
        "images/001.png"
      )
    ).toBeUndefined();
  });
});
