import { z } from "zod";
import { BookSchema, CatalogIndexSnapshotSchema } from "./catalog";
import {
  CHAT_ASSISTANT_PROJECT_PROMPT_MAX_LENGTH,
  ChatAssistantRoleplayRuntimeContextSchema,
  ChatAssistantProjectRefSchema
} from "./chat-assistant-base";
import { EnvelopeBaseSchema } from "./envelope";
import { LongBookSummarySchema } from "./long-workspace";
import { ModelUsageDashboardSchema } from "./model-usage";
import {
  ModelApiSchema,
  ModelManagedBySchema,
  TemperatureOptionsSchema,
  ThinkingLevelOptionsSchema,
  ThinkingLevelSchema
} from "./models";

export * from "./chat-assistant-base";

export const ChatAssistantProjectConfigGetCommandEnvelopeSchema =
  EnvelopeBaseSchema.extend({
    type: z.literal("chatAssistantProjectConfig.get"),
    payload: ChatAssistantProjectRefSchema
  });

export const ChatAssistantProjectConfigListCommandEnvelopeSchema =
  EnvelopeBaseSchema.extend({
    type: z.literal("chatAssistantProjectConfig.list"),
    payload: z.object({}).strict()
  });

export const ChatAssistantProjectConfigListSchema = z
  .array(ChatAssistantProjectRefSchema)
  .max(100_000);
export type ChatAssistantProjectConfigList = z.infer<
  typeof ChatAssistantProjectConfigListSchema
>;

export const ChatAssistantProjectConfigSaveCommandEnvelopeSchema =
  EnvelopeBaseSchema.extend({
    type: z.literal("chatAssistantProjectConfig.save"),
    payload: z
      .object({
        project: ChatAssistantProjectRefSchema,
        systemPrompt: z
          .string()
          .trim()
          .min(1)
          .max(CHAT_ASSISTANT_PROJECT_PROMPT_MAX_LENGTH)
      })
      .strict()
  });

export const ChatAssistantProjectConfigResetCommandEnvelopeSchema =
  EnvelopeBaseSchema.extend({
    type: z.literal("chatAssistantProjectConfig.reset"),
    payload: ChatAssistantProjectRefSchema
  });

export const ChatAssistantSoftwareContextSchema = z
  .object({
    name: z.literal("DeepWrite"),
    version: z.string().trim().min(1).max(64),
    platform: z.string().trim().min(1).max(64),
    arch: z.string().trim().min(1).max(64),
    currentTime: z.string().datetime(),
    timezone: z.string().trim().min(1).max(120)
  })
  .strict();
export type ChatAssistantSoftwareContext = z.infer<
  typeof ChatAssistantSoftwareContextSchema
>;

/** A deliberately redacted model descriptor exposed to the assistant. */
export const ChatAssistantModelConfigSchema = z
  .object({
    id: z.string().trim().min(1).max(120),
    label: z.string().trim().min(1).max(120),
    provider: z.string().trim().min(1).max(120),
    modelId: z.string().trim().min(1).max(240),
    api: ModelApiSchema,
    reasoning: z.boolean(),
    defaultThinkingLevel: ThinkingLevelSchema,
    thinkingLevelOptions: ThinkingLevelOptionsSchema,
    temperatureOptions: TemperatureOptionsSchema,
    credentialConfigured: z.boolean(),
    managedBy: ModelManagedBySchema.optional(),
    status: z.union([z.literal(0), z.literal(1)]).optional(),
    discount: z.number().finite().positive().max(1).optional(),
    input: z.number().finite().nonnegative().optional(),
    output: z.number().finite().nonnegative().optional(),
    cache: z.number().finite().nonnegative().optional()
  })
  .strict();
export type ChatAssistantModelConfig = z.infer<
  typeof ChatAssistantModelConfigSchema
>;

export const ChatAssistantUsagePeriodSchema = z.enum([
  "today",
  "7d",
  "30d",
  "all"
]);
export type ChatAssistantUsagePeriod = z.infer<
  typeof ChatAssistantUsagePeriodSchema
>;

const ChatAssistantRuntimeBaseSchema = z.object({
  software: ChatAssistantSoftwareContextSchema,
  catalog: CatalogIndexSnapshotSchema,
  longBooks: z.array(LongBookSummarySchema).max(100_000),
  models: z.array(ChatAssistantModelConfigSchema).max(100),
  defaultModelId: z.string().max(120),
  usage: z.record(ChatAssistantUsagePeriodSchema, ModelUsageDashboardSchema)
});

export const ChatAssistantRuntimeContextSchema = z.discriminatedUnion("mode", [
  ChatAssistantRoleplayRuntimeContextSchema,
  ChatAssistantRuntimeBaseSchema.extend({ mode: z.literal("normal") }).strict(),
  ChatAssistantRuntimeBaseSchema.extend({
    mode: z.literal("project"),
    project: ChatAssistantProjectRefSchema,
    projectPrompt: z
      .string()
      .trim()
      .min(1)
      .max(CHAT_ASSISTANT_PROJECT_PROMPT_MAX_LENGTH),
    projectBook: z.union([BookSchema, LongBookSummarySchema])
  })
    .strict()
    .superRefine((value, context) => {
      if (value.projectBook.id !== value.project.projectId) {
        context.addIssue({
          code: "custom",
          path: ["projectBook", "id"],
          message:
            "Chat assistant project snapshot must match the selected project."
        });
      }
      if (value.projectBook.bookType !== value.project.projectType) {
        context.addIssue({
          code: "custom",
          path: ["projectBook", "bookType"],
          message:
            "Chat assistant project type must match the selected project."
        });
      }
    })
]);
export type ChatAssistantRuntimeContext = z.infer<
  typeof ChatAssistantRuntimeContextSchema
>;
