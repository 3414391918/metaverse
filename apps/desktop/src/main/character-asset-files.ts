import { constants, type BigIntStats } from "node:fs";
import { lstat, open, realpath, type FileHandle } from "node:fs/promises";
import { relative, isAbsolute, sep } from "node:path";

function contained(root: string, path: string): boolean {
  const part = relative(root, path);
  return part !== ".." && !part.startsWith(`..${sep}`) && !isAbsolute(part);
}

async function validateIdentity(path: string, info: BigIntStats, root: string) {
  const canonical = await realpath(path);
  const current = await lstat(path, { bigint: true });
  if (
    canonical !== path ||
    !contained(root, canonical) ||
    current.isSymbolicLink() ||
    current.dev !== info.dev ||
    current.ino !== info.ino ||
    current.nlink !== 1n
  )
    throw new Error("图片文件路径在读取期间发生变化");
}

export async function openCharacterAssetFile(
  path: string,
  limit: number,
  root: string
): Promise<{
  handle: FileHandle;
  info: BigIntStats;
}> {
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const info = await handle.stat({ bigint: true });
    if (
      !info.isFile() ||
      info.nlink !== 1n ||
      info.size < 1n ||
      info.size > BigInt(limit)
    ) {
      throw new Error("图片文件必须是无硬链接的普通文件，且未超过大小限制");
    }
    await validateIdentity(path, info, root);
    return { handle, info };
  } catch (error) {
    await handle.close();
    throw error;
  }
}

export async function readCharacterAssetFile(
  path: string,
  limit: number,
  root: string
): Promise<Buffer> {
  const { handle, info } = await openCharacterAssetFile(path, limit, root);
  try {
    // Bound allocation and reads even if another process grows the file.
    const bytes = Buffer.alloc(Number(info.size));
    let offset = 0;
    while (offset < bytes.length) {
      const result = await handle.read(
        bytes,
        offset,
        bytes.length - offset,
        offset
      );
      if (!result.bytesRead) throw new Error("图片文件在读取期间发生变化");
      offset += result.bytesRead;
    }
    const after = await handle.stat({ bigint: true });
    if (
      after.nlink !== 1n ||
      after.size !== info.size ||
      after.mtimeNs !== info.mtimeNs ||
      after.ctimeNs !== info.ctimeNs
    ) {
      throw new Error("图片文件在读取期间发生变化");
    }
    await validateIdentity(path, after, root);
    return bytes;
  } finally {
    await handle.close();
  }
}
