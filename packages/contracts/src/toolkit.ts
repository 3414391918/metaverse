import { z } from "zod";
import {
  LongChapterCardIdSchema,
  LongCharacterIdSchema
} from "./long-workspace";
import { CreateLongBookInputSchema } from "./long-workspace-api";
import {
  LongCommitChapterInputSchema,
  LongDeleteLedgerCommitInputSchema,
  LongWriteChapterInputSchema
} from "./long-ledger";
import { LongWorkspaceOperationBatchSchema } from "./long-workspace-operations";
import { LongSaveCharacterProfileInputSchema } from "./long-character-profile";
import { LongReadChapterImageInputSchema } from "./long-chapter-image";
import {
  LongPrepareCharacterAppearanceDirectoryInputSchema,
  LongDeleteCharacterAppearanceInputSchema
} from "./long-character-appearance";
import {
  CreateLibraryInputSchema,
  CreateLibraryEntryInputSchema,
  SaveLibraryEntryInputSchema,
  RemoveLibraryEntryInputSchema,
  UpdateLibraryInputSchema
} from "./catalog";

export const ToolkitStringSchema = z.string();
export const ToolkitDirectorySchema = z.string().min(1);
export const ToolkitDirectoriesSchema = z.array(ToolkitDirectorySchema);
export const WorkspaceToolRequestSchema = z
  .object({
    action: z.enum([
      "schema",
      "create",
      "index",
      "read",
      "write",
      "search",
      "preview",
      "apply",
      "writeChapter",
      "commitChapter",
      "deleteLedgerCommit",
      "character.read",
      "character.assets",
      "character.save",
      "appearance.prepare",
      "appearance.delete",
      "illustration.add",
      "illustration.delete",
      "illustration.references",
      "agents.read",
      "agents.write"
    ]),
    input: z.record(z.string(), z.unknown()).default({})
  })
  .strict();
export const ContextToolRequestSchema = z
  .object({
    action: z.enum([
      "schema",
      "list",
      "read",
      "bookContext",
      "createLibrary",
      "createEntry",
      "saveEntry",
      "deleteEntry",
      "updateLibrary"
    ]),
    input: z.record(z.string(), z.unknown()).default({})
  })
  .strict();
export const ToolkitReadInputSchema = z
  .object({
    fileId: z.string().min(1),
    offset: z.number().int().nonnegative().optional(),
    limit: z.number().int().positive().optional(),
    full: z.boolean().default(true)
  })
  .strict();
export const ToolkitWriteInputSchema = z
  .object({
    fileId: z.string().min(1),
    content: z.string(),
    expectedSha256: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional()
  })
  .strict();
export const ToolkitSearchInputSchema = z
  .object({
    query: z.string(),
    fileIds: z.array(z.string()),
    maxResults: z.number().optional(),
    contextCharacters: z.number().optional(),
    resume: z
      .object({
        fileIndex: z.number(),
        fileId: z.string(),
        characterOffset: z.number()
      })
      .optional()
  })
  .strict();
export const ToolkitAddIllustrationInputSchema = z
  .object({
    chapterCardId: LongChapterCardIdSchema,
    imagePath: ToolkitDirectorySchema,
    expectedSha256: z.string().regex(/^[a-f0-9]{64}$/),
    offset: z.number().int().nonnegative()
  })
  .strict();
export const ToolkitIllustrationReferencesInputSchema = z
  .object({ chapterCardId: LongChapterCardIdSchema })
  .strict();
export const ToolkitDeleteIllustrationInputSchema = z
  .object({
    chapterCardId: LongChapterCardIdSchema,
    filename: LongReadChapterImageInputSchema.shape.filename,
    expectedSha256: z.string().regex(/^[a-f0-9]{64}$/),
    offset: z.number().int().nonnegative()
  })
  .strict();
export const ToolkitCharacterAssetsInputSchema = z
  .object({ characterId: LongCharacterIdSchema })
  .strict();

const workspaceSchemas = {
  create: CreateLongBookInputSchema.extend({
    parentDirectory: ToolkitDirectorySchema
  }),
  apply: LongWorkspaceOperationBatchSchema,
  preview: LongWorkspaceOperationBatchSchema,
  writeChapter: LongWriteChapterInputSchema,
  commitChapter: LongCommitChapterInputSchema,
  deleteLedgerCommit: LongDeleteLedgerCommitInputSchema,
  "character.save": LongSaveCharacterProfileInputSchema,
  "appearance.prepare": LongPrepareCharacterAppearanceDirectoryInputSchema,
  "appearance.delete": LongDeleteCharacterAppearanceInputSchema,
  "illustration.add": ToolkitAddIllustrationInputSchema,
  "illustration.delete": ToolkitDeleteIllustrationInputSchema,
  "illustration.references": ToolkitIllustrationReferencesInputSchema,
  "character.assets": ToolkitCharacterAssetsInputSchema
};
const contextSchemas = {
  createLibrary: CreateLibraryInputSchema,
  createEntry: CreateLibraryEntryInputSchema,
  saveEntry: SaveLibraryEntryInputSchema,
  deleteEntry: RemoveLibraryEntryInputSchema,
  updateLibrary: UpdateLibraryInputSchema
};
export function describeWorkspaceToolSchema(rawName: unknown) {
  const name = z
    .enum([
      "create",
      "apply",
      "preview",
      "writeChapter",
      "commitChapter",
      "deleteLedgerCommit",
      "character.save",
      "appearance.prepare",
      "appearance.delete",
      "illustration.add",
      "illustration.delete",
      "illustration.references",
      "character.assets"
    ])
    .parse(rawName);
  return {
    name,
    schema: z.toJSONSchema(workspaceSchemas[name], { unrepresentable: "any" })
  };
}
export function describeContextToolSchema(rawName: unknown) {
  const name = z
    .enum([
      "createLibrary",
      "createEntry",
      "saveEntry",
      "deleteEntry",
      "updateLibrary"
    ])
    .parse(rawName);
  return {
    name,
    schema: z.toJSONSchema(contextSchemas[name], { unrepresentable: "any" })
  };
}
