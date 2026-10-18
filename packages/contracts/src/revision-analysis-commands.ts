import { z } from "zod";
import { EnvelopeBaseSchema } from "./envelope";
import { RevisionAnalysisSettingsSchema } from "./revision-analysis";
export const RevisionAnalysisCommandSchemas = [
  EnvelopeBaseSchema.extend({
    type: z.literal("revisionAnalysisSettings.list"),
    payload: z.object({})
  }),
  EnvelopeBaseSchema.extend({
    type: z.literal("revisionAnalysisSettings.save"),
    payload: RevisionAnalysisSettingsSchema
  }),
  EnvelopeBaseSchema.extend({
    type: z.literal("revisionAnalysisSettings.reset"),
    payload: z.object({})
  })
] as const;
