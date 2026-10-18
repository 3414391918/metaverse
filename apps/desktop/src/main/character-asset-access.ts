import { lstat, realpath } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { Readable } from "node:stream";
import {
  LongCharacterAssetManifestSchema,
  LongReadCharacterProfileInputSchema,
  LONG_CHARACTER_IMAGE_MAX_BYTES,
  LongProjectRelativePathSchema
} from "@deepwrite/contracts";
import {
  openCharacterAssetFile,
  readCharacterAssetFile
} from "./character-asset-files";
const mimeTypes: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif"
};
async function json(path: string, limit: number): Promise<unknown> {
  return JSON.parse(
    (await readCharacterAssetFile(path, limit, dirname(path))).toString("utf8")
  ) as unknown;
}
function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
async function assetLocation(
  userDataPath: string,
  input: { bookId: string; characterId: string; assetId: string }
) {
  LongReadCharacterProfileInputSchema.parse({
    bookId: input.bookId,
    characterId: input.characterId
  });
  if (!/^[a-f0-9]{32}$/u.test(input.assetId)) throw new Error("图片标识无效");
  const registry = record(
    await json(
      join(await realpath(userDataPath), "long-project-registry.json"),
      4 * 1024 * 1024
    )
  );
  const registered = Array.isArray(registry?.projects)
    ? registry.projects
        .map(record)
        .find((item) => item?.bookId === input.bookId)
    : undefined;
  if (
    !registered ||
    registered.deletion ||
    typeof registered.projectDirectory !== "string"
  )
    throw new Error("作品未登记");
  const root = resolve(registered.projectDirectory);
  const stat = await lstat(root);
  if (!stat.isDirectory() || stat.isSymbolicLink())
    throw new Error("作品路径无效");
  const canonical = await realpath(root);
  const index = record(
    await json(join(canonical, "long/index.json"), 32 * 1024 * 1024)
  );
  if (
    index?.bookId !== input.bookId ||
    !Array.isArray(index.characterFiles) ||
    !Array.isArray(index.characters) ||
    !index.characters.some((item) => record(item)?.id === input.characterId)
  )
    throw new Error("人物不存在");
  const entry = index.characterFiles
    .map(record)
    .find((item) => item?.characterId === input.characterId);
  const profilePath = record(entry?.coreProfile)?.path;
  if (
    typeof profilePath !== "string" ||
    !LongProjectRelativePathSchema.safeParse(profilePath).success ||
    profilePath.normalize("NFC") !== profilePath ||
    !/^long\/characters\/[^/]+\/core-profile\.md$/u.test(profilePath)
  )
    throw new Error("人物目录无效");
  const directory = join(canonical, dirname(profilePath));
  if ((await realpath(directory)) !== directory)
    throw new Error("人物目录不能是符号链接");
  const manifest = LongCharacterAssetManifestSchema.parse(
    await json(join(directory, "assets.json"), 16 * 1024 * 1024)
  );
  const asset = manifest.assets.find((item) => item.id === input.assetId);
  if (!asset) throw new Error("图片不存在");
  const assetDirectory = join(directory, "assets");
  if ((await realpath(assetDirectory)) !== assetDirectory)
    throw new Error("图片目录不能是符号链接");
  return {
    asset,
    path: join(assetDirectory, asset.directory ?? "", asset.filename),
    root: canonical
  };
}
export async function readCharacterAsset(
  userDataPath: string,
  input: { bookId: string; characterId: string; assetId: string }
): Promise<Buffer> {
  const { path, root } = await assetLocation(userDataPath, input);
  return await readCharacterAssetFile(
    path,
    LONG_CHARACTER_IMAGE_MAX_BYTES,
    root
  );
}
export async function characterAssetImageResponse(
  userDataPath: string,
  url: URL
): Promise<Response> {
  const match =
    /^\/([^/]+)\/character\/([^/]+)\/([a-f0-9]{32})\.(png|jpg|jpeg|webp|gif|avif)$/u.exec(
      url.pathname
    );
  if (!match) return new Response(null, { status: 400 });
  try {
    const [, bookId = "", characterId = "", assetId = "", extension = ""] =
      match;
    const location = await assetLocation(userDataPath, {
      bookId,
      characterId,
      assetId
    });
    if (location.asset.filename !== `${assetId}.${extension}`)
      return new Response(null, { status: 404 });
    const { handle, info } = await openCharacterAssetFile(
      location.path,
      LONG_CHARACTER_IMAGE_MAX_BYTES,
      location.root
    );
    try {
      const stream = handle.createReadStream({
        autoClose: true,
        end: Number(info.size) - 1
      });
      return new Response(
        Readable.toWeb(stream) as ReadableStream<Uint8Array>,
        {
          status: 200,
          headers: {
            "Content-Type": mimeTypes[extension]!,
            "Content-Length": String(info.size),
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
            "Access-Control-Allow-Origin": "*"
          }
        }
      );
    } catch (error) {
      await handle.close();
      throw error;
    }
  } catch {
    return new Response(null, { status: 404 });
  }
}
