import { lstat, readdir } from "node:fs/promises";
import { dirname, extname, join, posix, resolve } from "node:path";
import {
  LONG_CHAPTER_VIDEO_MAX_BYTES,
  LONG_WORKSPACE_INDEX_PATH,
  LongAddChapterVideoInputSchema,
  LongAddChapterVideoResultSchema,
  LongDeleteChapterVideoInputSchema,
  LongDeleteChapterVideoResultSchema,
  LongProjectManifestSchema,
  LongReadChapterVideoInputSchema,
  LongReadChapterVideoResultSchema,
  LongReplaceChapterVideoInputSchema,
  LongReplaceChapterVideoResultSchema,
  LongWorkspaceIndexSnapshotSchema,
  LongWriteDocumentInputSchema,
  longChapterImageDirectoryFromBodyPath,
  type LongAddChapterVideoInput,
  type LongDeleteChapterVideoInput,
  type LongReadChapterVideoInput,
  type LongReplaceChapterVideoInput
} from "@deepwrite/contracts";
import {
  commitProjectTransaction,
  projectTransactionContentSha256,
  ProjectTransactionConflictError
} from "../project-transaction";
import { validateRelativeProjectPath } from "../project-transaction/validation";
import {
  assertContained,
  readNoFollowFile,
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
  MAX_LEDGER_RECORD_BYTES,
  MAX_MANIFEST_BYTES
} from "./types";
import { encodeUtf8Strict } from "./utf8";

const NUMBERED_VIDEO = /^(\d+)\.(?:mp4|webm)$/iu;
const VIDEO_REFERENCE = /!video\[\]\(videos\/(\d+)\.(?:mp4|webm)\)/giu;

function decodeVideo(dataUrl: string): {
  bytes: Buffer;
  extension: "mp4" | "webm";
} {
  const match = /^data:video\/(mp4|webm);base64,([A-Za-z0-9+/]+={0,2})$/u.exec(
    dataUrl
  );
  if (!match) throw new Error("仅支持 MP4 或 WebM 视频。");
  const extension = match[1] as "mp4" | "webm";
  const encoded = match[2]!;
  const bytes = Buffer.from(encoded, "base64");
  const valid =
    extension === "mp4"
      ? bytes.byteLength >= 12 && bytes.toString("ascii", 4, 8) === "ftyp"
      : bytes.byteLength >= 4 &&
        bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  if (
    !bytes.byteLength ||
    bytes.byteLength > LONG_CHAPTER_VIDEO_MAX_BYTES ||
    bytes.toString("base64") !== encoded ||
    !valid
  )
    throw new Error("视频格式无效或超过 100 MB 限制。支持 MP4 和 WebM。 ");
  return { bytes, extension };
}

function insertReference(content: string, offset: number, filename: string) {
  if (offset > content.length) throw new Error("视频位置超过正文长度。");
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
  const insertion = `${prefix}!video[](videos/${filename})${suffix}`;
  return {
    content: before + insertion + after,
    selectionOffset: before.length + insertion.length
  };
}

async function nextVideoName(
  directory: string,
  texts: string[],
  extension: string
) {
  let names: string[] = [];
  try {
    const info = await lstat(directory);
    if (info.isSymbolicLink() || !info.isDirectory())
      throw new Error("正文 videos 目录必须是真实目录，不能是符号链接。");
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
      throw new Error("已有视频编号过大，无法继续添加。");
    maximum = Math.max(maximum, number);
  };
  for (const name of names) consider(NUMBERED_VIDEO.exec(name)?.[1]);
  for (const text of texts)
    for (const match of text.matchAll(VIDEO_REFERENCE)) consider(match[1]);
  return `${String(maximum + 1).padStart(3, "0")}.${extension}`;
}

async function loadChapterVideo(
  ctx: LongProjectStoreContext,
  directory: string,
  input: LongReadChapterVideoInput
) {
  const loaded = await loadProject(ctx, directory);
  if (loaded.book.id !== input.bookId)
    throw new Error("正文视频所属作品不一致。");
  const chapter = loaded.index.chapters.find(
    ({ chapterCardId }) => chapterCardId === input.chapterCardId
  );
  if (!chapter || !longChapterImageDirectoryFromBodyPath(chapter.body.path))
    throw new Error("正文视频只能位于规范章节正文的 videos 目录。");
  const body = await readSecureTextFile(
    loaded.projectDirectory,
    chapter.body.path,
    MAX_DOCUMENT_BYTES
  );
  if (!body.content.includes(`!video[](videos/${input.filename})`))
    throw new Error("当前章节正文未引用这个视频。");
  const relativePath = posix.join(
    posix.dirname(chapter.body.path),
    "videos",
    input.filename
  );
  if (
    validateRelativeProjectPath(relativePath) !== relativePath ||
    relativePath.normalize("NFC") !== relativePath ||
    !relativePath.startsWith("long/")
  )
    throw new Error("正文视频必须使用 long/ 下的规范路径。");
  const target = resolve(loaded.projectDirectory, relativePath);
  assertContained(loaded.projectDirectory, target);
  await validateParentDirectories(loaded.projectDirectory, dirname(target));
  const { bytes } = await readNoFollowFile(
    target,
    LONG_CHAPTER_VIDEO_MAX_BYTES,
    "正文视频",
    loaded.projectDirectory
  );
  const extension = extname(input.filename).slice(1).toLowerCase();
  const valid =
    extension === "mp4"
      ? bytes.byteLength >= 12 && bytes.toString("ascii", 4, 8) === "ftyp"
      : bytes.byteLength >= 4 &&
        bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  if (!valid) throw new Error("正文视频格式与文件内容不匹配。");
  return {
    loaded,
    chapter,
    body,
    relativePath,
    target,
    revision: projectTransactionContentSha256(bytes),
    extension
  };
}

