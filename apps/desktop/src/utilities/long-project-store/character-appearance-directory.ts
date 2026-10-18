import { join, dirname } from "node:path";
import {
  LongPrepareCharacterAppearanceDirectoryInputSchema,
  LongPrepareCharacterAppearanceDirectoryResultSchema,
  type LongPrepareCharacterAppearanceDirectoryInput
} from "@deepwrite/contracts";
import {
  commitProjectTransaction,
  projectTransactionContentSha256,
  type ProjectTransactionFileOperation
} from "../project-transaction";
import { ensureSafeDirectory } from "../project-transaction/io";
import {
  characterAssetPaths,
  characterProfileSnapshot,
  loadCharacterProfileState
} from "./character-profile-context";
import { readCharacterAssetBytes } from "./character-assets-lifecycle";
import { secureDirectory, serializeJson } from "./io";
import type { LongProjectStoreContext } from "./store-context";
import { MAX_LEDGER_RECORD_BYTES } from "./types";

const MIGRATION_BATCH_BYTES = 100 * 1024 * 1024;

/** Move a selected appearance's legacy images with its manifest in atomic batches. */
export async function prepareCharacterAppearanceDirectory(
  ctx: LongProjectStoreContext,
  projectDirectory: string,
  input: LongPrepareCharacterAppearanceDirectoryInput
) {
  const parsed =
    LongPrepareCharacterAppearanceDirectoryInputSchema.parse(input);
  const canonical = await secureDirectory(projectDirectory, "作品目录");
  return await ctx.runExclusive(canonical, async () => {
    let state = await loadCharacterProfileState(ctx, canonical, parsed);
    if (!state.profile.appearances.some((a) => a.id === parsed.appearanceId))
      throw new Error("目标形象不存在，请重新读取角色档案。");
    const paths = characterAssetPaths(state.file.reference.path);
    const directory = join(
      canonical,
      dirname(paths.binary("placeholder.png", parsed.appearanceId))
    );
    // Validates the existing ancestors and rejects redirected directories.
    await ensureSafeDirectory(canonical, directory);
    while (true) {
      const legacy = state.manifest.assets.filter(
        (a) => a.appearanceId === parsed.appearanceId && !a.directory
      );
      if (!legacy.length) break;
      const operations: ProjectTransactionFileOperation[] = [];
      let bytesInBatch = 0;
      for (const asset of legacy) {
        const oldPath = paths.binary(asset.filename);
        const bytes = await readCharacterAssetBytes(state.loaded, oldPath);
        if (
          bytesInBatch &&
          bytesInBatch + bytes.byteLength > MIGRATION_BATCH_BYTES
        )
          break;
        operations.push(
          {
            path: paths.binary(asset.filename, parsed.appearanceId),
            content: bytes,
            expectedSha256: null
          },
          {
            action: "delete",
            path: oldPath,
            expectedSha256: projectTransactionContentSha256(bytes)
          }
        );
        asset.directory = parsed.appearanceId;
        bytesInBatch += bytes.byteLength;
      }
      operations.push(
        {
          path: paths.manifest,
          content: serializeJson(state.manifest),
          expectedSha256: state.disk?.sha256 ?? null
        },
        {
          action: "check",
          path: state.file.reference.path,
          expectedSha256: state.file.disk.sha256
        },
        {
          action: "check",
          path: "long/index.json",
          expectedSha256: state.loaded.indexDisk.sha256
        }
      );
      await commitProjectTransaction({
        projectRoot: canonical,
        operations,
        maxFileBytes: MAX_LEDGER_RECORD_BYTES
      });
      state = await loadCharacterProfileState(ctx, canonical, parsed);
      if (!state.profile.appearances.some((a) => a.id === parsed.appearanceId))
        throw new Error("角色形象已在其它位置更新，请重新读取后再复制路径。");
    }
    // Validate all retained image paths before reporting a usable directory.
    for (const asset of state.manifest.assets.filter(
      (a) => a.appearanceId === parsed.appearanceId
    ))
      await readCharacterAssetBytes(
        state.loaded,
        paths.binary(asset.filename, asset.directory)
      );
    return LongPrepareCharacterAppearanceDirectoryResultSchema.parse({
      assetsDirectory: directory,
      snapshot: characterProfileSnapshot(state)
    });
  });
}
