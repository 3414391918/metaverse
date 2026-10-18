import type { LongCharacterAsset } from "@deepwrite/contracts";
export function characterAssetUrl(
  bookId: string,
  characterId: string,
  asset: LongCharacterAsset
): string {
  return `deepwrite-image://book/${encodeURIComponent(bookId)}/character/${encodeURIComponent(characterId)}/${encodeURIComponent(asset.filename)}`;
}
export async function assetClipboardPng(src: string): Promise<string> {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.src = src;
  await image.decode();
  if (image.naturalWidth * image.naturalHeight > 40_000_000)
    throw new Error("图片尺寸过大，无法复制到剪贴板。");
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("无法处理图片。");
  context.drawImage(image, 0, 0);
  return canvas.toDataURL("image/png");
}
