import { z } from "zod";
import { EnvelopeBaseSchema } from "./envelope";

export const FishAudioFileSchema = z.object({
  name: z.string().min(1).max(240),
  mimeType: z.string().min(1).max(80),
  durationSeconds: z.number().positive().max(120),
  base64: z.string().min(1).max(30_000_000)
});
export type FishAudioFile = z.infer<typeof FishAudioFileSchema>;

export const FishAudioRecordSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("voice"),
  bookId: z.string().min(1),
  characterId: z.string().min(1),
  characterName: z.string().min(1),
  title: z.string().min(1),
  mode: z.enum(["clone", "design"]).optional(),
  prompt: z.string().optional(),
  createdAt: z.string().datetime()
});
export type FishAudioRecord = z.infer<typeof FishAudioRecordSchema>;
export const FishAudioCatalogItemSchema = FishAudioRecordSchema.pick({
  id: true,
  kind: true,
  title: true
}).extend({
  createdAt: z.string().datetime().optional()
});
export type FishAudioCatalogItem = z.infer<typeof FishAudioCatalogItemSchema>;
export function fishAudioPageUrl(
  item: Pick<FishAudioCatalogItem, "kind" | "id">
): string {
  return `https://fish.audio/zh-CN/app/m/${encodeURIComponent(item.id)}/`;
}
export const FishAudioSettingsStatusSchema = z.object({
  hasApiKey: z.boolean()
});
export const FishAudioDeleteResultSchema = z.object({ deleted: z.boolean() });
export const FishAudioCancelResultSchema = z.object({ cancelled: z.boolean() });
export const FishAudioProgressStageSchema = z.literal("voice.create");
export const FishAudioProgressPayloadSchema = z.object({
  operationId: z.string().min(1),
  stage: FishAudioProgressStageSchema,
  status: z.enum(["running", "completed", "error"]),
  detail: z.string().max(1000).optional()
});
export type FishAudioProgressPayload = z.infer<
  typeof FishAudioProgressPayloadSchema
>;
export const FishAudioProgressEventEnvelopeSchema = EnvelopeBaseSchema.extend({
  type: z.literal("fishAudio.progress"),
  payload: FishAudioProgressPayloadSchema
});
export const FishAudioVoiceDetailSchema = z
  .object({
    _id: z.string().min(1),
    title: z.string(),
    state: z.string().optional(),
    languages: z.array(z.string()).optional(),
    samples: z.array(z.unknown()).optional()
  })
  .passthrough();

export const FishAudioCommandPayloadSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("settings.get") }),
  z.object({
    action: z.literal("settings.save"),
    apiKey: z.string().trim().min(1).max(300)
  }),
  z.object({ action: z.literal("settings.clear") }),
  z.object({ action: z.literal("catalog.list") }),
  z.object({
    action: z.literal("operation.cancel"),
    operationId: z.string().min(1).max(120)
  }),
  z.object({
    action: z.literal("voice.create"),
    operationId: z.string().min(1).max(120).optional(),
    bookId: z.string().min(1),
    characterId: z.string().min(1),
    characterName: z.string().min(1).max(120),
    title: z.string().trim().min(1).max(120),
    mode: z.literal("clone"),
    files: z.array(FishAudioFileSchema).min(1).max(20)
  }),
  z.object({
    action: z.literal("record.delete"),
    kind: z.literal("voice"),
    id: z.string().min(1)
  }),
  z.object({ action: z.literal("voice.detail"), id: z.string().min(1) })
]);
export type FishAudioCommandPayload = z.infer<
  typeof FishAudioCommandPayloadSchema
>;
export const FishAudioCommandEnvelopeSchema = EnvelopeBaseSchema.extend({
  type: z.literal("fishAudio.execute"),
  payload: FishAudioCommandPayloadSchema
});

export interface FishAudioPreloadApi {
  execute(payload: FishAudioCommandPayload): Promise<unknown>;
}
