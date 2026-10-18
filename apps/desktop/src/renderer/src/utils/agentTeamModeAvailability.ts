import type {
  AgentTeamCatalogSnapshot,
  AgentTeamWorkspaceType
} from "@deepwrite/contracts";

export interface AgentTeamModeAvailabilityInput {
  catalog: AgentTeamCatalogSnapshot | null;
  workspaceType: AgentTeamWorkspaceType;
  parentAgentId: string;
  loaded: boolean;
  loading: boolean;
  loadError: string | null;
}

export interface AgentTeamModeAvailability {
  available: boolean;
  description: string;
}

function enabledMemberCount(
  catalog: AgentTeamCatalogSnapshot,
  workspaceType: AgentTeamWorkspaceType,
  parentAgentId: string
): number {
  const enabledTeamId = catalog.enabledTeamIds[workspaceType];
  if (!enabledTeamId) return 0;

  const profile = catalog.teams.find(
    (team) => team.id === enabledTeamId && team.workspaceType === "long"
  );
  return (
    profile?.settings.teams
      .find((team) => team.parentAgentId === parentAgentId)
      ?.subagents.filter((member) => member.enabled).length ?? 0
  );
}

export function resolveAgentTeamModeAvailability(
  input: AgentTeamModeAvailabilityInput
): AgentTeamModeAvailability {
  if (input.loading) {
    return { available: false, description: "正在加载子智能体团队配置…" };
  }
  if (input.loadError) {
    return {
      available: false,
      description: "子智能体团队配置加载失败，请到子智能体团队页面重试。"
    };
  }
  if (!input.loaded || !input.catalog) {
    return { available: false, description: "子智能体团队配置尚未加载。" };
  }
  if (
    enabledMemberCount(
      input.catalog,
      input.workspaceType,
      input.parentAgentId
    ) === 0
  ) {
    return {
      available: false,
      description:
        "当前智能体没有已启用且含可用成员的团队，请先到子智能体团队设置中配置。"
    };
  }
  return {
    available: true,
    description: "允许当前主智能体调用已启用团队中的子智能体。"
  };
}
