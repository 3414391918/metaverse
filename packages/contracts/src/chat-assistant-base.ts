import { z } from "zod";

export const CHAT_ASSISTANT_PROJECT_PROMPT_MAX_LENGTH = 60_000;

export const DEFAULT_CHAT_ASSISTANT_PROJECT_PROMPT = [
  "你是当前书籍项目的只读分析与创作顾问。",
  "结合本轮注入的项目结构和只读查询工具，帮助用户跨阶段梳理设定、人物、剧情、正文与连续性信息。",
  "需要引用作品事实时先查询核对；不要把目录、搜索片段或未读取正文当成已经确认的事实。"
].join("\n");

export const ChatAssistantModeSchema = z.enum([
  "normal",
  "roleplay",
  "project"
]);
export type ChatAssistantMode = z.infer<typeof ChatAssistantModeSchema>;

export const ChatAssistantProjectTypeSchema = z.enum([
  "short",
  "script",
  "long"
]);
export type ChatAssistantProjectType = z.infer<
  typeof ChatAssistantProjectTypeSchema
>;

export const ChatAssistantProjectRefSchema = z
  .object({
    projectType: ChatAssistantProjectTypeSchema,
    projectId: z.string().trim().min(1).max(512)
  })
  .strict();
export type ChatAssistantProjectRef = z.infer<
  typeof ChatAssistantProjectRefSchema
>;

export const CHAT_ASSISTANT_ROLEPLAY_PROMPT_SUFFIX =
  "上述是人物定义，请你一直扮演这个人物，用于和用户沟通，开始吧";
export const ChatAssistantRoleplayConfigSchema = z
  .object({
    id: z.string().trim().min(1).max(120),
    name: z.string().trim().min(1).max(120),
    systemPrompt: z
      .string()
      .trim()
      .min(1)
      .max(CHAT_ASSISTANT_PROJECT_PROMPT_MAX_LENGTH)
  })
  .strict();
export type ChatAssistantRoleplayConfig = z.infer<
  typeof ChatAssistantRoleplayConfigSchema
>;
export const ChatAssistantRoleplayContextSchema = z
  .object({
    mode: z.literal("roleplay"),
    roleId: ChatAssistantRoleplayConfigSchema.shape.id
  })
  .strict();
export const ChatAssistantRoleplayRuntimeContextSchema =
  ChatAssistantRoleplayContextSchema.extend({
    systemPrompt: ChatAssistantRoleplayConfigSchema.shape.systemPrompt
  }).strict();

export const ChatAssistantRequestContextSchema = z.discriminatedUnion("mode", [
  ChatAssistantRoleplayContextSchema,
  z
    .object({
      mode: z.literal("normal"),
      webSearchEnabled: z.boolean().optional()
    })
    .strict(),
  z
    .object({
      mode: z.literal("project"),
      project: ChatAssistantProjectRefSchema,
      webSearchEnabled: z.boolean().optional()
    })
    .strict()
]);
export type ChatAssistantRequestContext = z.infer<
  typeof ChatAssistantRequestContextSchema
>;

export const ChatAssistantProjectConfigSchema = z
  .object({
    project: ChatAssistantProjectRefSchema,
    systemPrompt: z
      .string()
      .trim()
      .min(1)
      .max(CHAT_ASSISTANT_PROJECT_PROMPT_MAX_LENGTH),
    customized: z.boolean()
  })
  .strict();
export type ChatAssistantProjectConfig = z.infer<
  typeof ChatAssistantProjectConfigSchema
>;
