import { constants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import { join, resolve } from "node:path";
import { Readable } from "node:stream";
import {
  LongBookIdSchema,
  isLongChapterImageDirectory
} from "@deepwrite/contracts";
import { protocol } from "electron";
import { characterAssetImageResponse } from "./character-asset-access";

const SCHEME = "deepwrite-image";
const REGISTRY_MAX_BYTES = 4 * 1024 * 1024;
const INDEX_MAX_BYTES = 16 * 1024 * 1024;
const IMAGE_MAX_BYTES = 100 * 1024 * 1024;
const TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif"
};

export function registerLongImageScheme(
  registrar: Pick<typeof protocol, "registerSchemesAsPrivileged"> = protocol
): void {
  registrar.registerSchemesAsPrivileged([
    {
      scheme: SCHEME,
      privileges: {
        standard: true,
        secure: true,
        corsEnabled: true,
        supportFetchAPI: true,
        stream: true
      }
    }
  ]);
}

async function readBoundedJson(
  path: string,
  maximum: number
): Promise<unknown> {
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.size > maximum) throw new Error("invalid file");
    return JSON.parse(await handle.readFile({ encoding: "utf8" })) as unknown;
  } finally {
    await handle.close();
  }
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

async function registeredChapterDirectory(
  userDataPath: string,
  bookId: string,
  chapter: string
): Promise<string | undefined> {
  const registry = record(
    await readBoundedJson(
      join(userDataPath, "long-project-registry.json"),
      REGISTRY_MAX_BYTES
    )
  );
  const registration = Array.isArray(registry?.projects)
    ? registry.projects.map(record).find((item) => item?.bookId === bookId)
    : undefined;
  if (
    !registration ||
    registration.deletion ||
    typeof registration.projectDirectory !== "string"
  )
    return undefined;

  const root = resolve(registration.projectDirectory);
  const rootInfo = await lstat(root);
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) return undefined;
  const canonicalRoot = await realpath(root);
  const index = record(
    await readBoundedJson(
      join(canonicalRoot, "long", "index.json"),
      INDEX_MAX_BYTES
    )
  );
  if (index?.bookId !== bookId || !Array.isArray(index.chapters))
    return undefined;
  const bodyPath = `long/chapters/${chapter}/body.md`;
  if (
    !index.chapters.some(
      (item) => record(record(item)?.body)?.path === bodyPath
    )
  )
    return undefined;
  const directory = join(canonicalRoot, "long", "chapters", chapter, "images");
  return (await realpath(directory)) === directory ? directory : undefined;
}

export function createLongImageProtocolHandler(
  userDataPath: string
): (request: Request) => Promise<Response> {
  return async (request) => {
    if (request.method !== "GET") {
      return new Response(null, { status: 405, headers: { Allow: "GET" } });
    }
    let url: URL;
    try {
      url = new URL(request.url);
    } catch {
      return new Response(null, { status: 400 });
    }
    if (
      url.protocol !== `${SCHEME}:` ||
      url.host !== "book" ||
      url.username ||
      url.password ||
      (url.search && !/^\?v=[a-f0-9]{64}$/u.test(url.search)) ||
      url.hash
    )
      return new Response(null, { status: 400 });
    if (url.pathname.includes("/character/")) {
      if (url.search) return new Response(null, { status: 400 });
      return await characterAssetImageResponse(userDataPath, url);
    }
    const match =
      /^\/([^/]+)\/([^/]+)\/([A-Za-z0-9][A-Za-z0-9._-]*\.(png|jpe?g|webp|gif|avif))$/i.exec(
        url.pathname
      );
    if (
      !match ||
      !LongBookIdSchema.safeParse(match[1]).success ||
      !isLongChapterImageDirectory(match[2] ?? "")
    ) {
      return new Response(null, { status: 400 });
    }
    const [, bookId = "", chapter = "", filename = "", extension = ""] = match;
    try {
      const directory = await registeredChapterDirectory(
        userDataPath,
        bookId,
        chapter
      );
      if (!directory) return new Response(null, { status: 404 });
      const path = join(directory, filename);
      const handle = await open(
        path,
        constants.O_RDONLY | constants.O_NOFOLLOW
      );
      try {
        const info = await handle.stat();
        if (!info.isFile() || info.size < 1 || info.size > IMAGE_MAX_BYTES) {
          await handle.close();
          return new Response(null, { status: 404 });
        }
        const stream = handle.createReadStream({ autoClose: true });
        return new Response(
          Readable.toWeb(stream) as ReadableStream<Uint8Array>,
          {
            status: 200,
            headers: {
              "Content-Type":
                TYPES[extension.toLowerCase()] ?? "application/octet-stream",
              "Content-Length": String(info.size),
              "Cache-Control": "no-store",
              "X-Content-Type-Options": "nosniff"
            }
          }
        );
      } catch (error) {
        await handle.close().catch(() => undefined);
        throw error;
      }
    } catch {
      return new Response(null, { status: 404 });
    }
  };
}

export function installLongImageProtocolHandler(
  userDataPath: string,
  installer: Pick<typeof protocol, "handle"> = protocol
): void {
  installer.handle(SCHEME, createLongImageProtocolHandler(userDataPath));
}
