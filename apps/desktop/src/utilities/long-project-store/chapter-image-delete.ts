import {
  LONG_WORKSPACE_INDEX_PATH,
  LongDeleteChapterImageInputSchema,
  LongDeleteChapterImageResultSchema,
  LongProjectManifestSchema,
  LongWorkspaceIndexSnapshotSchema,
  type LongDeleteChapterImageInput
} from "@deepwrite/contracts";
import {
  commitProjectTransaction,
  ProjectTransactionConflictError
} from "../project-transaction";
import { loadChapterImage } from "./chapter-image-state";
import { secureDirectory, serializeJson } from "./io";
import { loadProject } from "./load-project";
import { updateChapterBodyStatus } from "./paths";
import type { LongProjectStoreContext } from "./store-context";
import { MANIFEST_PATH, MAX_LEDGER_RECORD_BYTES } from "./types";

export async function deleteChapterImage(
  ctx: LongProjectStoreContext,
  directory: string,
  input: LongDeleteChapterImageInput
) {
  const parsed = LongDeleteChapterImageInputSchema.parse(input);
  const canonical = await secureDirectory(directory, "长篇项目目录");
  return await ctx.runExclusive(canonical, async () => {
    const state = await loadChapterImage(ctx, canonical, parsed);
    if (state.body.content !== parsed.expectedContent)
      throw new Error("章节正文已变化，请重新加载后删除图片。");
    if (parsed.expectedRevision && state.revision !== parsed.expectedRevision)
      throw new ProjectTransactionConflictError(
        state.relativePath,
        parsed.expectedRevision,
        state.revision
      );
    const reference = [
      ...state.body.content.matchAll(/!\[([^\]\n]*)\]\(([^)\n]+)\)/gu)
    ].find(
      (match) =>
        match.index === parsed.offset &&
        match[2] === `images/${parsed.filename}`
    );
    if (!reference) throw new Error("所选图片位置已变化，请重新定位。");
    const before = state.body.content.slice(0, parsed.offset);
    let after = state.body.content.slice(parsed.offset + reference[0].length);
    if (before.endsWith("\n\n") && after.startsWith("\n\n"))
      after = after.slice(2);
    else if (before.endsWith("\n") && after.startsWith("\n"))
      after = after.slice(1);
    const content = before + after;
    const fileDeleted = ![
      ...content.matchAll(/!\[[^\]\n]*\]\(([^)\n]+)\)/gu)
    ].some((match) => match[1] === `images/${parsed.filename}`);
    const timestamp = ctx.timestamp();
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
          content: serializeJson(index),
          expectedSha256: state.loaded.indexDisk.sha256
        },
        {
          path: MANIFEST_PATH,
          content: serializeJson(manifest),
          expectedSha256: state.loaded.manifestDisk.sha256
        }
      ]
    });
    const saved = await loadProject(ctx, canonical);
    return LongDeleteChapterImageResultSchema.parse({
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
