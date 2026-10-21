import { z } from "zod";
import { EnvelopeBaseSchema } from "./envelope";
import { LongBookIdSchema, LongChapterCardIdSchema } from "./long-workspace";
import {
  LongWriteDocumentInputSchema,
  LongWriteDocumentResultSchema
} from "./long-workspace-api";

export const LONG_CHAPTER_VIDEO_MAX_BYTES = 100 * 1024 * 1024;
const revision = z.string().regex(/^[a-f0-9]{64}$/u);
const filename = z
  .string()
  .max(256)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*\.(?:mp4|webm)$/iu);
const videoDataUrl = z
  .string()
  .max(Math.ceil(LONG_CHAPTER_VIDEO_MAX_BYTES / 3) * 4 + 40)
  .regex(/^data:video\/(?:mp4|webm);base64,[A-Za-z0-9+/]+={0,2}$/u)
  .refine(
    (value) => value.slice(value.indexOf(",") + 1).length % 4 === 0,
    "Video base64 data must contain complete encoding quartets."
  );

export const LongReadChapterVideoInputSchema = z
  .object({
    bookId: LongBookIdSchema,
    chapterCardId: LongChapterCardIdSchema,
    filename
  })
  .strict();
export const LongReadChapterVideoResultSchema = z.object({ revision }).strict();
export const LongAddChapterVideoInputSchema = z
  .object({
    bookId: LongBookIdSchema,
    chapterCardId: LongChapterCardIdSchema,
    videoDataUrl,
    content: LongWriteDocumentInputSchema.shape.content,
    expectedContent: LongWriteDocumentInputSchema.shape.content,
    offset: z.number().int().nonnegative()
  })
  .strict();
export const LongAddChapterVideoResultSchema = z
  .object({
    filename,
    content: LongWriteDocumentInputSchema.shape.content,
    selectionOffset: z.number().int().nonnegative(),
    document: LongWriteDocumentResultSchema
  })
  .strict();
export const LongReplaceChapterVideoInputSchema =
  LongReadChapterVideoInputSchema.extend({
    videoDataUrl,
    expectedRevision: revision
  }).strict();
export const LongReplaceChapterVideoResultSchema = z
  .object({ revision })
  .strict();
export const LongDeleteChapterVideoInputSchema =
  LongReadChapterVideoInputSchema.extend({
    offset: z.number().int().nonnegative(),
    expectedContent: LongWriteDocumentInputSchema.shape.content,
    expectedRevision: revision.optional()
  }).strict();
export const LongDeleteChapterVideoResultSchema = z
  .object({
    content: LongWriteDocumentInputSchema.shape.content,
    fileDeleted: z.boolean(),
    selectionOffset: z.number().int().nonnegative(),
    document: LongWriteDocumentResultSchema
  })
  .strict();
export const LongCopyChapterVideoResultSchema = z
  .object({ copied: z.literal(true) })
  .strict();
/** The verified file path is returned only to the trusted main process. */
export const LongChapterVideoCopySourceSchema = z
  .object({ path: z.string().min(1), revision })
  .strict();

export type LongReadChapterVideoInput = z.infer<
  typeof LongReadChapterVideoInputSchema
>;
export type LongReadChapterVideoResult = z.infer<
  typeof LongReadChapterVideoResultSchema
>;
export type LongAddChapterVideoInput = z.infer<
  typeof LongAddChapterVideoInputSchema
>;
export type LongAddChapterVideoResult = z.infer<
  typeof LongAddChapterVideoResultSchema
>;
export type LongReplaceChapterVideoInput = z.infer<
  typeof LongReplaceChapterVideoInputSchema
>;
export type LongReplaceChapterVideoResult = z.infer<
  typeof LongReplaceChapterVideoResultSchema
>;
export type LongDeleteChapterVideoInput = z.infer<
  typeof LongDeleteChapterVideoInputSchema
>;
export type LongDeleteChapterVideoResult = z.infer<
  typeof LongDeleteChapterVideoResultSchema
>;
export type LongCopyChapterVideoResult = z.infer<
  typeof LongCopyChapterVideoResultSchema
>;

export const LongChapterVideoCommandSchemas = [
  EnvelopeBaseSchema.extend({
    type: z.literal("long.addChapterVideo"),
    payload: LongAddChapterVideoInputSchema
  }),
  EnvelopeBaseSchema.extend({
    type: z.literal("long.readChapterVideo"),
    payload: LongReadChapterVideoInputSchema
  }),
  EnvelopeBaseSchema.extend({
    type: z.literal("long.replaceChapterVideo"),
    payload: LongReplaceChapterVideoInputSchema
  }),
  EnvelopeBaseSchema.extend({
    type: z.literal("long.deleteChapterVideo"),
    payload: LongDeleteChapterVideoInputSchema
  }),
  EnvelopeBaseSchema.extend({
    type: z.literal("long.copyChapterVideo"),
    payload: LongReadChapterVideoInputSchema
  }),
  EnvelopeBaseSchema.extend({
    type: z.literal("long.copyChapterVideoPath"),
    payload: LongReadChapterVideoInputSchema
  })
] as const;
