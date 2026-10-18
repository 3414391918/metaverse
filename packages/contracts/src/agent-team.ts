import { z } from "zod";
import { TemperatureSchema, ThinkingLevelSchema } from "./models";
export const SHORT_AGENT_SUBAGENT_MAX_COUNT = 60;
export const LONG_AGENT_SUBAGENT_MAX_COUNT = 60;
export const SHORT_AGENT_SUBAGENT_ID_MAX_LENGTH = 120;
export const SHORT_AGENT_SUBAGENT_NAME_MAX_LENGTH = 80;
export const SHORT_AGENT_SUBAGENT_DESCRIPTION_MAX_LENGTH = 1_000;
export const SHORT_AGENT_SUBAGENT_SYSTEM_PROMPT_MAX_LENGTH = 20_000;
export const SHORT_AGENT_SUBAGENT_MODEL_ID_MAX_LENGTH = 120;

export const ShortAgentSubagentModelModeSchema = z.enum(["inherit", "custom"]);
export type ShortAgentSubagentModelMode = z.infer<
  typeof ShortAgentSubagentModelModeSchema
>;

export const ShortAgentSubagentDefinitionSchema = z
  .object({
    id: z
      .string()
      .trim()
      .min(1)
      .max(SHORT_AGENT_SUBAGENT_ID_MAX_LENGTH)
      .regex(
        /^[A-Za-z0-9][A-Za-z0-9_-]*$/,
        "Subagent id may contain only letters, numbers, underscores, and hyphens."
      ),
    name: z.string().trim().min(1).max(SHORT_AGENT_SUBAGENT_NAME_MAX_LENGTH),
    description: z
      .string()
      .trim()
      .min(1)
      .max(SHORT_AGENT_SUBAGENT_DESCRIPTION_MAX_LENGTH),
    systemPrompt: z
      .string()
      .trim()
      .min(1)
      .max(SHORT_AGENT_SUBAGENT_SYSTEM_PROMPT_MAX_LENGTH),
    enabled: z.boolean(),
    modelMode: ShortAgentSubagentModelModeSchema.default("inherit"),
    modelId: z
      .string()
      .trim()
      .min(1)
      .max(SHORT_AGENT_SUBAGENT_MODEL_ID_MAX_LENGTH)
      .optional(),
    thinkingLevel: ThinkingLevelSchema.optional(),
    temperature: TemperatureSchema.optional()
  })
  .superRefine((value, context) => {
    if (value.modelMode !== "custom") return;
    if (!value.modelId) {
      context.addIssue({
        code: "custom",
        path: ["modelId"],
        message: "单独配置模型时必须选择模型。"
      });
    }
    if (value.thinkingLevel === undefined) {
      context.addIssue({
        code: "custom",
        path: ["thinkingLevel"],
        message: "单独配置模型时必须选择思考等级。"
      });
    } else if (
      value.thinkingLevel === "off" &&
      value.temperature === undefined
    ) {
      context.addIssue({
        code: "custom",
        path: ["temperature"],
        message: "思考等级关闭时必须选择温度。"
      });
    }
  });
export type ShortAgentSubagentDefinition = z.infer<
  typeof ShortAgentSubagentDefinitionSchema
>;

function validateUniqueSubagents(
  subagents: readonly ShortAgentSubagentDefinition[],
  context: z.core.$RefinementCtx<unknown>
): void {
  const ids = new Map<string, number>();
  const names = new Map<string, number>();
  subagents.forEach((subagent, index) => {
    const normalizedId = subagent.id.toLocaleLowerCase();
    const existingIdIndex = ids.get(normalizedId);
    if (existingIdIndex !== undefined) {
      context.addIssue({
        code: "custom",
        path: [index, "id"],
        message: `Duplicate subagent id: ${subagent.id}`
      });
    } else {
      ids.set(normalizedId, index);
    }

    const normalizedName = subagent.name.toLocaleLowerCase();
    const existingNameIndex = names.get(normalizedName);
    if (existingNameIndex !== undefined) {
      context.addIssue({
        code: "custom",
        path: [index, "name"],
        message: `Duplicate subagent name: ${subagent.name}`
      });
    } else {
      names.set(normalizedName, index);
    }
  });
}

export const ShortAgentSubagentDefinitionsSchema = z
  .array(ShortAgentSubagentDefinitionSchema)
  .max(SHORT_AGENT_SUBAGENT_MAX_COUNT)
  .superRefine(validateUniqueSubagents);

export const LongAgentSubagentDefinitionsSchema = z
  .array(ShortAgentSubagentDefinitionSchema)
  .max(LONG_AGENT_SUBAGENT_MAX_COUNT)
  .superRefine(validateUniqueSubagents);
