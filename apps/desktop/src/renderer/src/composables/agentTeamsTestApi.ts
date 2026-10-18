import {
  DEFAULT_LONG_AGENT_TEAM_SETTINGS,
  defaultBuiltinSubagentSettings,
  type AgentTeamCatalogSnapshot,
  type DeepWriteApi
} from "@deepwrite/contracts/renderer";

export function createAgentTeamsTestApi(): DeepWriteApi["agentTeams"] {
  const list = async (): Promise<AgentTeamCatalogSnapshot> => ({
    enabledTeamIds: {},
    builtinSubagents: defaultBuiltinSubagentSettings(),
    teams: [
      {
        id: "team_long_default",
        name: "默认虚拟世界创作团队",
        workspaceType: "long",
        settings: structuredClone(DEFAULT_LONG_AGENT_TEAM_SETTINGS)
      }
    ]
  });
  return {
    list,
    saveBuiltins: list,
    create: list,
    rename: list,
    delete: list,
    setEnabled: list,
    save: list,
    download: async () => ({ status: "canceled" }),
    install: async () => ({ status: "canceled" })
  };
}
