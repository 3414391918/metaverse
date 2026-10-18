import {
  LONG_WORKSPACE_INDEX_PATH,
  LongProjectManifestSchema,
  LongWorkspaceIndexSnapshotSchema,
  isStructuredLongCharacterProfileMarkdown,
  longCharacterKeywordsAliases,
  serializeLongCharacterProfileMarkdown,
  type LongCharacterProfile
} from "@deepwrite/contracts";
import type { ProjectTransactionFileOperation } from "../project-transaction";
import {
  characterAssetPaths,
  type CharacterProfileState
} from "./character-profile-context";
import { encodeUtf8Strict, serializeJson } from "./io";
import { MANIFEST_PATH, MAX_DOCUMENT_BYTES } from "./types";

/** Shared atomic document/index updates for explicit profile mutations. */
export function characterProfileWriteOperations(
  state: CharacterProfileState,
  profile: LongCharacterProfile,
  timestamp: string,
  preserveLegacy = true
): ProjectTransactionFileOperation[] {
  const content = serializeLongCharacterProfileMarkdown(profile);
  if (encodeUtf8Strict(content).byteLength > MAX_DOCUMENT_BYTES)
    throw new Error("角色核心档案超过 32 MiB 大小限制。");
  const nextIndex = LongWorkspaceIndexSnapshotSchema.parse(
    structuredClone(state.loaded.index)
  );
  const character = nextIndex.characters.find(
    ({ id }) => id === state.character.id
  )!;
  character.name = profile.name;
  character.aliases = longCharacterKeywordsAliases(profile.keywords);
  nextIndex.characterFiles.find(
    ({ characterId }) => characterId === state.character.id
  )!.coreProfile.updatedAt = timestamp;
  nextIndex.updatedAt = timestamp;
  const manifest = LongProjectManifestSchema.parse({
    ...state.loaded.manifest,
    updatedAt: timestamp,
    workspaceIndexFile: {
      ...state.loaded.manifest.workspaceIndexFile,
      updatedAt: timestamp
    }
  });
  const operations: ProjectTransactionFileOperation[] = [
    {
      path: state.file.reference.path,
      content,
      expectedSha256: state.file.disk.sha256
    },
    {
      path: LONG_WORKSPACE_INDEX_PATH,
      content: serializeJson(nextIndex),
      expectedSha256: state.loaded.indexDisk.sha256
    },
    {
      path: MANIFEST_PATH,
      content: serializeJson(manifest),
      expectedSha256: state.loaded.manifestDisk.sha256
    }
  ];
  if (
    preserveLegacy &&
    !isStructuredLongCharacterProfileMarkdown(state.file.disk.content)
  )
    operations.push({
      path: characterAssetPaths(state.file.reference.path).legacy,
      content: state.file.disk.bytes,
      expectedSha256: null
    });
  return operations;
}
