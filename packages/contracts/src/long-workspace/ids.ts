import { z } from "zod";

import { LongTimestampSchema } from "./primitives";

export const LONG_WORKSPACE_SCHEMA_VERSION = 1 as const;
export const LONG_PROJECT_MANIFEST_SCHEMA_VERSION = 1 as const;
export const LONG_WORKSPACE_INDEX_PATH = "long/index.json" as const;
export const LONG_AGENTS_MD_PATH = "AGENTS.md" as const;
export const LONG_AGENTS_MD_MAX_CHARACTERS = 10_000;

export { DEFAULT_LONG_AGENTS_MD } from "./default-writing-context";

export function longAgentsMdCharacterCount(content: string): number {
  return Array.from(content).length;
}

export const LongWorkspaceSchemaVersionSchema = z.literal(
  LONG_WORKSPACE_SCHEMA_VERSION
);
export type LongWorkspaceSchemaVersion = z.infer<
  typeof LongWorkspaceSchemaVersionSchema
>;

export const LongProjectManifestSchemaVersionSchema = z.literal(
  LONG_PROJECT_MANIFEST_SCHEMA_VERSION
);
export type LongProjectManifestSchemaVersion = z.infer<
  typeof LongProjectManifestSchemaVersionSchema
>;

/**
 * Long-form ids are opaque and stable. Display names and mutable ordering must
 * never be encoded as the identity of an entity.
 */
export const LongStableIdSchema = z
  .string()
  .trim()
  .min(3)
  .max(160)
  .regex(
    /^[a-z][a-z0-9-]*_[A-Za-z0-9](?:[A-Za-z0-9._:-]*[A-Za-z0-9])?$/,
    "Long-form ids must be opaque, prefixed stable ids."
  );
export type LongStableId = z.infer<typeof LongStableIdSchema>;

function stableIdWithPrefix(prefix: string) {
  return LongStableIdSchema.refine((value) => value.startsWith(`${prefix}_`), {
    message: `Expected a stable ${prefix}_ id.`
  });
}

export const LongBookIdSchema = stableIdWithPrefix("longbook");
export type LongBookId = z.infer<typeof LongBookIdSchema>;
export const LongWorldbuildingCategoryIdSchema = stableIdWithPrefix("world");
export type LongWorldbuildingCategoryId = z.infer<
  typeof LongWorldbuildingCategoryIdSchema
>;
export const LongWorldbuildingItemIdSchema = stableIdWithPrefix("worlditem");
export type LongWorldbuildingItemId = z.infer<
  typeof LongWorldbuildingItemIdSchema
>;
export const LongCharacterIdSchema = stableIdWithPrefix("character");
export type LongCharacterId = z.infer<typeof LongCharacterIdSchema>;
export const LongCustomCharacterTypeIdSchema = stableIdWithPrefix("chartype");
export type LongCustomCharacterTypeId = z.infer<
  typeof LongCustomCharacterTypeIdSchema
>;
export const LongVolumeIdSchema = stableIdWithPrefix("volume");
export type LongVolumeId = z.infer<typeof LongVolumeIdSchema>;
export const LongArcIdSchema = stableIdWithPrefix("arc");
export type LongArcId = z.infer<typeof LongArcIdSchema>;
export const LongChapterCardIdSchema = stableIdWithPrefix("chapter");
export type LongChapterCardId = z.infer<typeof LongChapterCardIdSchema>;
export const LongStoryEventIdSchema = stableIdWithPrefix("event");
export type LongStoryEventId = z.infer<typeof LongStoryEventIdSchema>;
/** Plot-point-bound story plot entries shown in the「故事情节」tab. */
export const LongStoryPlotIdSchema = stableIdWithPrefix("storyplot");
export type LongStoryPlotId = z.infer<typeof LongStoryPlotIdSchema>;
export const LongEventConnectionIdSchema = stableIdWithPrefix("connection");
export type LongEventConnectionId = z.infer<typeof LongEventConnectionIdSchema>;
export const LongNarrativePlacementIdSchema = stableIdWithPrefix("placement");
export type LongNarrativePlacementId = z.infer<
  typeof LongNarrativePlacementIdSchema
