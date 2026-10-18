import { z } from "zod";
import { EnvelopeBaseSchema } from "./envelope";
import {
  ChatAssistantRoleplayConfigSchema,
  type ChatAssistantRoleplayConfig,
  type ChatAssistantProjectConfig,
  type ChatAssistantProjectRef
} from "./chat-assistant-base";
export const ChatAssistantRoleplayListSchema = z
  .array(ChatAssistantRoleplayConfigSchema)
  .max(1000);
export const ChatAssistantRoleplayCommandSchemas = [
  EnvelopeBaseSchema.extend({
    type: z.literal("chatAssistantRoleplay.list"),
    payload: z.object({}).strict()
  }),
  EnvelopeBaseSchema.extend({
    type: z.literal("chatAssistantRoleplay.save"),
    payload: ChatAssistantRoleplayConfigSchema
  })
] as const;
export interface ChatAssistantConfigApi {
  chatAssistantProjectConfig?: {
    list(): Promise<ChatAssistantProjectRef[]>;
    get(project: ChatAssistantProjectRef): Promise<ChatAssistantProjectConfig>;
    save(
      project: ChatAssistantProjectRef,
      systemPrompt: string
    ): Promise<ChatAssistantProjectConfig>;
    reset(
      project: ChatAssistantProjectRef
    ): Promise<ChatAssistantProjectConfig>;
  };
  chatAssistantRoleplay?: {
    list(): Promise<ChatAssistantRoleplayConfig[]>;
    save(
      config: ChatAssistantRoleplayConfig
    ): Promise<ChatAssistantRoleplayConfig>;
  };
}
