import { extname, isAbsolute, dirname, parse, resolve } from "node:path";
import { LONG_CHARACTER_IMAGE_MAX_BYTES } from "@deepwrite/contracts";
import { readNoFollowFile, validateParentDirectories } from "./io";

const imageExtensions = new Set(["png", "jpg", "jpeg", "webp", "gif", "avif"]);
export async function readCharacterImageSource(path: string) {
  if (!isAbsolute(path) || path !== resolve(path))
    throw new Error("图片来源必须是规范的绝对文件路径。");
  await validateParentDirectories(parse(path).root, dirname(path));
  const extension = extname(path).slice(1).toLowerCase();
  if (!imageExtensions.has(extension))
    throw new Error("图片格式仅支持 PNG、JPEG、WebP、GIF、AVIF。");
  const { bytes } = await readNoFollowFile(
    path,
    LONG_CHARACTER_IMAGE_MAX_BYTES,
    "图片来源"
  );
  if (!matchesCharacterImageSignature(bytes, extension))
    throw new Error("图片格式与文件内容不匹配，无法导入。");
  return { extension, bytes };
}

export function matchesCharacterImageSignature(
  bytes: Uint8Array,
  extension: string
): boolean {
  const data = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (extension === "png")
    return (
      data.length >= 24 &&
      data.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex")) &&
      data.toString("ascii", 12, 16) === "IHDR"
    );
  if (extension === "jpg" || extension === "jpeg")
    return (
      data.length >= 4 &&
      data[0] === 0xff &&
      data[1] === 0xd8 &&
      data[2] === 0xff
    );
  if (extension === "gif")
    return (
      data.length >= 13 &&
      (data.toString("ascii", 0, 6) === "GIF87a" ||
        data.toString("ascii", 0, 6) === "GIF89a")
    );
  if (extension === "webp")
    return (
      data.length >= 20 &&
      data.toString("ascii", 0, 4) === "RIFF" &&
      data.toString("ascii", 8, 12) === "WEBP" &&
      ["VP8 ", "VP8L", "VP8X"].includes(data.toString("ascii", 12, 16))
    );
  if (extension === "avif") {
    if (data.length < 24 || data.toString("ascii", 4, 8) !== "ftyp")
      return false;
    const boxSize = data.readUInt32BE(0);
    if (boxSize < 24 || boxSize > Math.min(data.length, 4096)) return false;
    for (let i = 8; i + 4 <= boxSize; i += 4) {
      if (i === 12) continue;
      if (["avif", "avis"].includes(data.toString("ascii", i, i + 4)))
        return true;
    }
  }
  return false;
}
