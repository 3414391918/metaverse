import sharp, { type Sharp } from "sharp";
import {
  LONG_CHAPTER_IMAGE_MAX_BYTES,
  LONG_CHAPTER_IMAGE_MAX_PIXELS
} from "@deepwrite/contracts";
import { matchesCharacterImageSignature } from "./character-image-source";

const ENCODING_TIMEOUT_SECONDS = 15;

function isAnimatedPng(bytes: Buffer): boolean {
  for (let offset = 8; offset + 12 <= bytes.byteLength;) {
    const length = bytes.readUInt32BE(offset);
    if (length > bytes.byteLength - offset - 12)
      throw new Error("剪贴板 PNG 图片数据不完整。");
    if (bytes.toString("ascii", offset + 4, offset + 8) === "acTL") return true;
    offset += length + 12;
  }
  return false;
}

async function imagePipeline(
  bytes: Buffer,
  extension: string,
  singlePng = false
) {
  if (bytes.byteLength === 0 || bytes.byteLength > LONG_CHAPTER_IMAGE_MAX_BYTES)
    throw new Error("正文图片超过大小限制。");
  if (!matchesCharacterImageSignature(bytes, extension))
    throw new Error("正文图片格式与文件内容不匹配。");
  if (singlePng && isAnimatedPng(bytes))
    throw new Error("剪贴板图片必须是单张 PNG 图片。");
  const pipeline = sharp(bytes, {
    failOn: "warning",
    limitInputPixels: LONG_CHAPTER_IMAGE_MAX_PIXELS,
    pages: 1
  }).timeout({ seconds: ENCODING_TIMEOUT_SECONDS });
  const metadata = await pipeline.metadata();
  const expectedFormat =
    extension === "jpg" ? "jpeg" : extension === "avif" ? "heif" : extension;
  if (metadata.format !== expectedFormat)
    throw new Error("正文图片格式与文件内容不匹配。");
  if (
    !metadata.width ||
    !metadata.height ||
    metadata.width * metadata.height > LONG_CHAPTER_IMAGE_MAX_PIXELS
  )
    throw new Error("正文图片尺寸超过 4000 万像素限制。");
  if (singlePng && (metadata.format !== "png" || (metadata.pages ?? 1) !== 1))
    throw new Error("剪贴板图片必须是单张 PNG 图片。");
  return pipeline;
}

async function boundedOutput(pipeline: Sharp): Promise<Buffer> {
  // toBuffer executes the decoder; metadata or a signature alone is insufficient.
  const bytes = await pipeline.toBuffer();
  if (bytes.byteLength > LONG_CHAPTER_IMAGE_MAX_BYTES)
    throw new Error("转换后的正文图片超过 100 MB 大小限制。");
  return bytes;
}

export async function readChapterImageAsPng(bytes: Buffer, extension: string) {
  const pipeline = await imagePipeline(bytes, extension);
  const png = await boundedOutput(pipeline.autoOrient().png());
  return `data:image/png;base64,${png.toString("base64")}`;
}

export async function encodeChapterImageReplacement(
  pngDataUrl: string,
  extension: string
) {
  const encoded = pngDataUrl.slice("data:image/png;base64,".length);
  const png = Buffer.from(encoded, "base64");
  if (png.toString("base64") !== encoded)
    throw new Error("剪贴板 PNG 图片编码无效。");
  const pipeline = await imagePipeline(png, "png", true);
  switch (extension) {
    case "png":
      return await boundedOutput(pipeline.png());
    case "jpg":
    case "jpeg":
      return await boundedOutput(
        pipeline.flatten({ background: "#ffffff" }).jpeg({ quality: 95 })
      );
    case "webp":
      return await boundedOutput(pipeline.webp({ lossless: true }));
    case "gif":
      return await boundedOutput(pipeline.gif());
    case "avif":
      return await boundedOutput(pipeline.avif({ quality: 90, effort: 2 }));
    default:
      throw new Error("正文图片格式不支持替换。");
  }
}
