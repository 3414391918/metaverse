import { z } from "zod";
import { LongCharacterGroupSchema, LongTitleSchema } from "./long-workspace";
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
import {
  LongCharacterAppearanceSchema,
  LongCharacterProfileSchema,
  LongImportCharacterAssetsAtPathsInputSchema,
  LongSaveCharacterProfileInputSchema
} from "./long-character-profile";
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
      "character.assets.import",
      "character.save",
      "character.create",
      "appearance.add",
      "appearance.catalog",
      "appearance.prompt",
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
export const ToolkitImportCharacterAssetsInputSchema =
  LongImportCharacterAssetsAtPathsInputSchema.omit({ bookId: true });
export const ToolkitAppearancePromptInputSchema = z
  .object({
    characterId: LongCharacterIdSchema,
    appearanceId: LongCharacterAppearanceSchema.shape.id
  })
  .strict();
export const ToolkitAppearanceCatalogInputSchema = z
  .object({
    offset: z.number().int().nonnegative().default(0),
    limit: z.number().int().positive().max(100).default(50)
  })
  .strict();
export const ToolkitCreateCharacterInputSchema = z
  .object({
    group: LongCharacterGroupSchema,
    name: LongTitleSchema,
    faceDescription: LongCharacterProfileSchema.shape.faceDescription.refine(
      (value) => value.trim().length > 0,
      "请填写脸部身材描述。"
    ),
    settingDescription:
      LongCharacterProfileSchema.shape.settingDescription.refine(
        (value) => value.trim().length > 0,
        "请填写角色设定描述。"
      ),
    keywords: LongCharacterProfileSchema.shape.keywords.optional(),
    appearances: z
      .array(
        LongCharacterAppearanceSchema.pick({
          name: true,
          description: true
        }).extend({
          description: LongCharacterAppearanceSchema.shape.description.refine(
            (value) => value.trim().length > 0,
            "请填写形象文本描述。"
          )
        })
      )
      .optional()
  })
  .strict();
export const ToolkitAddAppearanceInputSchema = z
  .object({
    characterId: LongCharacterIdSchema,
    name: LongCharacterAppearanceSchema.shape.name,
    description: LongCharacterAppearanceSchema.shape.description.refine(
      (value) => value.trim().length > 0,
      "请填写形象文本描述。"
    ),
    expectedRevision: z.string().regex(/^[a-f0-9]{64}$/u)
  })
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
  "character.create": ToolkitCreateCharacterInputSchema,
  "appearance.add": ToolkitAddAppearanceInputSchema,
  "appearance.catalog": ToolkitAppearanceCatalogInputSchema,
  "appearance.prompt": ToolkitAppearancePromptInputSchema,
  "appearance.prepare": LongPrepareCharacterAppearanceDirectoryInputSchema,
  "appearance.delete": LongDeleteCharacterAppearanceInputSchema,
  "illustration.add": ToolkitAddIllustrationInputSchema,
  "illustration.delete": ToolkitDeleteIllustrationInputSchema,
  "illustration.references": ToolkitIllustrationReferencesInputSchema,
  "character.assets": ToolkitCharacterAssetsInputSchema,
  "character.assets.import": ToolkitImportCharacterAssetsInputSchema
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
      "character.create",
      "appearance.add",
      "appearance.catalog",
      "appearance.prompt",
      "appearance.prepare",
      "appearance.delete",
      "illustration.add",
      "illustration.delete",
      "illustration.references",
      "character.assets",
      "character.assets.import"
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
