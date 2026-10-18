import {
  LONG_CHAPTER_IMAGE_MAX_BYTES,
  LONG_CHAPTER_IMAGE_MAX_PIXELS
} from "@deepwrite/contracts";
export function singlePastedImage(files: readonly File[]): File {
  if (files.length !== 1 || !files[0]?.type.startsWith("image/"))
    throw new Error("请只粘贴一张图片。");
  const file = files[0];
  if (file.size > LONG_CHAPTER_IMAGE_MAX_BYTES)
    throw new Error("图片超过 100 MB 大小限制。");
  return file;
}
export async function pastedImagePng(file: File): Promise<string> {
  // data: images are allowed by the page CSP; blob: image URLs are not.
  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("无法读取粘贴的图片。"));
    };
    reader.onerror = () => reject(new Error("无法读取粘贴的图片。"));
    reader.onabort = () => reject(new Error("读取粘贴图片已取消。"));
    reader.readAsDataURL(file);
  });
  const image = new Image();
  image.src = source;
  try {
    await image.decode();
  } catch {
    throw new Error("无法解码粘贴的图片，请重新复制图片后再粘贴。");
  }
  if (
    !image.naturalWidth ||
    image.naturalWidth * image.naturalHeight > LONG_CHAPTER_IMAGE_MAX_PIXELS
  )
    throw new Error("图片尺寸过大，最多支持 4000 万像素。");
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法读取粘贴图片。");
  ctx.drawImage(image, 0, 0);
  return canvas.toDataURL("image/png");
}