>;
export const LongForeshadowingIdSchema = stableIdWithPrefix("foreshadow");
export type LongForeshadowingId = z.infer<typeof LongForeshadowingIdSchema>;
export const LongForeshadowingBeatIdSchema = stableIdWithPrefix("beat");
export type LongForeshadowingBeatId = z.infer<
  typeof LongForeshadowingBeatIdSchema
>;
export const LongLedgerCommitIdSchema = stableIdWithPrefix("commit");
export type LongLedgerCommitId = z.infer<typeof LongLedgerCommitIdSchema>;
export const LongContinuityFactIdSchema = stableIdWithPrefix("fact");
export type LongContinuityFactId = z.infer<typeof LongContinuityFactIdSchema>;
export const LongContinuityOpenLoopIdSchema = stableIdWithPrefix("loop");
export type LongContinuityOpenLoopId = z.infer<
  typeof LongContinuityOpenLoopIdSchema
>;
export const LongFileIdSchema = stableIdWithPrefix("file");
export type LongFileId = z.infer<typeof LongFileIdSchema>;

function isSafeLongProjectPath(value: string): boolean {
  if (
    value.startsWith("/") ||
    /^[a-zA-Z]:\//u.test(value) ||
    value.includes("\\") ||
    value.includes("\0")
  ) {
    return false;
  }
  const segments = value.split("/");
  return (
    segments.length > 1 &&
    segments.every(
      (segment) => segment.length > 0 && segment !== "." && segment !== ".."
    ) &&
    (value.endsWith(".md") || value.endsWith(".json"))
  );
}

export const LongProjectRelativePathSchema = z
  .string()
  .trim()
  .min(1)
  .max(2_048)
  .refine(isSafeLongProjectPath, {
    message:
      "Long-form project paths must be safe relative Markdown or JSON paths."
  });
export type LongProjectRelativePath = z.infer<
  typeof LongProjectRelativePathSchema
>;

export const LongWorkspaceFileReferenceSchema = z
  .object({
    id: LongFileIdSchema,
    path: LongProjectRelativePathSchema,
    updatedAt: LongTimestampSchema
  })
  .strict();
export type LongWorkspaceFileReference = z.infer<
  typeof LongWorkspaceFileReferenceSchema
>;

export const LongMarkdownFileReferenceSchema =
  LongWorkspaceFileReferenceSchema.refine((file) => file.path.endsWith(".md"), {
    path: ["path"],
    message: "This long-form file must use a .md path."
  });
export type LongMarkdownFileReference = z.infer<
  typeof LongMarkdownFileReferenceSchema
>;

export const LongJsonFileReferenceSchema =
  LongWorkspaceFileReferenceSchema.refine(
    (file) => file.path.endsWith(".json"),
    {
      path: ["path"],
      message: "This long-form file must use a .json path."
    }
  );
export type LongJsonFileReference = z.infer<typeof LongJsonFileReferenceSchema>;

export function longWorldbuildingFileId(categoryId: string): string {
  return `file_${categoryId}:content`;
}

export function longWorldbuildingOverviewFileId(categoryId: string): string {
  return `file_${categoryId}:overview`;
}

export function longWorldbuildingItemFileId(itemId: string): string {
  return `file_${itemId}:content`;
}

export const LONG_CHARACTER_OVERVIEW_FILE_ID =
  "file_characters:overview" as const;
export const LONG_CHARACTER_OVERVIEW_PATH =
  "long/characters/overview.md" as const;

export function longCharacterOverviewFileId(): string {
  return LONG_CHARACTER_OVERVIEW_FILE_ID;
}

export function longCharacterOverviewContentPath(): string {
  return LONG_CHARACTER_OVERVIEW_PATH;
}

