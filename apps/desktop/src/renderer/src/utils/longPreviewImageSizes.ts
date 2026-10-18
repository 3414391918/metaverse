interface ImageSize {
  width: number;
  height: number;
}
const sizes = new Map<string, Map<string, ImageSize>>();
const MAX_DOCUMENTS = 500;

function images(element: unknown): HTMLImageElement[] {
  const preview = element as Partial<HTMLElement> | null;
  return typeof preview?.querySelectorAll === "function"
    ? Array.from(preview.querySelectorAll<HTMLImageElement>("img"))
    : [];
}
function source(image: HTMLImageElement): string {
  const src = image.getAttribute("src") ?? "";
  return src.startsWith("deepwrite-image:")
    ? src.replace(/\?v=[a-f0-9]{64}$/u, "")
    : src;
}

export function clearLongPreviewImageSizes(): void {
  sizes.clear();
}

/** Reserve previously loaded image dimensions until the new preview decodes. */
export function rememberLongPreviewImageSizes(
  key: string,
  element: unknown
): void {
  const remembered = sizes.get(key) ?? new Map<string, ImageSize>();
  for (const image of images(element).slice(0, 500)) {
    if (image.naturalWidth > 0 && image.naturalHeight > 0) {
      remembered.set(source(image), {
        width: image.naturalWidth,
        height: image.naturalHeight
      });
    }
  }
  sizes.delete(key);
  sizes.set(key, remembered);
  if (sizes.size > MAX_DOCUMENTS) {
    const oldest = sizes.keys().next().value;
    if (oldest !== undefined) sizes.delete(oldest);
  }
}

export function restoreLongPreviewImageSizes(
  key: string,
  element: unknown
): void {
  const remembered = sizes.get(key);
  if (!remembered) return;
  for (const image of images(element)) {
    const size = remembered.get(source(image));
    if (
      !size ||
      (image.complete && image.naturalWidth > 0) ||
      image.hasAttribute("width") ||
      image.hasAttribute("height")
    )
      continue;
    image.setAttribute("width", String(size.width));
    image.setAttribute("height", String(size.height));
    const decoded = () => {
      image.removeAttribute("width");
      image.removeAttribute("height");
      image.removeEventListener("load", decoded);
      image.removeEventListener("error", decoded);
    };
    image.addEventListener("load", decoded, { once: true });
    image.addEventListener("error", decoded, { once: true });
  }
}
