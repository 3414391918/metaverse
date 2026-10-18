import { describe, expect, it } from "vitest";
import {
  mapMergedOffset,
  mergeExternalDocument
} from "./mergeExternalDocument";

describe("external document merge", () => {
  it("keeps both independent local edits and external image insertions", () => {
    const base = "first\nsecond\nthird\n";
    const local = "first\nsecond revised\nthird\n";
    const remote = "first\nsecond\n![](images/001.png)\nthird\n";
    expect(mergeExternalDocument(base, local, remote)).toEqual({
      content: "first\nsecond revised\n![](images/001.png)\nthird\n",
      conflicts: false
    });
  });

  it("preserves local words written after an external image deletion", () => {
    expect(
      mergeExternalDocument(
        "before\n\n![](images/001.png)\n\nafter",
        "before\n\n![](images/001.png)\n\nafter\nnew words",
        "before\n\nafter"
      )
    ).toEqual({ content: "before\n\nafter\nnew words", conflicts: false });
  });

  it("marks simultaneous changes to the same line and keeps both texts", () => {
    const result = mergeExternalDocument("old\n", "my edit\n", "agent edit\n");
    expect(result.conflicts).toBe(true);
    expect(result.content).toContain("my edit");
    expect(result.content).toContain("agent edit");
  });

  it("maps the caret to the same sentence after an earlier insertion", () => {
    const local = "first\nmy sentence\n";
    const merged = "first\n![](images/001.png)\nmy sentence\n";
    expect(mapMergedOffset(local, merged, local.indexOf("sentence") + 4)).toBe(
      merged.indexOf("sentence") + 4
    );
  });

  it("keeps the caret in a later occurrence of repeated text", () => {
    const before = "same words\nother words\nsame words\n";
    const after = "new intro\n" + before;
    const offset = before.lastIndexOf("same words") + 4;
    expect(mapMergedOffset(before, after, offset)).toBe(
      after.lastIndexOf("same words") + 4
    );
  });
});
