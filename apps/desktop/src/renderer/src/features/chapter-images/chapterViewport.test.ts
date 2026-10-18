import { expect, it, vi } from "vitest";
import { restoreChapterViewport } from "./chapterViewport";

it("keeps the same paragraph visible after an earlier image is inserted", () => {
  const paragraph = {
    dataset: { segmentStart: "26", segmentEnd: "40" },
    getBoundingClientRect: () => ({ top: 100, height: 80 })
  };
  const container = {
    scrollTop: 40,
    getBoundingClientRect: () => ({ top: 0 }),
    querySelectorAll: () => [paragraph]
  };
  const before = "first\nmy paragraph\n";
  const after = "first\n![](images/001.png)\nmy paragraph\n";
  restoreChapterViewport(
    container as unknown as HTMLElement,
    {
      scrollTop: 40,
      focused: false,
      anchorOffset: before.indexOf("paragraph")
    },
    before,
    after,
    vi.fn()
  );
  expect(container.scrollTop).toBeGreaterThan(100);
});
