import { z } from "zod";
import { LongBookIdSchema, LongCharacterIdSchema } from "./long-workspace/ids";
import { LongTitleSchema } from "./long-workspace/primitives";

export const LONG_CHARACTER_IMAGE_MAX_BYTES = 100 * 1024 * 1024;
export const LONG_CHARACTER_IMAGE_BATCH_MAX_BYTES = 500 * 1024 * 1024;
export const LONG_CHARACTER_IMAGE_BATCH_MAX_FILES = 100;
export const LongCharacterAppearanceIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,159}$/u);
const ProfileTextSchema = z
  .string()
  .max(1_000_000)
  .refine(
    (value) => !value.includes("<!-- deepwrite:"),
    "角色文字不能包含保留的分区标记。"
  );
export const LongCharacterAppearanceSchema = z
  .object({
    id: LongCharacterAppearanceIdSchema,
    name: LongTitleSchema.refine(
      (value) => !/[\r\n]/u.test(value),
      "形象名称必须是单行文字。"
    ),
    description: ProfileTextSchema
  })
  .strict();
export type LongCharacterAppearance = z.infer<
  typeof LongCharacterAppearanceSchema
>;

export function longCharacterKeywordsAliases(keywords: string): string[] {
  const aliases = [
    ...new Set(
      keywords
        .split(/[,，、;；\r\n]+/u)
        .map((value) => value.trim())
        .filter(Boolean)
    )
  ];
  if (aliases.length > 64 || aliases.some((value) => value.length > 120)) {
    throw new Error("角色关键词最多 64 项，每项最多 120 个字符。");
  }
  return aliases;
}

export const LongCharacterProfileSchema = z
  .object({
    name: LongTitleSchema,
    keywords: ProfileTextSchema,
    faceDescription: ProfileTextSchema,
    settingDescription: ProfileTextSchema,
    appearances: z.array(LongCharacterAppearanceSchema).max(1000)
  })
  .strict()
  .superRefine((profile, ctx) => {
    const seen = new Set<string>();
    profile.appearances.forEach((appearance, index) => {
      if (seen.has(appearance.id))
        ctx.addIssue({
          code: "custom",
          path: ["appearances", index, "id"],
          message: "形象标识重复。"
        });
      seen.add(appearance.id);
    });
    try {
      longCharacterKeywordsAliases(profile.keywords);
    } catch (error) {
      ctx.addIssue({
        code: "custom",
        path: ["keywords"],
        message: error instanceof Error ? error.message : "角色关键词无效。"
      });
    }
  });
export type LongCharacterProfile = z.infer<typeof LongCharacterProfileSchema>;
export const LongCharacterAssetIdSchema = z.string().regex(/^[a-f0-9]{32}$/u);
export const LongCharacterAssetFilenameSchema = z
  .string()
  .regex(/^[a-f0-9]{32}\.(?:png|jpg|jpeg|webp|gif|avif)$/u);
export const LongCharacterAssetSchema = z
  .object({
    id: LongCharacterAssetIdSchema,
    appearanceId: LongCharacterAppearanceIdSchema,
    directory: LongCharacterAppearanceIdSchema.optional(),
    label: z.string().trim().min(1).max(256),
    filename: LongCharacterAssetFilenameSchema
  })
  .strict()
  .refine(
    (asset) =>
      asset.directory === undefined || asset.directory === asset.appearanceId,
    "图片目录必须匹配所属形象。"
  )
  .refine(
    (asset) => asset.filename.startsWith(`${asset.id}.`),
    "图片文件名必须匹配图片标识。"
  );
export type LongCharacterAsset = z.infer<typeof LongCharacterAssetSchema>;
export const LongCharacterAssetManifestSchema = z
  .object({
    version: z.literal(1),
    assets: z.array(LongCharacterAssetSchema).max(10_000)
  })
  .strict()
  .superRefine((manifest, ctx) => {
    const ids = new Set<string>();
    manifest.assets.forEach((asset, index) => {
      if (ids.has(asset.id))
        ctx.addIssue({
          code: "custom",
          path: ["assets", index, "id"],
          message: "图片标识重复。"
        });
      ids.add(asset.id);
    });
  });
