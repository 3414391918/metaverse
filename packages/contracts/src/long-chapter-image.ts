import { z } from "zod";
import { EnvelopeBaseSchema } from "./envelope";
import { LongBookIdSchema, LongChapterCardIdSchema } from "./long-workspace";
import {
  LongWriteDocumentInputSchema,
  LongWriteDocumentResultSchema
} from "./long-workspace-api";

export const LONG_CHAPTER_IMAGE_MAX_BYTES = 100 * 1024 * 1024;
export const LONG_CHAPTER_IMAGE_MAX_PIXELS = 40_000_000;
/** Chapter files can use either a hashed storage directory or their stable id. */
export function isLongChapterImageDirectory(value: string): boolean {
  return (
    /^[a-f0-9]{32}$/u.test(value) ||
    LongChapterCardIdSchema.safeParse(value).success
  );
}

export function longChapterImageDirectoryFromBodyPath(
  path: string
): string | undefined {
  const directory = /^long\/chapters\/([^/]+)\/body\.md$/u.exec(path)?.[1];
  return directory && isLongChapterImageDirectory(directory)
    ? directory
    : undefined;
}
const pngDataUrl = z
  .string()
  .max(Math.ceil(LONG_CHAPTER_IMAGE_MAX_BYTES / 3) * 4 + 32)
  // Repeating quartet groups can exhaust V8's RegExp stack on large images.
  .regex(/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/u)
  .refine(
    (value) => (value.length - "data:image/png;base64,".length) % 4 === 0,
    "PNG base64 data must contain complete encoding quartets."
  );
const revision = z.string().regex(/^[a-f0-9]{64}$/u);
export const LongReadChapterImageInputSchema = z
  .object({
    bookId: LongBookIdSchema,
    chapterCardId: LongChapterCardIdSchema,
    filename: z
      .string()
      .max(256)
      .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*\.(?:png|jpe?g|webp|gif|avif)$/iu)
  })
  .strict();
export const LongReadChapterImageResultSchema = z
  .object({ pngDataUrl, revision })
  .strict();
export const LongReplaceChapterImageInputSchema =
  LongReadChapterImageInputSchema.extend({
    pngDataUrl,
    expectedRevision: revision
  }).strict();
export const LongReplaceChapterImageResultSchema = z
  .object({ revision })
  .strict();
export const LongDeleteChapterImageInputSchema =
  LongReadChapterImageInputSchema.extend({
    offset: z.number().int().nonnegative(),
    expectedContent: LongWriteDocumentInputSchema.shape.content,
    expectedRevision: revision.optional()
  }).strict();
export const LongDeleteChapterImageResultSchema = z
  .object({
    content: LongWriteDocumentInputSchema.shape.content,
    fileDeleted: z.boolean(),
    selectionOffset: z.number().int().nonnegative(),
    document: LongWriteDocumentResultSchema
  })
  .strict();
export const LongReadClipboardImageResultSchema = z
  .object({ pngDataUrl })
  .strict()
  .nullable();
export const LongCopyChapterImageResultSchema = z
  .object({ copied: z.literal(true) })
  .strict();
/** The verified file path is returned only to the trusted main process. */
export const LongChapterImageCopySourceSchema = z
  .object({ path: z.string().min(1), revision })
  .strict();
export const LongAddChapterImageInputSchema = z
  .object({
    bookId: LongBookIdSchema,
    chapterCardId: LongChapterCardIdSchema,
    pngDataUrl,
    content: LongWriteDocumentInputSchema.shape.content,
    expectedContent: LongWriteDocumentInputSchema.shape.content,
    offset: z.number().int().nonnegative()
  })
  .strict();
export const LongAddChapterImageResultSchema = z
  .object({
    filename: LongReadChapterImageInputSchema.shape.filename,
    content: LongWriteDocumentInputSchema.shape.content,
    selectionOffset: z.number().int().nonnegative(),
    document: LongWriteDocumentResultSchema
  })
  .strict();
export type LongAddChapterImageInput = z.infer<
  typeof LongAddChapterImageInputSchema
>;
export type LongAddChapterImageResult = z.infer<
  typeof LongAddChapterImageResultSchema
>;
export type LongReadChapterImageInput = z.infer<
  typeof LongReadChapterImageInputSchema
>;
export type LongReadChapterImageResult = z.infer<
  typeof LongReadChapterImageResultSchema
>;
export type LongReplaceChapterImageInput = z.infer<
  typeof LongReplaceChapterImageInputSchema
>;
export type LongReplaceChapterImageResult = z.infer<
  typeof LongReplaceChapterImageResultSchema
>;
export type LongDeleteChapterImageInput = z.infer<
  typeof LongDeleteChapterImageInputSchema
>;
export type LongDeleteChapterImageResult = z.infer<
  typeof LongDeleteChapterImageResultSchema
>;
export type LongReadClipboardImageResult = z.infer<
  typeof LongReadClipboardImageResultSchema
>;
export type LongCopyChapterImageResult = z.infer<
  typeof LongCopyChapterImageResultSchema
>;
export const LongChapterImageCommandSchemas = [
  EnvelopeBaseSchema.extend({
    type: z.literal("long.addChapterImage"),
    payload: LongAddChapterImageInputSchema
  }),
  EnvelopeBaseSchema.extend({
    type: z.literal("long.readChapterImage"),
    payload: LongReadChapterImageInputSchema
  }),
  EnvelopeBaseSchema.extend({
    type: z.literal("long.replaceChapterImage"),
    payload: LongReplaceChapterImageInputSchema
  }),
  EnvelopeBaseSchema.extend({
    type: z.literal("long.deleteChapterImage"),
    payload: LongDeleteChapterImageInputSchema
  }),
  EnvelopeBaseSchema.extend({
    type: z.literal("long.copyChapterImage"),
    payload: LongReadChapterImageInputSchema
  }),
  EnvelopeBaseSchema.extend({
    type: z.literal("long.copyChapterImagePath"),
    payload: LongReadChapterImageInputSchema
  }),
  EnvelopeBaseSchema.extend({
    type: z.literal("long.readClipboardImage"),
    payload: z.object({}).strict()
  })
] as const;
