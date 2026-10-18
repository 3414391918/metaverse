import {
  isStructuredLongCharacterProfileMarkdown,
  longCharacterKeywordsAliases,
  parseLongCharacterProfileMarkdown,
  type LongWorkspaceIndexSnapshot
} from "@deepwrite/contracts";
import {
  assertCharacterAssetsAppearances,
  readCharacterAssetManifest
} from "./character-profile-context";
import type { LoadedLongProject } from "./types";

/** All generic Markdown and proposal writes share this guard before staging. */
export async function guardCharacterProfileWrite(
  loaded: LoadedLongProject,
  fileId: string,
  previous: string,
  content: string,
  nextIndex: LongWorkspaceIndexSnapshot
) {
  const entry = nextIndex.characterFiles.find(
    ({ coreProfile }) => coreProfile.id === fileId
  );
  if (!entry) return;
  const character = nextIndex.characters.find(
    ({ id }) => id === entry.characterId
  );
  if (!character) throw new Error("角色核心档案对应的人物不存在。");
  const structuredPrevious = isStructuredLongCharacterProfileMarkdown(previous);
  if (structuredPrevious && !isStructuredLongCharacterProfileMarkdown(content))
    throw new Error("角色核心档案结构损坏：不能移除分区与形象标识。");
  if (!isStructuredLongCharacterProfileMarkdown(content)) return;
  const profile = parseLongCharacterProfileMarkdown(
    content,
    character.name,
    character.aliases
  );
  if (structuredPrevious) {
    const previousProfile = parseLongCharacterProfileMarkdown(
      previous,
      character.name,
      character.aliases
    );
    const retained = new Set(profile.appearances.map(({ id }) => id));
    if (previousProfile.appearances.some(({ id }) => !retained.has(id)))
      throw new Error(
        "角色核心档案必须保留已有形象标识，不能移除或替换形象 ID。"
      );
  }
  const previousEntry = loaded.index.characterFiles.find(
    ({ coreProfile }) => coreProfile.id === fileId
  );
  if (previousEntry) {
    const { manifest } = await readCharacterAssetManifest(
      loaded,
      previousEntry.coreProfile.path
    );
    assertCharacterAssetsAppearances(profile, manifest);
  }
  character.aliases = longCharacterKeywordsAliases(profile.keywords);
}
