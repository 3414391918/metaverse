import { lstat, realpath } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { Readable } from "node:stream";
import {
  LongBookIdSchema,
  isLongChapterImageDirectory
} from "@deepwrite/contracts";
import { protocol } from "electron";
import { characterAssetImageResponse } from "./character-asset-access";
import {
  openCharacterAssetFile,
  readCharacterAssetFile
} from "./character-asset-files";
import { workspaceDataPath } from "./workspace-data-path";

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
  avif: "image/avif",
  mp4: "video/mp4",
  webm: "video/webm"
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
  const parent = await realpath(dirname(path));
  return JSON.parse(
    (
      await readCharacterAssetFile(
        join(parent, basename(path)),
        maximum,
        parent
      )
    ).toString("utf8")
  ) as unknown;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

async function registeredChapterDirectory(
  userDataPath: string,
  bookId: string,
  chapter: string,
  mediaDirectory: "images" | "videos" = "images"
): Promise<string | undefined> {
  const registry = record(
    await readBoundedJson(
      join(await workspaceDataPath(userDataPath), "long-project-registry.json"),
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
  const directory = join(
    canonicalRoot,
    "long",
    "chapters",
    chapter,
    mediaDirectory
  );
  return (await realpath(directory)) === directory ? directory : undefined;
}

export function createLongImageProtocolHandler(
  userDataPath: string
): (request: Request) => Promise<Response> {
  return async (request) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response(null, {
        status: 405,
        headers: { Allow: "GET, HEAD" }
      });
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
    const videoMatch =
      /^\/([^/]+)\/([^/]+)\/videos\/([A-Za-z0-9][A-Za-z0-9._-]*\.(mp4|webm))$/i.exec(
        url.pathname
      );
    const match =
      videoMatch ??
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
        chapter,
        videoMatch ? "videos" : "images"
      );
      if (!directory) return new Response(null, { status: 404 });
      const path = join(directory, filename);
      const { handle } = await openCharacterAssetFile(
        path,
        IMAGE_MAX_BYTES,
        directory
      );
      try {
        const info = await handle.stat();
        if (!info.isFile() || info.size < 1 || info.size > IMAGE_MAX_BYTES) {
          await handle.close();
          return new Response(null, { status: 404 });
        }
        const headers: Record<string, string> = {
          "Content-Type":
            TYPES[extension.toLowerCase()] ?? "application/octet-stream",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff"
        };
        let start = 0;
        let end = info.size - 1;
        let status = 200;
        if (videoMatch) {
          headers["Accept-Ranges"] = "bytes";
          const range = request.headers.get("range");
          if (range) {
            const parts = /^bytes=(\d*)-(\d*)$/u.exec(range);
            if (!parts || (!parts[1] && !parts[2])) {
              await handle.close();
              return new Response(null, {
                status: 416,
                headers: { "Content-Range": `bytes */${info.size}` }
              });
            }
            if (!parts[1]) {
              const count = Number(parts[2]);
              start = Math.max(0, info.size - count);
            } else {
              start = Number(parts[1]);
              end = parts[2] ? Math.min(Number(parts[2]), end) : end;
            }
            if (
              !Number.isSafeInteger(start) ||
              !Number.isSafeInteger(end) ||
              start > end ||
              start >= info.size
            ) {
              await handle.close();
              return new Response(null, {
                status: 416,
                headers: { "Content-Range": `bytes */${info.size}` }
              });
            }
            status = 206;
            headers["Content-Range"] = `bytes ${start}-${end}/${info.size}`;
          }
        }
        headers["Content-Length"] = String(end - start + 1);
        if (request.method === "HEAD") {
          await handle.close();
          return new Response(null, { status, headers });
        }
        const stream = handle.createReadStream({ start, end, autoClose: true });
        return new Response(
          Readable.toWeb(stream) as ReadableStream<Uint8Array>,
          {
            status,
            headers
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
