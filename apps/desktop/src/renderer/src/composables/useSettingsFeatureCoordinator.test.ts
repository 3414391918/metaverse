import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DeepWriteApi } from "@deepwrite/contracts";
import { DEFAULT_LONG_AGENT_TEAM_SETTINGS } from "@deepwrite/contracts";
import { useSettingsStore } from "../stores/settingsStore";
import { useSettingsFeatureCoordinator } from "./useSettingsFeatureCoordinator";

beforeEach(() => setActivePinia(createPinia()));

function createHarness(agentTeams: Record<string, unknown>) {
  const settingsStore = useSettingsStore();
  const notifications = {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn()
  };
  const api = { agentTeams } as unknown as DeepWriteApi;
  const coordinator = useSettingsFeatureCoordinator({
    api: () => api,
    settingsStore,
    notifications
  });
  return { coordinator, notifications, settingsStore };
}

describe("settings feature coordinator", () => {
  it("single-flights the unified agent-team catalog", async () => {
    const list = vi.fn(async () => ({
      enabledTeamIds: {},
      teams: [
        {
          id: "team_long_default",
          name: "默认小说团队",
          workspaceType: "long" as const,
          settings: structuredClone(DEFAULT_LONG_AGENT_TEAM_SETTINGS)
        }
      ]
    }));
    const { coordinator, notifications, settingsStore } = createHarness({
      list
    });
    await Promise.all([
      coordinator.loadAgentTeamSettings(),
      coordinator.loadAgentTeamSettings()
    ]);
    expect(list).toHaveBeenCalledOnce();
    expect(settingsStore.agentTeamLoaded).toBe(true);
    await coordinator.loadAgentTeamSettings();
    expect(list).toHaveBeenCalledOnce();
    expect(notifications.error).not.toHaveBeenCalled();
  });

  it("downloads and installs team packages without treating cancellation as success", async () => {
    const installedCatalog = {
      enabledTeamIds: {},
      teams: [
        {
          id: "team_installed",
          name: "安装的团队",
          workspaceType: "long" as const,
          settings: structuredClone(DEFAULT_LONG_AGENT_TEAM_SETTINGS)
        }
      ]
    };
    const download = vi
      .fn()
      .mockResolvedValueOnce({ status: "canceled" })
      .mockResolvedValueOnce({ status: "saved", filePath: "/tmp/team.zip" });
    const install = vi.fn().mockResolvedValue({
      status: "installed",
      teamId: "team_installed",
      teamName: "安装的团队",
      catalog: installedCatalog
    });
    const { coordinator, notifications, settingsStore } = createHarness({
      download,
      install
    });
    await coordinator.downloadAgentTeam({ teamId: "team_source" });
    expect(notifications.success).not.toHaveBeenCalled();
    await coordinator.downloadAgentTeam({ teamId: "team_source" });
    await coordinator.installAgentTeam();
    expect(download).toHaveBeenCalledWith({ teamId: "team_source" });
    expect(settingsStore.agentTeamCatalog).toEqual(installedCatalog);
    expect(notifications.success).toHaveBeenCalledWith(
      "子智能体团队“安装的团队”已安装。"
    );
  });
});
