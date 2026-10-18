import { describe, expect, it } from "vitest";
import {
  ShortAgentSubagentDefinitionSchema,
  ShortAgentSubagentDefinitionsSchema,
  type ShortAgentSubagentDefinition
} from "./agent-team";
import {
  DEFAULT_LONG_AGENT_TEAM_SETTINGS,
  LongAgentTeamSettingsSchema
} from "./long-agent-team";

const definition: ShortAgentSubagentDefinition = {
  id: "continuity_reviewer",
  name: "连续性审阅",
  description: "检查人物状态、时间线和伏笔是否前后一致。",
  systemPrompt: "只检查连续性问题，并把结论摘要交还主智能体。",
  enabled: true,
  modelMode: "inherit"
};

function completeSettings() {
  const settings = structuredClone(DEFAULT_LONG_AGENT_TEAM_SETTINGS);
  settings.teams[0]!.subagents = [{ ...definition }];
  return settings;
}

describe("agent-team contracts", () => {
  it("accepts the single main-agent team shape", () => {
    expect(LongAgentTeamSettingsSchema.parse(completeSettings())).toEqual(
      completeSettings()
    );
  });

  it("defaults missing modelMode to inherit and requires modelId for custom", () => {
    const legacy = completeSettings();
    legacy.teams[0]!.subagents = [
      {
        id: "legacy_helper",
        name: "旧配置助手",
        description: "无模型字段的旧数据。",
        systemPrompt: "保持兼容。",
        enabled: true
      } as ShortAgentSubagentDefinition
    ];
    const parsed = LongAgentTeamSettingsSchema.parse(legacy);
    expect(parsed.teams[0]?.subagents[0]).toMatchObject({
      modelMode: "inherit"
    });

    const customMissingModel = completeSettings();
    customMissingModel.teams[0]!.subagents = [
      {
        ...definition,
        modelMode: "custom"
      }
    ];
    expect(
      LongAgentTeamSettingsSchema.safeParse(customMissingModel).success
    ).toBe(false);

    const customWithModel = completeSettings();
    customWithModel.teams[0]!.subagents = [
      {
        ...definition,
        modelMode: "custom",
        modelId: "model-local-1",
        thinkingLevel: "medium"
      }
    ];
    expect(LongAgentTeamSettingsSchema.safeParse(customWithModel).success).toBe(
      true
    );

    const customOffWithoutTemperature = completeSettings();
    customOffWithoutTemperature.teams[0]!.subagents = [
      {
        ...definition,
        modelMode: "custom",
        modelId: "model-local-1",
        thinkingLevel: "off"
      }
    ];
    expect(
      LongAgentTeamSettingsSchema.safeParse(customOffWithoutTemperature).success
    ).toBe(false);

    const customOffWithTemperature = completeSettings();
    customOffWithTemperature.teams[0]!.subagents = [
      {
        ...definition,
        modelMode: "custom",
        modelId: "model-local-1",
        thinkingLevel: "off",
        temperature: 0.7
      }
    ];
    expect(
      LongAgentTeamSettingsSchema.safeParse(customOffWithTemperature).success
    ).toBe(true);
  });

  it("rejects duplicate ids and names inside one parent team", () => {
    const duplicate = completeSettings();
    duplicate.teams[0]!.subagents = [
      { ...definition },
      { ...definition, id: "other", name: definition.name.toUpperCase() }
    ];

    const result = LongAgentTeamSettingsSchema.safeParse(duplicate);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path.at(-1))).toContain(
        "name"
      );
    }
  });

  it("accepts 60 members and rejects exceeding the limit", () => {
    const definitions = Array.from({ length: 60 }, (_, index) => ({
      ...definition,
      id: `helper_${index}`,
      name: `助手 ${index}`
    }));
    expect(
      ShortAgentSubagentDefinitionsSchema.safeParse(definitions).success
    ).toBe(true);
    expect(
      LongAgentTeamSettingsSchema.safeParse({
        workspaceType: "long",
        teams: [{ parentAgentId: "long", subagents: definitions }]
      }).success
    ).toBe(true);
    expect(
      ShortAgentSubagentDefinitionsSchema.safeParse([
        ...definitions,
        { ...definition, id: "extra", name: "额外" }
      ]).success
    ).toBe(false);
  });
  it("retains compatibility for the shared legacy member shape", () => {
    const { modelMode: _modelMode, ...legacy } = definition;
    expect(ShortAgentSubagentDefinitionSchema.parse(legacy).modelMode).toBe(
      "inherit"
    );
  });
});
