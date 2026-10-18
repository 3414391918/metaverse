import { randomUUID } from "node:crypto";
import {
  DEFAULT_LONG_AGENT_TEAM_SETTINGS,
  type AgentTeamProfile,
  type LongAgentTeamSettings
} from "@deepwrite/contracts";

export function defaultAgentTeamName(): string {
  return "默认虚拟世界创作团队";
}

export function createAgentTeamProfile(
  name = defaultAgentTeamName(),
  settings: LongAgentTeamSettings = DEFAULT_LONG_AGENT_TEAM_SETTINGS
): AgentTeamProfile {
  return {
    id: `team_${randomUUID().replaceAll("-", "")}`,
    name,
    workspaceType: "long",
    settings: structuredClone(settings)
  };
}
