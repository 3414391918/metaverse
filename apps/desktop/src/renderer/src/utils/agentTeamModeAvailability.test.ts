import { describe, expect, it } from "vitest";
import {
  DEFAULT_LONG_AGENT_TEAM_SETTINGS,
  AgentTeamCatalogSnapshotSchema,
  type AgentTeamCatalogSnapshot
} from "@deepwrite/contracts";
import { resolveAgentTeamModeAvailability } from "./agentTeamModeAvailability";

const member = {
  id: "researcher",
  name: "资料员",
  description: "查找资料",
  systemPrompt: "只整理与任务有关的资料。",
  enabled: true,
  modelMode: "inherit" as const
};

function catalogWithMember(): AgentTeamCatalogSnapshot {
  const settings = structuredClone(DEFAULT_LONG_AGENT_TEAM_SETTINGS);
  settings.teams[0]!.subagents = [member];
  return AgentTeamCatalogSnapshotSchema.parse({
    enabledTeamIds: { long: "team-long" },
    teams: [
      { id: "team-long", name: "子智能体团队", workspaceType: "long", settings }
    ]
  });
}

describe("agent team mode availability", () => {
  it("enables team mode only for the current parent agent with an enabled member", () => {
    expect(
      resolveAgentTeamModeAvailability({
        catalog: catalogWithMember(),
        workspaceType: "long",
        parentAgentId: "long",
        loaded: true,
        loading: false,
        loadError: null
      }).available
    ).toBe(true);
    expect(
      resolveAgentTeamModeAvailability({
        catalog: catalogWithMember(),
        workspaceType: "long",
        parentAgentId: "character",
        loaded: true,
        loading: false,
        loadError: null
      })
    ).toMatchObject({ available: false });
  });

  it("disables team mode while loading or after a load failure", () => {
    expect(
      resolveAgentTeamModeAvailability({
        catalog: null,
        workspaceType: "long",
        parentAgentId: "long",
        loaded: false,
        loading: true,
        loadError: null
      }).description
    ).toContain("正在加载");
    expect(
      resolveAgentTeamModeAvailability({
        catalog: null,
        workspaceType: "long",
        parentAgentId: "long",
        loaded: false,
        loading: false,
        loadError: "读取失败"
      }).description
    ).toContain("加载失败");
  });
});
