import { z } from "zod";
import { EnvelopeBaseSchema } from "./envelope";
import { RevisionAnalysisResultSchema } from "./revision-analysis";
import { AgentRuntimeRefSchema } from "./session/runtime";
const Id = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9_-]+$/iu);
export const RevisionAnalysisResultEventSchema = EnvelopeBaseSchema.extend({
  type: z.literal("revision_analysis.result_updated"),
  payload: z.object({
    sessionId: z.string().min(1),
    runId: z.string().min(1),
    jobId: Id,
    runtime: AgentRuntimeRefSchema,
    toolCallId: z.string().min(1),
    result: RevisionAnalysisResultSchema
  })
});
export type RevisionAnalysisResultEvent = z.infer<
  typeof RevisionAnalysisResultEventSchema
>;
