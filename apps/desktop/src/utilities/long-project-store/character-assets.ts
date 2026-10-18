import { randomUUID } from "node:crypto";
import { basename, extname } from "node:path";
import {
  LONG_CHARACTER_IMAGE_BATCH_MAX_BYTES,
  LongCharacterAssetManifestSchema,
  LongDeleteCharacterAssetInputSchema,
  LongImportCharacterAssetsAtPathsInputSchema,
  LongRenameCharacterAssetInputSchema,
  type LongDeleteCharacterAssetInput,
  type LongImportCharacterAssetsAtPathsInput,
  type LongRenameCharacterAssetInput
} from "@deepwrite/contracts";
import {
  commitProjectTransaction,
  type ProjectTransactionFileOperation
} from "../project-transaction";
import {
  characterAssetPaths,
  characterProfileSnapshot,
  loadCharacterProfileState,
  type CharacterProfileState
} from "./character-profile-context";
import { readCharacterImageSource } from "./character-image-source";
import { secureDirectory, serializeJson } from "./io";
import type { LongProjectStoreContext } from "./store-context";
import { MAX_LEDGER_RECORD_BYTES } from "./types";

async function writeAssetManifest(
  state: CharacterProfileState,
  operations: ProjectTransactionFileOperation[]
) {
  await commitProjectTransaction({
    projectRoot: state.loaded.projectDirectory,
    operations: [
      ...operations,
      {
        path: characterAssetPaths(state.file.reference.path).manifest,
        content: serializeJson(
          LongCharacterAssetManifestSchema.parse(state.manifest)
        ),
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
    ],
    maxFileBytes: MAX_LEDGER_RECORD_BYTES
  });
}

export async function importCharacterAssetsAtPaths(
  ctx: LongProjectStoreContext,
  projectDirectory: string,
  input: LongImportCharacterAssetsAtPathsInput
) {
  const parsed = LongImportCharacterAssetsAtPathsInputSchema.parse(input);
  const canonical = await secureDirectory(projectDirectory, "长篇项目目录");
  return await ctx.runExclusive(canonical, async () => {
    const state = await loadCharacterProfileState(ctx, canonical, parsed);
    if (!state.profile.appearances.some(({ id }) => id === parsed.appearanceId))
      throw new Error("目标形象不存在，请先保存形象。");
    const paths = characterAssetPaths(state.file.reference.path);
    const operations: ProjectTransactionFileOperation[] = [];
    let totalBytes = 0;
    for (const sourcePath of parsed.sourcePaths) {
      const source = await readCharacterImageSource(sourcePath);
      totalBytes += source.bytes.byteLength;
      if (totalBytes > LONG_CHARACTER_IMAGE_BATCH_MAX_BYTES)
        throw new Error("本批图片总大小超过 500 MB 限制。");
      const id = randomUUID().replaceAll("-", "");
      const filename = `${id}.${source.extension}`;
      const label =
        basename(sourcePath, extname(sourcePath)).trim().slice(0, 256) ||
        "图片";
      state.manifest.assets.push({
        id,
        appearanceId: parsed.appearanceId,
        directory: parsed.appearanceId,
        filename,
        label
      });
      operations.push({
        path: paths.binary(filename, parsed.appearanceId),
        content: source.bytes,
        expectedSha256: null
      });
    }
    await writeAssetManifest(state, operations);
    return characterProfileSnapshot(
      await loadCharacterProfileState(ctx, canonical, parsed)
    );
  });
}

export async function renameCharacterAsset(
  ctx: LongProjectStoreContext,
  projectDirectory: string,
  input: LongRenameCharacterAssetInput
) {
  const parsed = LongRenameCharacterAssetInputSchema.parse(input);
  const canonical = await secureDirectory(projectDirectory, "长篇项目目录");
  return await ctx.runExclusive(canonical, async () => {
    const state = await loadCharacterProfileState(ctx, canonical, parsed);
    const asset = state.manifest.assets.find(({ id }) => id === parsed.assetId);
    if (!asset) throw new Error("角色图片不存在。");
    asset.label = parsed.label;
    await writeAssetManifest(state, []);
    return characterProfileSnapshot(
      await loadCharacterProfileState(ctx, canonical, parsed)
    );
  });
}

export async function deleteCharacterAsset(
  ctx: LongProjectStoreContext,
  projectDirectory: string,
  input: LongDeleteCharacterAssetInput
) {
  const parsed = LongDeleteCharacterAssetInputSchema.parse(input);
  const canonical = await secureDirectory(projectDirectory, "长篇项目目录");
  return await ctx.runExclusive(canonical, async () => {
    const state = await loadCharacterProfileState(ctx, canonical, parsed);
    const asset = state.manifest.assets.find(({ id }) => id === parsed.assetId);
    if (!asset) throw new Error("角色图片不存在。");
    state.manifest.assets = state.manifest.assets.filter(
      ({ id }) => id !== parsed.assetId
    );
    await writeAssetManifest(state, [
      {
        action: "delete",
        path: characterAssetPaths(state.file.reference.path).binary(
          asset.filename,
          asset.directory
        )
      }
    ]);
    return characterProfileSnapshot(
      await loadCharacterProfileState(ctx, canonical, parsed)
    );
  });
}
