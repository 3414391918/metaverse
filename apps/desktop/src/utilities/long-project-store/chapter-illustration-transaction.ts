import { lstat, readdir } from "node:fs/promises";
import { dirname, join, posix } from "node:path";
import {
  LONG_WORKSPACE_INDEX_PATH,
  longChapterImageDirectoryFromBodyPath,
  LONG_CHAPTER_IMAGE_MAX_BYTES,
  LongAddChapterImageResultSchema,
  LongProjectManifestSchema,
  LongWorkspaceIndexSnapshotSchema,
  LongWriteDocumentInputSchema,
  type LongAddChapterImageInput
} from "@deepwrite/contracts";
import {
  ProjectTransactionConflictError,
  commitProjectTransaction
} from "../project-transaction";
import { matchesCharacterImageSignature } from "./character-image-source";
import {
  readSecureTextFile,
  secureDirectory,
  serializeJson,
  validateParentDirectories
} from "./io";
import { loadProject } from "./load-project";
import { updateChapterBodyStatus } from "./paths";
import type { LongProjectStoreContext } from "./store-context";
import {
  MANIFEST_PATH,
  MAX_DOCUMENT_BYTES,
  MAX_INDEX_BYTES,
  MAX_MANIFEST_BYTES,
  MAX_LEDGER_RECORD_BYTES
} from "./types";
import { encodeUtf8Strict } from "./utf8";

const NUMBERED_IMAGE = /^(\d+)\.(?:png|jpe?g|webp|gif|avif)$/iu;
const IMAGE_REFERENCE =
  /!\[[^\]\r\n]*\]\(images\/(\d+)\.(?:png|jpe?g|webp|gif|avif)\)/giu;

async function nextImageName(
  directory: string,
  texts: string[]
): Promise<string> {
  let names: string[] = [];
  try {
    const info = await lstat(directory);
    if (info.isSymbolicLink() || !info.isDirectory())
      throw new Error("正文 images 目录必须是真实目录，不能是符号链接。");
    names = await readdir(directory);
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT"))
      throw error;
  }
  let maximum = 0;
  const consider = (value: string | undefined) => {
    if (value === undefined) return;
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number >= Number.MAX_SAFE_INTEGER)
      throw new Error("已有图片编号过大，无法继续添加。");
    maximum = Math.max(maximum, number);
  };
  for (const name of names) consider(NUMBERED_IMAGE.exec(name)?.[1]);
  for (const text of texts)
    for (const match of text.matchAll(IMAGE_REFERENCE)) consider(match[1]);
  return `${String(maximum + 1).padStart(3, "0")}.png`;
}

function insertReference(content: string, offset: number, filename: string) {
  if (offset > content.length)
    throw new Error("插画位置超过正文长度，请重新选择位置。");
  const before = content.slice(0, offset);
  const after = content.slice(offset);
  const prefix =
    !before || before.endsWith("\n\n")
      ? ""
      : before.endsWith("\n")
        ? "\n"
        : "\n\n";
  const suffix = !after
    ? "\n"
    : after.startsWith("\n\n")
      ? ""
      : after.startsWith("\n")
        ? "\n"
        : "\n\n";
  const insertion = `${prefix}![](images/${filename})${suffix}`;
  return {
    content: before + insertion + after,
    selectionOffset: before.length + insertion.length
  };
}

export async function addChapterImageBytes(
  ctx: LongProjectStoreContext,
  directory: string,
  input: Omit<LongAddChapterImageInput, "pngDataUrl">,
  png: Buffer
) {
  if (
    png.byteLength === 0 ||
    png.byteLength > LONG_CHAPTER_IMAGE_MAX_BYTES ||
    !matchesCharacterImageSignature(png, "png")
  )
    throw new Error("正文插画必须是有效且不超过 100 MB 的 PNG 文件。");
  const canonical = await secureDirectory(directory, "小说项目目录");
  return ctx.runExclusive(canonical, async () => {
    const loaded = await loadProject(ctx, canonical);
    if (loaded.book.id !== input.bookId)
      throw new Error("插画所属作品不一致。");
    const chapter = loaded.index.chapters.find(
      ({ chapterCardId }) => chapterCardId === input.chapterCardId
    );
    if (!chapter || !longChapterImageDirectoryFromBodyPath(chapter.body.path))
      throw new Error("新增插画只能用于规范的章节正文。");
    const body = await readSecureTextFile(
      canonical,
      chapter.body.path,
      MAX_DOCUMENT_BYTES
    );
    if (body.content !== input.expectedContent)
      throw new Error("章节正文已在其它位置修改，请重新读取正文后添加插画。");
    if (input.offset > input.content.length)
      throw new Error("插画位置超过正文长度。");
    const imagesPath = posix.join(posix.dirname(chapter.body.path), "images");
    await validateParentDirectories(
      canonical,
      dirname(join(canonical, imagesPath))
    );
    const timestamp = ctx.timestamp();
    for (let attempt = 0; attempt < 3; attempt++) {
      const filename = await nextImageName(join(canonical, imagesPath), [
        body.content,
        input.content
      ]);
      const relativeImage = posix.join(imagesPath, filename);
      const insertion = insertReference(input.content, input.offset, filename);
      LongWriteDocumentInputSchema.shape.content.parse(insertion.content);
      chapter.body.updatedAt = timestamp;
      updateChapterBodyStatus(loaded.index, chapter.body.id, insertion.content);
      const index = LongWorkspaceIndexSnapshotSchema.parse({
        ...loaded.index,
        updatedAt: timestamp
      });
      const manifest = LongProjectManifestSchema.parse({
        ...loaded.manifest,
        updatedAt: timestamp,
        workspaceIndexFile: {
          ...loaded.manifest.workspaceIndexFile,
          updatedAt: timestamp
        }
      });
      const indexContent = serializeJson(index);
      const manifestContent = serializeJson(manifest);
      for (const [text, limit] of [
        [insertion.content, MAX_DOCUMENT_BYTES],
        [indexContent, MAX_INDEX_BYTES],
        [manifestContent, MAX_MANIFEST_BYTES]
      ] as const) {
        if (encodeUtf8Strict(text).byteLength > limit)
          throw new Error("插画添加后的项目文件超过大小限制。");
      }
      try {
        await commitProjectTransaction({
          projectRoot: canonical,
          maxFileBytes: MAX_LEDGER_RECORD_BYTES,
          operations: [
            { path: relativeImage, content: png, expectedSha256: null },
            {
              path: chapter.body.path,
              content: insertion.content,
              expectedSha256: body.sha256
            },
            {
              path: LONG_WORKSPACE_INDEX_PATH,
              content: indexContent,
              expectedSha256: loaded.indexDisk.sha256
            },
            {
              path: MANIFEST_PATH,
              content: manifestContent,
              expectedSha256: loaded.manifestDisk.sha256
            }
          ]
        });
      } catch (error) {
        if (
          error instanceof ProjectTransactionConflictError &&
          error.path === relativeImage &&
          attempt < 2
        )
          continue;
        throw error;
      }
      const saved = await loadProject(ctx, canonical);
      const file = saved.index.chapters.find(
        ({ chapterCardId }) => chapterCardId === input.chapterCardId
      )!.body;
      return LongAddChapterImageResultSchema.parse({
        filename,
        ...insertion,
        document: { bookId: input.bookId, file, summary: saved.summary }
      });
    }
    throw new Error("图片编号持续被其它操作占用，请重试。");
  });
}
