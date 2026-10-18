import { afterEach, expect, it, vi } from "vitest";
import { pastedImagePng, singlePastedImage } from "./clipboard-image";
afterEach(() => vi.unstubAllGlobals());
it("accepts exactly one image and refuses multiple files or text", () => {
  const image = new File([new Uint8Array([1, 2])], "image.png", {
    type: "image/png"
  });
  expect(singlePastedImage([image])).toBe(image);
  expect(() => singlePastedImage([image, image])).toThrow("一张");
  expect(() => singlePastedImage([])).toThrow("一张");
  expect(() =>
    singlePastedImage([new File(["text"], "text.txt", { type: "text/plain" })])
  ).toThrow("一张");
});

function setupDecode(failDecode = false) {
  const png = "data:image/png;base64,AQID";
  const readAsDataURL = vi.fn();
  vi.stubGlobal(
    "FileReader",
    class {
      result: string | null = null;
      onload: (() => void) | null = null;
      readAsDataURL(file: File) {
        readAsDataURL(file);
        this.result = png;
        this.onload?.();
      }
    }
  );
  vi.stubGlobal(
    "Image",
    class {
      src = "";
      naturalWidth = 2;
      naturalHeight = 1;
      async decode() {
        // The real page allows data: images and rejects blob: image URLs.
        if (!this.src.startsWith("data:") || failDecode)
          throw new DOMException("The source image cannot be decoded.");
      }
    }
  );
  const drawImage = vi.fn();
  vi.stubGlobal("document", {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({ drawImage }),
      toDataURL: () => png
    })
  });
  const file = new File([new Uint8Array([1, 2, 3])], "clipboard.png", {
    type: "image/png"
  });
  return { file, png, readAsDataURL, drawImage };
}

it("decodes a pasted File using an image URL allowed by the page security policy", async () => {
  const { file, png, readAsDataURL, drawImage } = setupDecode();
  await expect(pastedImagePng(file)).resolves.toBe(png);
  expect(readAsDataURL).toHaveBeenCalledWith(file);
  expect(drawImage).toHaveBeenCalledTimes(1);
});

it("explains invalid image data in Chinese without drawing a replacement", async () => {
  const { file, drawImage } = setupDecode(true);
  await expect(pastedImagePng(file)).rejects.toThrow("无法解码粘贴的图片");
  expect(drawImage).not.toHaveBeenCalled();
});