function updatedMetadata(
  state: Awaited<ReturnType<typeof loadChapterVideo>>,
  content: string,
  timestamp: string
) {
  state.chapter.body.updatedAt = timestamp;
  updateChapterBodyStatus(state.loaded.index, state.chapter.body.id, content);
  const index = LongWorkspaceIndexSnapshotSchema.parse({
    ...state.loaded.index,
    updatedAt: timestamp
  });
  const manifest = LongProjectManifestSchema.parse({
    ...state.loaded.manifest,
    updatedAt: timestamp,
    workspaceIndexFile: {
      ...state.loaded.manifest.workspaceIndexFile,
      updatedAt: timestamp
    }
  });
  return {
    indexContent: serializeJson(index),
    manifestContent: serializeJson(manifest)
  };
}

export async function readChapterVideo(
  ctx: LongProjectStoreContext,
  directory: string,
  input: LongReadChapterVideoInput
) {
  const parsed = LongReadChapterVideoInputSchema.parse(input);
  const canonical = await secureDirectory(directory, "长篇项目目录");
  return ctx.runExclusive(canonical, async () => {
    const state = await loadChapterVideo(ctx, canonical, parsed);
    return LongReadChapterVideoResultSchema.parse({ revision: state.revision });
  });
}

export async function chapterVideoCopySource(
  ctx: LongProjectStoreContext,
  directory: string,
  input: LongReadChapterVideoInput
) {
  const parsed = LongReadChapterVideoInputSchema.parse(input);
  const canonical = await secureDirectory(directory, "长篇项目目录");
  return ctx.runExclusive(canonical, async () => {
    const state = await loadChapterVideo(ctx, canonical, parsed);
    return { path: state.target, revision: state.revision };
  });
}

