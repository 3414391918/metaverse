import { createHash } from "node:crypto";
import {
  LongWorkspaceOperationBatchSchema,
  isStructuredLongCharacterProfileMarkdown,
  longCharacterKeywordsAliases,
  parseLongCharacterProfileMarkdown,
  serializeLongCharacterProfileMarkdown,
  type LongWorkspaceOperationBatch
} from "@deepwrite/contracts";
import { loadIndexedFile } from "./cache";
import type { LoadedLongProject } from "./types";

/** Metadata edits retain the Markdown keywords as the text authority. */
export async function materializeCharacterAliasBatch(
  loaded: LoadedLongProject,
  input: LongWorkspaceOperationBatch
): Promise<LongWorkspaceOperationBatch> {
  const aliasesByCharacterId = new Map<string, string[]>();
  for (const operation of input.operations) {
    if (
      operation.type === "character.update" &&
      operation.patch.aliases !== undefined
    )
      aliasesByCharacterId.set(operation.id, operation.patch.aliases);
  }
  if (!aliasesByCharacterId.size) return input;
  const documentWrites = [...input.documentWrites];
  for (const [characterId, aliases] of aliasesByCharacterId) {
    const creation = input.operations.find(
      (
        operation
      ): operation is Extract<
        LongWorkspaceOperationBatch["operations"][number],
        { type: "character.create" }
      > =>
        operation.type === "character.create" &&
        operation.character.id === characterId
    );
    const entry =
      loaded.index.characterFiles.find(
        (candidate) => candidate.characterId === characterId
      ) ?? creation?.files;
    const character =
      loaded.index.characters.find(({ id }) => id === characterId) ??
      creation?.character;
    if (!entry || !character) continue;
    if (
      JSON.stringify(longCharacterKeywordsAliases(aliases.join("、"))) !==
      JSON.stringify(aliases)
    )
      throw new Error("角色别名不能包含关键词分隔符，请将每个关键词分别列出。");
    const source = loaded.files.has(entry.coreProfile.id)
      ? await loadIndexedFile(loaded, entry.coreProfile.id)
      : null;
    const explicit = documentWrites.find(
      ({ fileId }) => fileId === entry.coreProfile.id
    );
    if (explicit) {
      const content =
        explicit.mode === "append"
          ? (source?.disk.content ?? "") + explicit.content
          : explicit.content;
      if (isStructuredLongCharacterProfileMarkdown(content)) {
        const keywords = parseLongCharacterProfileMarkdown(
          content,
          character.name,
          aliases
        ).keywords;
        if (
          JSON.stringify(longCharacterKeywordsAliases(keywords)) !==
          JSON.stringify(aliases)
        )
          throw new Error(
            "角色元数据别名与核心档案关键词冲突，请保持两处提案一致。"
          );
      }
      continue;
    }
    if (
      !source ||
      !isStructuredLongCharacterProfileMarkdown(source.disk.content)
    )
      continue;
    const profile = parseLongCharacterProfileMarkdown(
      source.disk.content,
      character.name,
      character.aliases
    );
    const keywords = aliases.join("、");
    if (profile.keywords === keywords) continue;
    documentWrites.push({
      proposalId: `proposal_${createHash("sha256").update(`character-aliases:${input.updatedAt}:${characterId}`).digest("hex").slice(0, 24)}`,
      fileId: entry.coreProfile.id,
      mode: "replace",
      content: serializeLongCharacterProfileMarkdown({ ...profile, keywords }),
      updatedAt: input.updatedAt,
      reason: "同步角色别名到核心档案关键词"
    });
  }
  return LongWorkspaceOperationBatchSchema.parse({ ...input, documentWrites });
}
