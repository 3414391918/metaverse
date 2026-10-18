import { createHash } from "node:crypto";
import { posix } from "node:path";
import {
  LongCharacterAssetManifestSchema,
  LongCharacterProfileSnapshotSchema,
  parseLongCharacterProfileMarkdown,
  type LongCharacterAssetManifest,
  type LongCharacterProfile,
  type LongReadCharacterProfileInput
} from "@deepwrite/contracts";
import { loadIndexedFile } from "./cache";
import { isNodeError, parseJson, readSecureTextFile } from "./io";
import { loadProject } from "./load-project";
import type { LongProjectStoreContext } from "./store-context";
import {
  MAX_DOCUMENT_BYTES,
  type LoadedLongProject,
  type SecureTextFile
} from "./types";

export function characterAssetPaths(coreProfilePath: string) {
  const directory = posix.dirname(coreProfilePath);
  return {
    manifest: `${directory}/assets.json`,
    binary: (filename: string, appearanceDirectory?: string) =>
      `${directory}/assets/${appearanceDirectory ? `${appearanceDirectory}/` : ""}${filename}`,
    legacy: `${directory}/core-profile.legacy.md`
  };
}

export async function readCharacterAssetManifest(
  loaded: LoadedLongProject,
  coreProfilePath: string
): Promise<{
  manifest: LongCharacterAssetManifest;
  disk: SecureTextFile | null;
}> {
  try {
    const disk = await readSecureTextFile(
      loaded.projectDirectory,
      characterAssetPaths(coreProfilePath).manifest,
      MAX_DOCUMENT_BYTES
    );
    return {
      manifest: LongCharacterAssetManifestSchema.parse(
        parseJson(disk.content, "角色图片清单")
      ),
      disk
    };
  } catch (error) {
    if (isNodeError(error, "ENOENT"))
      return { manifest: { version: 1, assets: [] }, disk: null };
    throw error;
  }
}

export async function loadCharacterProfileState(
  ctx: LongProjectStoreContext,
  projectDirectory: string,
  input: LongReadCharacterProfileInput
) {
  const loaded = await loadProject(ctx, projectDirectory);
  if (loaded.book.id !== input.bookId)
    throw new Error("角色所属作品与登记作品不一致。");
  const character = loaded.index.characters.find(
    ({ id }) => id === input.characterId
  );
  const entry = loaded.index.characterFiles.find(
    ({ characterId }) => characterId === input.characterId
  );
  if (!character || !entry) throw new Error("角色核心档案不存在。");
  const file = await loadIndexedFile(loaded, entry.coreProfile.id);
  const profile = parseLongCharacterProfileMarkdown(
    file.disk.content,
    character.name,
    character.aliases
  );
  const assets = await readCharacterAssetManifest(loaded, file.reference.path);
  assertCharacterAssetsAppearances(profile, assets.manifest);
  return { loaded, character, file, profile, ...assets };
}
export type CharacterProfileState = Awaited<
  ReturnType<typeof loadCharacterProfileState>
>;

export function assertCharacterAssetsAppearances(
  profile: LongCharacterProfile,
  manifest: LongCharacterAssetManifest
) {
  const ids = new Set(profile.appearances.map(({ id }) => id));
  if (manifest.assets.some(({ appearanceId }) => !ids.has(appearanceId))) {
    throw new Error("形象仍包含图片，不能移除形象标识。请先删除该形象的图片。");
  }
}

export function characterProfileSnapshot(state: CharacterProfileState) {
  const revision = createHash("sha256")
    .update(state.file.disk.bytes)
    .update("\0")
    .update(JSON.stringify(state.character))
    .digest("hex");
  return LongCharacterProfileSnapshotSchema.parse({
    bookId: state.loaded.book.id,
    characterId: state.character.id,
    profile: state.profile,
    assets: state.manifest.assets,
    revision
  });
}
