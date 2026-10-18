import { z } from "zod";
import { EnvelopeBaseSchema } from "./envelope";
import {
  LongGetCharacterAppearanceReferencesInputSchema,
  LongPrepareCharacterAppearanceDirectoryInputSchema,
  LongDeleteCharacterAppearanceInputSchema
} from "./long-character-appearance";
import {
  LongCopyCharacterAssetInputSchema,
  LongDeleteCharacterAssetInputSchema,
  LongImportCharacterAssetsAtPathsInputSchema,
  LongImportCharacterAssetsInputSchema,
  LongReadCharacterProfileInputSchema,
  LongRenameCharacterAssetInputSchema,
  LongSaveCharacterProfileInputSchema
} from "./long-character-profile";

export const LongCharacterProfileCommandSchemas = [
  EnvelopeBaseSchema.extend({
    type: z.literal("long.prepareCharacterAppearanceDirectory"),
    payload: LongPrepareCharacterAppearanceDirectoryInputSchema
  }),
  EnvelopeBaseSchema.extend({
    type: z.literal("long.deleteCharacterAppearance"),
    payload: LongDeleteCharacterAppearanceInputSchema
  }),
  EnvelopeBaseSchema.extend({
    type: z.literal("long.getCharacterAppearanceReferences"),
    payload: LongGetCharacterAppearanceReferencesInputSchema
  }),
  EnvelopeBaseSchema.extend({
    type: z.literal("long.readCharacterProfile"),
    payload: LongReadCharacterProfileInputSchema
  }),
  EnvelopeBaseSchema.extend({
    type: z.literal("long.saveCharacterProfile"),
    payload: LongSaveCharacterProfileInputSchema
  }),
  EnvelopeBaseSchema.extend({
    type: z.literal("long.importCharacterAssets"),
    payload: LongImportCharacterAssetsInputSchema
  }),
  EnvelopeBaseSchema.extend({
    type: z.literal("long.importCharacterAssetsAtPaths"),
    payload: LongImportCharacterAssetsAtPathsInputSchema
  }),
  EnvelopeBaseSchema.extend({
    type: z.literal("long.renameCharacterAsset"),
    payload: LongRenameCharacterAssetInputSchema
  }),
  EnvelopeBaseSchema.extend({
    type: z.literal("long.deleteCharacterAsset"),
    payload: LongDeleteCharacterAssetInputSchema
  }),
  EnvelopeBaseSchema.extend({
    type: z.literal("long.copyCharacterAsset"),
    payload: LongCopyCharacterAssetInputSchema
  })
] as const;
