import { dirname, extname, posix, resolve } from "node:path";
import {
  LONG_CHAPTER_IMAGE_MAX_BYTES,
  longChapterImageDirectoryFromBodyPath,
  type LongReadChapterImageInput
} from "@deepwrite/contracts";
import { projectTransactionContentSha256 } from "../project-transaction";
import { validateRelativeProjectPath } from "../project-transaction/validation";
import {
  assertContained,
  readNoFollowFile,
  readSecureTextFile,
  validateParentDirectories
} from "./io";
import { loadProject } from "./load-project";
import type { LongProjectStoreContext } from "./store-context";
import { MAX_DOCUMENT_BYTES } from "./types";

export async function loadChapterImage(
  ctx: LongProjectStoreContext,
  directory: string,
  input: LongReadChapterImageInput
) {
  const loaded = await loadProject(ctx, directory);
  if (loaded.book.id !== input.bookId)
    throw new Error("正文图片所属作品不一致。");
  const chapter = loaded.index.chapters.find(
    ({ chapterCardId }) => chapterCardId === input.chapterCardId
  );
  if (!chapter) throw new Error("正文图片对应的章节正文不存在。");
  if (!longChapterImageDirectoryFromBodyPath(chapter.body.path))
    throw new Error("正文图片只能位于规范章节正文的 images 目录。");
  const body = await readSecureTextFile(
    loaded.projectDirectory,
    chapter.body.path,
    MAX_DOCUMENT_BYTES
  );
  const referenced = [...body.content.matchAll(/!\[(.*?)\]\((.*?)\)/gu)].some(
    (match) => match[2] === `images/${input.filename}`
  );
  if (!referenced) throw new Error("当前章节正文未引用这张图片。");
  const relativePath = posix.join(
    posix.dirname(chapter.body.path),
    "images",
    input.filename
  );
  if (
    validateRelativeProjectPath(relativePath) !== relativePath ||
    relativePath.normalize("NFC") !== relativePath ||
    !relativePath.startsWith("long/")
  )
    throw new Error("正文图片必须使用 long/ 下的规范路径。");
  const target = resolve(loaded.projectDirectory, relativePath);
  assertContained(loaded.projectDirectory, target);
  await validateParentDirectories(loaded.projectDirectory, dirname(target));
  const { bytes } = await readNoFollowFile(
    target,
    LONG_CHAPTER_IMAGE_MAX_BYTES,
    "正文图片",
    loaded.projectDirectory
  );
  return {
    loaded,
    chapter,
    body,
    relativePath,
    target,
    bytes,
    revision: projectTransactionContentSha256(bytes),
    extension: extname(input.filename).slice(1).toLowerCase()
  };
}
