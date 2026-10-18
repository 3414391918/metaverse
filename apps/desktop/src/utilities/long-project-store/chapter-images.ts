import {
  LONG_WORKSPACE_INDEX_PATH,
  LongReadChapterImageInputSchema,
  LongReadChapterImageResultSchema,
  LongReplaceChapterImageInputSchema,
  LongReplaceChapterImageResultSchema,
  type LongReadChapterImageInput,
  type LongReplaceChapterImageInput
} from "@deepwrite/contracts";
import {
  commitProjectTransaction,
  projectTransactionContentSha256,
  ProjectTransactionConflictError
} from "../project-transaction";
import {
  encodeChapterImageReplacement,
  readChapterImageAsPng
} from "./chapter-image-codec";
import { loadChapterImage } from "./chapter-image-state";
import { secureDirectory } from "./io";
import type { LongProjectStoreContext } from "./store-context";
import { MAX_LEDGER_RECORD_BYTES } from "./types";

export async function readChapterImage(
  ctx: LongProjectStoreContext,
  directory: string,
  input: LongReadChapterImageInput
) {
  const parsed = LongReadChapterImageInputSchema.parse(input);
  const canonical = await secureDirectory(directory, "长篇项目目录");
  return await ctx.runExclusive(canonical, async () => {
    const state = await loadChapterImage(ctx, canonical, parsed);
    return LongReadChapterImageResultSchema.parse({
      pngDataUrl: await readChapterImageAsPng(state.bytes, state.extension),
      revision: state.revision
    });
  });
}

export async function replaceChapterImage(
  ctx: LongProjectStoreContext,
  directory: string,
  input: LongReplaceChapterImageInput
) {
  const parsed = LongReplaceChapterImageInputSchema.parse(input);
  const canonical = await secureDirectory(directory, "长篇项目目录");
  return await ctx.runExclusive(canonical, async () => {
    const state = await loadChapterImage(ctx, canonical, parsed);
    if (state.revision !== parsed.expectedRevision)
      throw new ProjectTransactionConflictError(
        state.relativePath,
        parsed.expectedRevision,
        state.revision
      );
    const bytes = await encodeChapterImageReplacement(
      parsed.pngDataUrl,
      state.extension
    );
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
          expectedSha256: parsed.expectedRevision
        }
      ]
    });
    return LongReplaceChapterImageResultSchema.parse({
      revision: projectTransactionContentSha256(bytes)
    });
  });
}
