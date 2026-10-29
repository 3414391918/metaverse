import { lstat } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { LongCharacterProfileSnapshot } from "@deepwrite/contracts";

const IMAGE_REFERENCE =
  /!\[[^\]\r\n]*\]\(images\/([A-Za-z0-9][A-Za-z0-9._-]*\.(?:png|jpe?g|webp|gif|avif))\)/giu;

async function available(path: string): Promise<boolean> {
  try {
    const info = await lstat(path);
    return info.isFile() && !info.isSymbolicLink();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

export async function listChapterIllustrations(
  bookDirectory: string,
  bodyPath: string,
  content: string,
  options: {
    query: string | undefined;
    order: "asc" | "desc";
    offset: number;
    limit: number;
  }
) {
  const candidates = [...content.matchAll(IMAGE_REFERENCE)]
    .map((match) => {
      const offset = match.index;
      const filename = match[1]!;
      return {
        filename,
        offset,
        nearbyText: content.slice(
          Math.max(0, offset - 240),
          Math.min(content.length, offset + match[0].length + 240)
        )
      };
    })
    .filter(
      ({ filename, nearbyText }) =>
        !options.query ||
        `${filename}\n${nearbyText.replace(IMAGE_REFERENCE, "")}`
          .toLocaleLowerCase()
          .includes(options.query.toLocaleLowerCase())
    );
  if (options.order === "desc") candidates.reverse();
  const selected = candidates.slice(
    options.offset,
    options.offset + options.limit
  );
  return {
    total: candidates.length,
    offset: options.offset,
    hasMore: options.offset + selected.length < candidates.length,
    references: await Promise.all(
      selected.map(async ({ filename, offset, nearbyText }) => {
        const path = join(bookDirectory, dirname(bodyPath), "images", filename);
        return {
          filename,
          path,
          offset,
          nearbyText,
          available: await available(path)
        };
      })
    )
  };
}

export async function listCharacterAssets(
  bookDirectory: string,
  coreProfilePath: string,
  snapshot: LongCharacterProfileSnapshot
) {
  const directory = join(bookDirectory, dirname(coreProfilePath), "assets");
  const names = new Map(
    snapshot.profile.appearances.map(({ id, name }) => [id, name])
  );
  return Promise.all(
    snapshot.assets.map(async (asset) => {
      const path = join(
        directory,
        ...(asset.directory ? [asset.directory] : []),
        asset.filename
      );
      return {
        appearanceId: asset.appearanceId,
        appearanceName: names.get(asset.appearanceId) ?? asset.appearanceId,
        label: asset.label,
        path,
        available: await available(path)
      };
    })
  );
}
