import { ref } from "vue";
import { expect, it } from "vitest";
import { chapterVideoIpcTarget } from "./chapter-video-ipc-target";

it("passes a cloneable video target through the Electron context bridge", () => {
  const target = {
    bookId: "longbook_example",
    chapterCardId: "chapter_example",
    filename: "001.mp4"
  };
  const menu = ref({ target });

  expect(() => structuredClone(menu.value.target)).toThrow();
  expect(structuredClone(chapterVideoIpcTarget(menu.value.target))).toEqual(
    target
  );
});
