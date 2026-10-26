import { z } from "zod";
import { EnvelopeBaseSchema } from "./envelope";
export const AssistantConnectionSchema = z.object({
  url: z
    .string()
    .url()
    .refine((value) => {
      try {
        const url = new URL(value);
        return (
          url.protocol === "http:" &&
          url.hostname === "127.0.0.1" &&
          url.pathname === "/"
        );
      } catch {
        return false;
      }
    }),
  nonce: z.string().min(32),
  workspace: z.string().min(1)
});
export type AssistantConnection = z.infer<typeof AssistantConnectionSchema>;
export const AssistantCommandEnvelopeSchema = EnvelopeBaseSchema.extend({
  type: z.enum([
    "assistant.start",
    "assistant.restart",
    "assistant.openConfiguration"
  ]),
  payload: z.object({})
});
export interface AssistantApi {
  start(): Promise<AssistantConnection>;
  restart(): Promise<AssistantConnection>;
  openConfiguration(): Promise<void>;
}
