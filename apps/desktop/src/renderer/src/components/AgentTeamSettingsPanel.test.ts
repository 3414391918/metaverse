import { describe, expect, it } from "vitest";
import componentSource from "./LongAgentTeamSettingsPanel.vue?raw";
import templateSource from "./LongAgentTeamSettingsPanel.template.html?raw";
const source = `${componentSource}\n${templateSource}`;

describe("LongAgentTeamSettingsPanel", () => {
  it("edits one main agent team with preserved approval and prompt boundaries", () => {
    expect(source).toContain("由主智能体按需调用");
    expect(source).toContain("不能继续创建子智能体");
    expect(source).toContain("不能绕过用户审批");
    expect(source).toContain("不继承主智能体提示词、会话或技能库");
    expect(source).toContain("完全由你写的系统提示词决定");
    expect(source).not.toMatch(/短篇|剧本|长篇/);
    expect(source).not.toContain('role="tab"');
  });
  it("retains editing, copying, activation, model settings and skill authoring", () => {
    for (const marker of [
      "从技能库加载",
      "LoadSubagentFromSkillDialog",
      "editingSubagentId",
      "跟随主智能体",
      "单独配置模型",
      "PopupSelect",
      "完成编辑",
      '@click="addSubagent()"',
      '@click="duplicateSubagent(index)"',
      '@click="removeSubagent(index)"',
      '@change="toggleSubagent(definition, $event)"',
      '@click="saveSettings"',
      "LongAgentTeamSettingsInputSchema.safeParse"
    ])
      expect(source).toContain(marker);
  });
});
