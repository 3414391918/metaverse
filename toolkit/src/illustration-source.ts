import { realpath } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import {
  LONG_CHAPTER_IMAGE_MAX_BYTES,
  LONG_CHAPTER_IMAGE_MAX_PIXELS
} from "@deepwrite/contracts";
import { readNoFollowFile } from "../../apps/desktop/src/utilities/long-project-store/io";

const PNG_SIGNATURE = Buffer.from("89504e470d0a1a0a", "hex");

function validatePng(bytes: Buffer): void {
  if (
    bytes.byteLength < 45 ||
    !bytes.subarray(0, 8).equals(PNG_SIGNATURE) ||
    bytes.readUInt32BE(8) !== 13 ||
    bytes.toString("ascii", 12, 16) !== "IHDR"
  )
    throw new Error("插图文件不是完整的 PNG 图片。");
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (
    width === 0 ||
    height === 0 ||
    width * height > LONG_CHAPTER_IMAGE_MAX_PIXELS
  )
    throw new Error("插图像素超过 4000 万像素限制。");
  let offset = 8;
  let hasImageData = false;
  let ended = false;
  while (offset + 12 <= bytes.byteLength) {
    const length = bytes.readUInt32BE(offset);
    if (length > bytes.byteLength - offset - 12)
      throw new Error("插图 PNG 数据不完整。");
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    if (type === "acTL") throw new Error("章节插图不支持动画 PNG。");
    if (type === "IDAT") hasImageData = true;
    offset += length + 12;
    if (type === "IEND") {
      ended = length === 0 && offset === bytes.byteLength;
      break;
    }
  }
  if (!hasImageData || !ended) throw new Error("插图 PNG 缺少完整的图像数据。");
}

export async function readIllustrationSource(path: string): Promise<Buffer> {
  if (!isAbsolute(path) || resolve(path) !== path)
    throw new Error("插图来源必须是规范的绝对路径。");
  if (path.toLowerCase().endsWith(".png") === false)
    throw new Error("目前只支持导入 PNG 插图。");
  // macOS temp paths commonly start with /var -> /private/var. Resolve the
  // parent once, then still reject a symlink at the image itself.
  const canonicalParent = await realpath(dirname(path));
  const { bytes } = await readNoFollowFile(
    join(canonicalParent, basename(path)),
    LONG_CHAPTER_IMAGE_MAX_BYTES,
    "插图来源"
  );
  validatePng(bytes);
  return bytes;
}