export type LongCharacterAssetManifest = z.infer<
  typeof LongCharacterAssetManifestSchema
>;
const CharacterInputShape = {
  bookId: LongBookIdSchema,
  characterId: LongCharacterIdSchema
};
export const LongCharacterProfileSnapshotSchema = z
  .object({
    ...CharacterInputShape,
    profile: LongCharacterProfileSchema,
    assets: z.array(LongCharacterAssetSchema).max(10_000),
    revision: z.string().regex(/^[a-f0-9]{64}$/u)
  })
  .strict();
export type LongCharacterProfileSnapshot = z.infer<
  typeof LongCharacterProfileSnapshotSchema
>;
export const LongReadCharacterProfileInputSchema = z
  .object(CharacterInputShape)
  .strict();
export type LongReadCharacterProfileInput = z.infer<
  typeof LongReadCharacterProfileInputSchema
>;
export const LongSaveCharacterProfileInputSchema = z
  .object({
    ...CharacterInputShape,
    profile: LongCharacterProfileSchema,
    expectedRevision: z.string().regex(/^[a-f0-9]{64}$/u)
  })
  .strict();
export type LongSaveCharacterProfileInput = z.infer<
  typeof LongSaveCharacterProfileInputSchema
>;
export const LongImportCharacterAssetsInputSchema = z
  .object({
    ...CharacterInputShape,
    appearanceId: LongCharacterAppearanceIdSchema
  })
  .strict();
export type LongImportCharacterAssetsInput = z.infer<
  typeof LongImportCharacterAssetsInputSchema
>;
export const LongImportCharacterAssetsAtPathsInputSchema = z
  .object({
    ...CharacterInputShape,
    appearanceId: LongCharacterAppearanceIdSchema,
    sourcePaths: z
      .array(z.string().min(1).max(4096))
      .min(1)
      .max(LONG_CHARACTER_IMAGE_BATCH_MAX_FILES)
  })
  .strict();
export type LongImportCharacterAssetsAtPathsInput = z.infer<
  typeof LongImportCharacterAssetsAtPathsInputSchema
>;
export const LongRenameCharacterAssetInputSchema = z
  .object({
    ...CharacterInputShape,
    assetId: LongCharacterAssetIdSchema,
    label: z.string().trim().min(1).max(256)
  })
  .strict();
export type LongRenameCharacterAssetInput = z.infer<
  typeof LongRenameCharacterAssetInputSchema
>;
export const LongDeleteCharacterAssetInputSchema = z
  .object({ ...CharacterInputShape, assetId: LongCharacterAssetIdSchema })
  .strict();
export type LongDeleteCharacterAssetInput = z.infer<
  typeof LongDeleteCharacterAssetInputSchema
>;
export const LongCopyCharacterAssetInputSchema = z
  .object({
    ...CharacterInputShape,
    assetId: LongCharacterAssetIdSchema,
    pngDataUrl: z
      .string()
      .max(140 * 1024 * 1024)
      .regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/u)
      .optional()
  })
  .strict();
export type LongCopyCharacterAssetInput = z.infer<
  typeof LongCopyCharacterAssetInputSchema
>;
export const LongCopyCharacterAssetResultSchema = z
  .object({ copied: z.boolean() })
  .strict();
export type LongCopyCharacterAssetResult = z.infer<
  typeof LongCopyCharacterAssetResultSchema
>;
export const LongImportCharacterAssetsResultSchema =
  LongCharacterProfileSnapshotSchema.nullable();
export type LongImportCharacterAssetsResult = z.infer<
  typeof LongImportCharacterAssetsResultSchema
>;
