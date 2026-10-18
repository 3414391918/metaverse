import { dirname, resolve } from "node:path";
import {
  LONG_CHARACTER_IMAGE_MAX_BYTES,
  type LongWorkspaceIndexSnapshot
} from "@deepwrite/contracts";
import type { ProjectTransactionFileOperation } from "../project-transaction";
import {
  characterAssetPaths,
  readCharacterAssetManifest
} from "./character-profile-context";
import {
  assertContained,
  isNodeError,
  readNoFollowFile,
  readSecureTextFile,
  validateParentDirectories
} from "./io";
import { MAX_DOCUMENT_BYTES, type LoadedLongProject } from "./types";

export async function readCharacterAssetBytes(
  loaded: LoadedLongProject,
  relativePath: string
) {
  const path = resolve(loaded.projectDirectory, relativePath);
  assertContained(loaded.projectDirectory, path);
  await validateParentDirectories(loaded.projectDirectory, dirname(path));
  return (
    await readNoFollowFile(
      path,
      LONG_CHARACTER_IMAGE_MAX_BYTES,
      "角色图片",
      loaded.projectDirectory
    )
  ).bytes;
}

async function readLegacyBackup(loaded: LoadedLongProject, path: string) {
  try {
    return await readSecureTextFile(
      loaded.projectDirectory,
      path,
      MAX_DOCUMENT_BYTES
    );
  } catch (error) {
    if (isNodeError(error, "ENOENT")) return null;
    throw error;
  }
}

export async function characterAssetCopyOperations(
  loaded: LoadedLongProject
): Promise<ProjectTransactionFileOperation[]> {
  const operations: ProjectTransactionFileOperation[] = [];
  for (const entry of loaded.index.characterFiles) {
    const paths = characterAssetPaths(entry.coreProfile.path);
    const { manifest, disk } = await readCharacterAssetManifest(
      loaded,
      entry.coreProfile.path
    );
    if (disk) {
      operations.push({
        path: paths.manifest,
        content: disk.bytes,
        expectedSha256: null
      });
      for (const asset of manifest.assets)
        operations.push({
          path: paths.binary(asset.filename, asset.directory),
          content: await readCharacterAssetBytes(
            loaded,
            paths.binary(asset.filename, asset.directory)
          ),
          expectedSha256: null
        });
    }
    const legacy = await readLegacyBackup(loaded, paths.legacy);
    if (legacy)
      operations.push({
        path: paths.legacy,
        content: legacy.bytes,
        expectedSha256: null
      });
  }
  return operations;
}

export async function characterAssetDeleteOperations(
  loaded: LoadedLongProject,
  nextIndex: LongWorkspaceIndexSnapshot
): Promise<ProjectTransactionFileOperation[]> {
  const retained = new Set(nextIndex.characters.map(({ id }) => id));
  const operations: ProjectTransactionFileOperation[] = [];
  for (const entry of loaded.index.characterFiles) {
    if (retained.has(entry.characterId)) continue;
    const paths = characterAssetPaths(entry.coreProfile.path);
    const { manifest, disk } = await readCharacterAssetManifest(
      loaded,
      entry.coreProfile.path
    );
    if (disk) {
      for (const asset of manifest.assets)
        operations.push({
          action: "delete",
          path: paths.binary(asset.filename, asset.directory)
        });
      operations.push({ action: "delete", path: paths.manifest });
    }
    if (await readLegacyBackup(loaded, paths.legacy))
      operations.push({ action: "delete", path: paths.legacy });
  }
  return operations;
}