export async function addChapterVideo(
  ctx: LongProjectStoreContext,
  directory: string,
  input: LongAddChapterVideoInput
) {
  const parsed = LongAddChapterVideoInputSchema.parse(input);
  const { bytes, extension } = decodeVideo(parsed.videoDataUrl);
  const canonical = await secureDirectory(directory, "小说项目目录");
  return ctx.runExclusive(canonical, async () => {
    const loaded = await loadProject(ctx, canonical);
    if (loaded.book.id !== parsed.bookId)
      throw new Error("视频所属作品不一致。");
    const chapter = loaded.index.chapters.find(
      ({ chapterCardId }) => chapterCardId === parsed.chapterCardId
    );
    if (!chapter || !longChapterImageDirectoryFromBodyPath(chapter.body.path))
      throw new Error("新增视频只能用于规范的章节正文。");
    const body = await readSecureTextFile(
      canonical,
      chapter.body.path,
      MAX_DOCUMENT_BYTES
    );
    if (body.content !== parsed.expectedContent)
      throw new Error("章节正文已在其它位置修改，请重新读取后添加视频。");
    const videosPath = posix.join(posix.dirname(chapter.body.path), "videos");
    await validateParentDirectories(
      canonical,
      dirname(join(canonical, videosPath))
    );
    const timestamp = ctx.timestamp();
    for (let attempt = 0; attempt < 3; attempt++) {
      const filename = await nextVideoName(
        join(canonical, videosPath),
        [body.content, parsed.content],
        extension
      );
      const relativeVideo = posix.join(videosPath, filename);
      const insertion = insertReference(
        parsed.content,
        parsed.offset,
        filename
      );
      LongWriteDocumentInputSchema.shape.content.parse(insertion.content);
      chapter.body.updatedAt = timestamp;
      updateChapterBodyStatus(loaded.index, chapter.body.id, insertion.content);
      const indexContent = serializeJson(
        LongWorkspaceIndexSnapshotSchema.parse({
          ...loaded.index,
          updatedAt: timestamp
        })
      );
      const manifestContent = serializeJson(
        LongProjectManifestSchema.parse({
          ...loaded.manifest,
          updatedAt: timestamp,
          workspaceIndexFile: {
            ...loaded.manifest.workspaceIndexFile,
            updatedAt: timestamp
          }
        })
      );
      for (const [text, limit] of [
        [insertion.content, MAX_DOCUMENT_BYTES],
        [indexContent, MAX_INDEX_BYTES],
        [manifestContent, MAX_MANIFEST_BYTES]
      ] as const)
        if (encodeUtf8Strict(text).byteLength > limit)
          throw new Error("视频添加后的项目文件超过大小限制。");
      try {
        await commitProjectTransaction({
          projectRoot: canonical,
          maxFileBytes: MAX_LEDGER_RECORD_BYTES,
          operations: [
            { path: relativeVideo, content: bytes, expectedSha256: null },
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
          error.path === relativeVideo &&
          attempt < 2
        )
          continue;
        throw error;
      }
      const saved = await loadProject(ctx, canonical);
      const file = saved.index.chapters.find(
        ({ chapterCardId }) => chapterCardId === parsed.chapterCardId
      )!.body;
      return LongAddChapterVideoResultSchema.parse({
        filename,
        ...insertion,
        document: { bookId: parsed.bookId, file, summary: saved.summary }
      });
    }
    throw new Error("视频编号持续被其它操作占用，请重试。");
  });
}

export async function replaceChapterVideo(
  ctx: LongProjectStoreContext,
  directory: string,
  input: LongReplaceChapterVideoInput
) {
  const parsed = LongReplaceChapterVideoInputSchema.parse(input);
  const { bytes, extension } = decodeVideo(parsed.videoDataUrl);
  const canonical = await secureDirectory(directory, "长篇项目目录");
  return ctx.runExclusive(canonical, async () => {
    const state = await loadChapterVideo(ctx, canonical, parsed);
    if (state.revision !== parsed.expectedRevision)
      throw new ProjectTransactionConflictError(
        state.relativePath,
        parsed.expectedRevision,
        state.revision
      );
    if (extension !== state.extension)
      throw new Error(`替换视频请使用 ${state.extension.toUpperCase()} 格式。`);
    await commitProjectTransaction({
      projectRoot: state.loaded.projectDirectory,
      maxFileBytes: MAX_LEDGER_RECORD_BYTES,
      operations: [
        {
          action: "check",
          path: state.chapter.body.path,
          expectedSha256: state.body.sha256
        },
        {
          action: "check",
          path: LONG_WORKSPACE_INDEX_PATH,
          expectedSha256: state.loaded.indexDisk.sha256
        },
        {
          path: state.relativePath,
          content: bytes,
          expectedSha256: state.revision
        }
      ]
    });
    return LongReplaceChapterVideoResultSchema.parse({
      revision: projectTransactionContentSha256(bytes)
    });
  });
}

export async function deleteChapterVideo(
  ctx: LongProjectStoreContext,
  directory: string,
  input: LongDeleteChapterVideoInput
) {
  const parsed = LongDeleteChapterVideoInputSchema.parse(input);
  const canonical = await secureDirectory(directory, "长篇项目目录");
  return ctx.runExclusive(canonical, async () => {
    const state = await loadChapterVideo(ctx, canonical, parsed);
    if (state.body.content !== parsed.expectedContent)
      throw new Error("章节正文已变化，请重新加载后删除视频。");
    if (parsed.expectedRevision && state.revision !== parsed.expectedRevision)
      throw new ProjectTransactionConflictError(
        state.relativePath,
        parsed.expectedRevision,
        state.revision
      );
    const reference = `!video[](videos/${parsed.filename})`;
    if (
      state.body.content.slice(
        parsed.offset,
        parsed.offset + reference.length
      ) !== reference
    )
      throw new Error("所选视频位置已变化，请重新定位。");
    const before = state.body.content.slice(0, parsed.offset);
    let after = state.body.content.slice(parsed.offset + reference.length);
    if (before.endsWith("\n\n") && after.startsWith("\n\n"))
      after = after.slice(2);
    else if (before.endsWith("\n") && after.startsWith("\n"))
      after = after.slice(1);
    const content = before + after;
    const fileDeleted = !content.includes(reference);
    const timestamp = ctx.timestamp();
    const { indexContent, manifestContent } = updatedMetadata(
      state,
      content,
      timestamp
    );
    await commitProjectTransaction({
      projectRoot: canonical,
      maxFileBytes: MAX_LEDGER_RECORD_BYTES,
      operations: [
        fileDeleted
          ? {
              action: "delete",
              path: state.relativePath,
              expectedSha256: state.revision
            }
          : {
              action: "check",
              path: state.relativePath,
              expectedSha256: state.revision
            },
        {
          path: state.chapter.body.path,
          content,
          expectedSha256: state.body.sha256
        },
        {
          path: LONG_WORKSPACE_INDEX_PATH,
          content: indexContent,
          expectedSha256: state.loaded.indexDisk.sha256
        },
        {
          path: MANIFEST_PATH,
          content: manifestContent,
          expectedSha256: state.loaded.manifestDisk.sha256
        }
      ]
    });
    const saved = await loadProject(ctx, canonical);
    return LongDeleteChapterVideoResultSchema.parse({
      content,
      fileDeleted,
      selectionOffset: before.length,
      document: {
        bookId: parsed.bookId,
        file: saved.index.chapters.find(
          ({ chapterCardId }) => chapterCardId === parsed.chapterCardId
        )!.body,
        summary: saved.summary
      }
    });
  });
}