export function longCharacterCoreProfileFileId(characterId: string): string {
  return `file_${characterId}:core-profile`;
}

export function longCharacterRelationshipsFileId(characterId: string): string {
  return `file_${characterId}:relationships`;
}

export function longCharacterCurrentStateFileId(characterId: string): string {
  return `file_${characterId}:current-state`;
}

export function longCharacterHistoryFileId(characterId: string): string {
  return `file_${characterId}:history`;
}

export function longStoryPlotBodyFileId(storyPlotId: string): string {
  return `file_${storyPlotId}:body`;
}

export function longChapterBodyFileId(chapterCardId: string): string {
  return `file_${chapterCardId}:body`;
}

export function longChapterCardFileId(chapterCardId: string): string {
  return `file_${chapterCardId}:card`;
}

export function longChapterCharacterStateFileId(chapterCardId: string): string {
  return `file_${chapterCardId}:character-state`;
}

export function longChapterHandoffFileId(chapterCardId: string): string {
  return `file_${chapterCardId}:handoff`;
}

export function longChapterForeshadowingChangesFileId(
  chapterCardId: string
): string {
  return `file_${chapterCardId}:continuity:foreshadowing-changes`;
}

export function longChapterWorldRevealsFileId(chapterCardId: string): string {
  return `file_${chapterCardId}:continuity:world-reveals`;
}

export function longChapterCharacterCurrentStateFileId(
  chapterCardId: string,
  characterId: string
): string {
  return `file_${chapterCardId}:continuity:character:${characterId}:current-state`;
}

export function longChapterCharacterHistoryFileId(
  chapterCardId: string,
  characterId: string
): string {
  return `file_${chapterCardId}:continuity:character:${characterId}:history`;
}

export function longLedgerCommitFileId(commitId: string): string {
  return `file_${commitId}:ledger`;
}

export const LongChapterBodyStatusSchema = z.enum(["empty", "written"]);
export type LongChapterBodyStatus = z.infer<typeof LongChapterBodyStatusSchema>;

export function longWorldbuildingContentPath(categoryId: string): string {
  return `long/worldbuilding/${categoryId}/content.md`;
}

export function longWorldbuildingOverviewContentPath(
  categoryId: string
): string {
  return `long/worldbuilding/${categoryId}/overview.md`;
}

export function longWorldbuildingItemContentPath(
  categoryId: string,
  itemId: string
): string {
  return `long/worldbuilding/${categoryId}/items/${itemId}.md`;
}

export function longCharacterFilePath(
  characterId: string,
  filename:
    "core-profile.md" | "relationships.md" | "current-state.md" | "history.md"
): string {
  return `long/characters/${characterId}/${filename}`;
}

export function longChapterFilePath(
  chapterCardId: string,
  filename: "body.md" | "card.md" | "character-state.md" | "handoff.md"
): string {
  return `long/chapters/${chapterCardId}/${filename}`;
}

export function longChapterContinuityFilePath(
  chapterCardId: string,
  filename: "foreshadowing-changes.md" | "world-reveals.md"
): string {
  return `long/continuity/chapters/${chapterCardId}/${filename}`;
}

export function longChapterCharacterContinuityFilePath(
  chapterCardId: string,
  characterId: string,
  filename: "current-state.md" | "history.md"
): string {
  return `long/continuity/chapters/${chapterCardId}/characters/${characterId}/${filename}`;
}

export function longStoryPlotFilePath(
  storyPlotId: string,
  filename: "body.md" = "body.md"
): string {
  return `long/story-plots/${storyPlotId}/${filename}`;
}

export function createEmptyLongMarkdownFileReference(
  id: string,
  path: string,
  updatedAt: string
): LongMarkdownFileReference {
  return LongMarkdownFileReferenceSchema.parse({
    id,
    path,
    updatedAt
  });
}

export const LONG_BOOK_LINE_FILE_ID = "file_long-book-line" as const;
export const LONG_WORKSPACE_INDEX_FILE_ID =
  "file_long-workspace-index" as const;
