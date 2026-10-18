import { beforeEach, expect, it } from "vitest";
import {
  clearLongPreviewImageSizes,
  rememberLongPreviewImageSizes,
  restoreLongPreviewImageSizes
} from "./longPreviewImageSizes";

beforeEach(clearLongPreviewImageSizes);
function image(revision: string, loaded = false) {
  const element = new EventTarget();
  const attributes = new Map<string, string>([
    [
      "src",
      `deepwrite-image://book/book/chapter/sample.png?v=${revision.repeat(64)}`
    ]
  ]);
  return Object.assign(element, {
    naturalWidth: loaded ? 3072 : 0,
    naturalHeight: loaded ? 2048 : 0,
    complete: loaded,
    getAttribute: (name: string) => attributes.get(name) ?? null,
    hasAttribute: (name: string) => attributes.has(name),
    setAttribute: (name: string, value: string) => attributes.set(name, value),
    removeAttribute: (name: string) => attributes.delete(name)
  }) as unknown as HTMLImageElement;
}
const preview = (...images: HTMLImageElement[]) => ({
  querySelectorAll: () => images
});

it("reserves the same image's size across refreshed URLs, then releases it after decoding", () => {
  rememberLongPreviewImageSizes("chapter", preview(image("a", true)));
  const fresh = image("b");
  restoreLongPreviewImageSizes("chapter", preview(fresh));
  expect(fresh.getAttribute("width")).toBe("3072");
  expect(fresh.getAttribute("height")).toBe("2048");
  fresh.dispatchEvent(new Event("load"));
  expect(fresh.hasAttribute("width")).toBe(false);
  expect(fresh.hasAttribute("height")).toBe(false);
});
it("isolates documents and leaves explicit or already decoded sizes alone", () => {
  rememberLongPreviewImageSizes("chapter", preview(image("a", true)));
  const other = image("b");
  restoreLongPreviewImageSizes("other-chapter", preview(other));
  expect(other.hasAttribute("width")).toBe(false);
  other.setAttribute("width", "100");
  restoreLongPreviewImageSizes("chapter", preview(other));
  expect(other.getAttribute("width")).toBe("100");
  const loaded = image("b", true);
  restoreLongPreviewImageSizes("chapter", preview(loaded));
  expect(loaded.hasAttribute("width")).toBe(false);
});
