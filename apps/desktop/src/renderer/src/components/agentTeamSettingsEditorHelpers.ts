import {
  BUILT_IN_REASONING_LEVELS,
  type BuiltInReasoningLevel,
  type ModelConfig,
  type ShortAgentSubagentDefinition,
  type ThinkingLevel,
  type LongAgentTeamSettingsInput
} from "@deepwrite/contracts/renderer";
import { BUILT_IN_THINKING_LABELS } from "./agentTeamSettingsMeta";

export function agentTeamThinkingLabel(level: ThinkingLevel): string {
  if (level === "off") return "关闭";
  return BUILT_IN_REASONING_LEVELS.includes(level as BuiltInReasoningLevel)
    ? BUILT_IN_THINKING_LABELS[level as BuiltInReasoningLevel]
    : `自定义（${level}）`;
}

export function agentTeamModelDefaults(model: ModelConfig | undefined): {
  thinkingLevel: ThinkingLevel;
  temperature: number;
} {
  return {
    thinkingLevel: model?.defaultThinkingLevel ?? "medium",
    temperature: model?.temperatureOptions[1] ?? 0.7
  };
}

export function nextCopiedSubagentName(
  name: string,
  existingNames: readonly string[],
  maxLength: number
): string {
  const trimmed = name.trim() || "未命名子智能体";
  const existing = new Set(
    existingNames.map((item) => item.trim().toLocaleLowerCase())
  );
  const numbered = trimmed.match(/^(.*) (\d+)$/);
  const base = numbered?.[1]?.trim() || trimmed;
  let index = numbered ? Number(numbered[2]) + 1 : 2;

  for (let attempt = 0; attempt < 10_000; attempt += 1, index += 1) {
    const suffix = ` ${index}`;
    const allowedBaseLength = Math.max(1, maxLength - suffix.length);
    const candidateBase =
      base.length <= allowedBaseLength
        ? base
        : base.slice(0, allowedBaseLength).trimEnd();
    const candidate = `${candidateBase}${suffix}`.slice(0, maxLength);
    if (!existing.has(candidate.toLocaleLowerCase())) {
      return candidate;
    }
  }

  return `${base} ${Date.now()}`.slice(0, maxLength);
}

export function createCopiedSubagent(
  source: ShortAgentSubagentDefinition,
  existing: readonly Pick<ShortAgentSubagentDefinition, "name">[],
  nextId: string,
  maxNameLength: number
): ShortAgentSubagentDefinition {
  return {
    ...source,
    id: nextId,
    name: nextCopiedSubagentName(
      source.name,
      existing.map((item) => item.name),
      maxNameLength
    )
  };
}

export function validateAgentTeamDraft(
  teams: LongAgentTeamSettingsInput["teams"],
  models: readonly ModelConfig[]
): string | null {
  for (const team of teams) {
    const ids = new Set<string>();
    const names = new Set<string>();
    for (const subagent of team.subagents) {
      if (!subagent.name.trim()) return "子智能体名称不能为空";
      if (!subagent.description.trim()) return "子智能体能力说明不能为空";
      if (!subagent.systemPrompt.trim()) return "子智能体系统提示词不能为空";
      if (subagent.modelMode === "custom") {
        if (!subagent.modelId?.trim()) return "单独配置模型时必须选择模型";
        const model = models.find(
          (candidate) => candidate.id === subagent.modelId
        );
        if (!model) {
          return `子智能体「${subagent.name.trim() || "未命名"}」所选模型不存在，请重新选择`;
        }
        if (subagent.thinkingLevel === undefined) {
          return "单独配置模型时必须选择思考等级";
        }
        if (
          subagent.thinkingLevel !== "off" &&
          !model.thinkingLevelOptions.includes(subagent.thinkingLevel)
        ) {
          return `子智能体「${subagent.name.trim() || "未命名"}」的思考等级不在所选模型配置中`;
        }
        if (subagent.thinkingLevel === "off") {
          if (subagent.temperature === undefined) {
            return "思考等级关闭时必须选择温度";
          }
          if (!model.temperatureOptions.includes(subagent.temperature)) {
            return `子智能体「${subagent.name.trim() || "未命名"}」的温度不在所选模型配置中`;
          }
        }
      }
      const id = subagent.id.toLocaleLowerCase();
      const name = subagent.name.trim().toLocaleLowerCase();
      if (ids.has(id)) return "同一主智能体下的子智能体 ID 不能重复";
      if (names.has(name)) return "同一主智能体下的子智能体名称不能重复";
      ids.add(id);
      names.add(name);
    }
  }
  return null;
}
