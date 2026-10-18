import { rmdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  LongDeleteCharacterAppearanceInputSchema,
  LongDeleteCharacterAppearanceResultSchema,
  LongCharacterAssetManifestSchema,
  type LongDeleteCharacterAppearanceInput
} from "@deepwrite/contracts";
import {
  commitProjectTransaction,
  type ProjectTransactionFileOperation
} from "../project-transaction";
import {
  characterAssetPaths,
  characterProfileSnapshot,
  loadCharacterProfileState
} from "./character-profile-context";
import { characterProfileWriteOperations } from "./character-profile-write";
import {
  secureDirectory,
  serializeJson,
  isNodeError,
  validateParentDirectories,
  readSecureTextFile
} from "./io";
import type { LongProjectStoreContext } from "./store-context";
import { MAX_LEDGER_RECORD_BYTES, MAX_DOCUMENT_BYTES } from "./types";

export async function deleteCharacterAppearance(
  ctx: LongProjectStoreContext,
  projectDirectory: string,
  input: LongDeleteCharacterAppearanceInput
) {
  const parsed = LongDeleteCharacterAppearanceInputSchema.parse(input);
  const canonical = await secureDirectory(projectDirectory, "长篇项目目录");
  return await ctx.runExclusive(canonical, async () => {
    const state = await loadCharacterProfileState(ctx, canonical, parsed);
    if (characterProfileSnapshot(state).revision !== parsed.expectedRevision)
      throw new Error("角色档案已更新，请重新读取并确认删除。");
    if (!state.profile.appearances.some(({ id }) => id === parsed.appearanceId))
      throw new Error("形象不存在，请重新读取角色档案。");
    const assets = state.manifest.assets.filter(
      (a) => a.appearanceId === parsed.appearanceId
    );
    const ids = new Set(parsed.expectedAssetIds);
    if (ids.size !== assets.length || assets.some((a) => !ids.has(a.id)))
      throw new Error("形象图片已更新，请重新读取并确认删除。");
    const profile = {
      ...state.profile,
      appearances: state.profile.appearances.filter(
        (a) => a.id !== parsed.appearanceId
      )
    };
    const manifest = LongCharacterAssetManifestSchema.parse({
      version: 1,
      assets: state.manifest.assets.filter(
        (a) => a.appearanceId !== parsed.appearanceId
      )
    });
    const paths = characterAssetPaths(state.file.reference.path);
    const directory = join(canonical, dirname(paths.binary("placeholder.png")));
    try {
      await validateParentDirectories(canonical, directory);
    } catch (error) {
      if (!isNodeError(error, "ENOENT")) throw error;
    }
    const operations: ProjectTransactionFileOperation[] =
      characterProfileWriteOperations(state, profile, ctx.timestamp(), false);
    // The old migration copy can contain removed descriptions. It is superseded
    // by the canonical profile, which retains all other fields and appearances.
    try {
      const legacy = await readSecureTextFile(
        canonical,
        paths.legacy,
        MAX_DOCUMENT_BYTES
      );
      operations.push({
        action: "delete",
        path: paths.legacy,
        expectedSha256: legacy.sha256
      });
    } catch (error) {
      if (!isNodeError(error, "ENOENT")) throw error;
      operations.push({
        action: "check",
        path: paths.legacy,
        expectedSha256: null
      });
    }
    for (const asset of assets)
      operations.push({
        action: "delete",
        path: paths.binary(asset.filename, asset.directory)
      });
    if (manifest.assets.length)
      operations.push({
        path: paths.manifest,
        content: serializeJson(manifest),
        expectedSha256: state.disk?.sha256 ?? null
      });
    else if (state.disk)
      operations.push({
        action: "delete",
        path: paths.manifest,
        expectedSha256: state.disk.sha256
      });
    else
      operations.push({
        action: "check",
        path: paths.manifest,
        expectedSha256: null
      });
    await commitProjectTransaction({
      projectRoot: canonical,
      operations,
      maxFileBytes: MAX_LEDGER_RECORD_BYTES
    });
    let directoryCleanupWarning: string | undefined;
    // Remove only empty selected-appearance/root directories, retaining other images.
    for (const emptyDirectory of [
      join(directory, parsed.appearanceId),
      directory
    ]) {
      try {
        await validateParentDirectories(canonical, emptyDirectory);
        await rmdir(emptyDirectory);
      } catch (error) {
        if (
          !isNodeError(error, "ENOENT") &&
          !isNodeError(error, "ENOTEMPTY") &&
          !isNodeError(error, "EEXIST")
        )
          directoryCleanupWarning =
            "形象及图片已永久删除，但空的资产目录未能清理，请检查目录权限。";
      }
    }
    const snapshot = characterProfileSnapshot(
      await loadCharacterProfileState(ctx, canonical, parsed)
    );
    return LongDeleteCharacterAppearanceResultSchema.parse({
      ...snapshot,
      ...(directoryCleanupWarning ? { directoryCleanupWarning } : {})
    });
  });
}
