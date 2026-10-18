import type {
  DeepWriteApi,
  AgentTeamProfileCreateInput,
  AgentTeamProfileRenameInput,
  AgentTeamProfileSaveInput,
  AgentTeamProfileSetEnabledInput,
  AgentTeamProfileTargetInput,
  LibraryAgentDomain,
  LibraryAgentSettingsInput,
  LongAgentSettingsInput
} from "@deepwrite/contracts";
import { useSettingsStore } from "../stores/settingsStore";
export interface SettingsFeatureNotifications {
  error(message: string): void;
  info(message: string): void;
  success(message: string): void;
  warning(message: string): void;
}

export interface SettingsFeatureCoordinatorContext {
  api(): DeepWriteApi | undefined;
  settingsStore: ReturnType<typeof useSettingsStore>;
  notifications: SettingsFeatureNotifications;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function useSettingsFeatureCoordinator(
  context: SettingsFeatureCoordinatorContext
) {
  const { settingsStore, notifications: uiMessage } = context;
  async function loadAppAlerts(): Promise<void> {
    const api = context.api()?.appAlerts;
    if (!api) return;
    try {
      const snapshot = await api.get();
      if (snapshot.shouldShowDesktop) {
        settingsStore.startupAlertMessages = [...snapshot.desktopMessages];
        settingsStore.startupAlertRevision = snapshot.desktopRevision;
      }
    } catch (error: unknown) {
      console.warn("应用通知读取失败：", errorMessage(error, "未知错误"));
    }
  }

  function closeStartupAlert(): void {
    const revision = settingsStore.startupAlertRevision;
    settingsStore.startupAlertMessages = [];
    settingsStore.startupAlertRevision = "";
    const api = context.api()?.appAlerts;
    if (!revision || !api) return;
    void api.acknowledgeDesktop(revision).catch((error: unknown) => {
      console.warn("应用通知确认失败：", errorMessage(error, "未知错误"));
    });
  }
  async function loadLongAgentSettings(): Promise<boolean> {
    const api = context.api();
    if (!api) return false;
    try {
      await settingsStore.ensureLongAgentsLoaded(() => api.longAgents.list());
      return true;
    } catch (error: unknown) {
      uiMessage.error(errorMessage(error, "加载主智能体设置失败。"));
      return false;
    }
  }

  async function ensureLongAgentSettingsLoaded(): Promise<boolean> {
    return settingsStore.longAgentLoaded || (await loadLongAgentSettings());
  }

  async function saveLongAgentSettings(
    settings: LongAgentSettingsInput
  ): Promise<void> {
    const api = context.api();
    if (!api || settingsStore.longAgentSaving) return;
    settingsStore.longAgentSaving = true;
    try {
      const saved = await api.longAgents.save(settings);
      settingsStore.markLoaded("longAgents", saved);
      uiMessage.success(
        "主智能体的提示词、欢迎快捷与素材/技能读取范围已保存，下一轮对话立即生效。"
      );
    } catch (error: unknown) {
      uiMessage.error(errorMessage(error, "保存主智能体设置失败。"));
    } finally {
      settingsStore.longAgentSaving = false;
    }
  }

  async function loadAgentTeamSettings(): Promise<void> {
    const api = context.api();
    if (!api) return;
    try {
      await settingsStore.ensureAgentTeamsLoaded(() => api.agentTeams.list());
    } catch (error: unknown) {
      uiMessage.error(errorMessage(error, "加载子智能体团队设置失败。"));
    }
  }

  async function mutateAgentTeamCatalog(
    operation: () => ReturnType<DeepWriteApi["agentTeams"]["list"]>,
    successMessage: string,
    fallbackMessage: string
  ): Promise<void> {
    const api = context.api();
    if (!api || settingsStore.agentTeamSaving) return;
    settingsStore.agentTeamSaving = true;
    try {
      settingsStore.markLoaded("agentTeams", await operation());
      uiMessage.success(successMessage);
    } catch (error: unknown) {
      uiMessage.error(errorMessage(error, fallbackMessage));
    } finally {
      settingsStore.agentTeamSaving = false;
    }
  }

  async function createAgentTeam(
    input: AgentTeamProfileCreateInput
  ): Promise<void> {
    const api = context.api();
    if (!api) return;
    await mutateAgentTeamCatalog(
      () => api.agentTeams.create(input),
      "子智能体团队已创建。",
      "创建子智能体团队失败。"
    );
  }

  async function renameAgentTeam(
    input: AgentTeamProfileRenameInput
  ): Promise<void> {
    const api = context.api();
    if (!api) return;
    await mutateAgentTeamCatalog(
      () => api.agentTeams.rename(input),
      "子智能体团队已重命名。",
      "重命名子智能体团队失败。"
    );
  }

  async function deleteAgentTeam(
    input: AgentTeamProfileTargetInput
  ): Promise<void> {
    const api = context.api();
    if (!api) return;
    await mutateAgentTeamCatalog(
      () => api.agentTeams.delete(input),
      "子智能体团队已删除。",
      "删除子智能体团队失败。"
    );
  }

  async function setAgentTeamEnabled(
    input: AgentTeamProfileSetEnabledInput
  ): Promise<void> {
    const api = context.api();
    if (!api) return;
    await mutateAgentTeamCatalog(
      () => api.agentTeams.setEnabled(input),
      input.enabled
        ? "团队已启用，下一轮小说对话开始使用。"
        : "团队已关闭，下一轮小说对话不再使用团队配置。",
      "更新团队启用状态失败。"
    );
  }

  async function saveAgentTeamSettings(
    input: AgentTeamProfileSaveInput
  ): Promise<void> {
    const api = context.api();
    if (!api) return;
    await mutateAgentTeamCatalog(
      () => api.agentTeams.save(input),
      "子智能体团队已保存。",
      "保存子智能体团队设置失败。"
    );
  }

  async function downloadAgentTeam(
    input: AgentTeamProfileTargetInput
  ): Promise<void> {
    const api = context.api();
    if (!api || settingsStore.agentTeamSaving) return;
    settingsStore.agentTeamSaving = true;
    try {
      const result = await api.agentTeams.download(input);
      if (result.status === "saved") {
        uiMessage.success("子智能体团队压缩包已下载。");
      }
    } catch (error: unknown) {
      uiMessage.error(errorMessage(error, "下载子智能体团队失败。"));
    } finally {
      settingsStore.agentTeamSaving = false;
    }
  }

  async function installAgentTeam(): Promise<void> {
    const api = context.api();
    if (!api || settingsStore.agentTeamSaving) return;
    settingsStore.agentTeamSaving = true;
    try {
      const result = await api.agentTeams.install();
      if (result.status === "installed") {
        settingsStore.markLoaded("agentTeams", result.catalog);
        uiMessage.success(`子智能体团队“${result.teamName}”已安装。`);
      }
    } catch (error: unknown) {
      uiMessage.error(errorMessage(error, "安装子智能体团队失败。"));
    } finally {
      settingsStore.agentTeamSaving = false;
    }
  }

  async function loadLibraryAgentSettings(): Promise<void> {
    const api = context.api();
    if (!api) return;
    try {
      await settingsStore.ensureLibraryAgentsLoaded(() =>
        api.libraryAgents.list()
      );
    } catch (error: unknown) {
      uiMessage.error(errorMessage(error, "加载资料库智能体设置失败。"));
    }
  }

  async function saveLibraryAgentSettings(
    settings: LibraryAgentSettingsInput
  ): Promise<void> {
    const api = context.api();
    if (!api || settingsStore.libraryAgentSaving) return;
    settingsStore.libraryAgentSaving = true;
    try {
      const saved = await api.libraryAgents.save(settings);
      settingsStore.markLoaded("libraryAgents", saved);
      uiMessage.success("资料库智能体设置已保存，下一轮对话立即生效。");
    } catch (error: unknown) {
      uiMessage.error(errorMessage(error, "保存资料库智能体设置失败。"));
    } finally {
      settingsStore.libraryAgentSaving = false;
    }
  }

  async function resetLibraryAgentSettings(
    domain: LibraryAgentDomain
  ): Promise<void> {
    const api = context.api();
    if (!api || settingsStore.libraryAgentSaving) return;
    settingsStore.libraryAgentSaving = true;
    try {
      const saved = await api.libraryAgents.reset(domain);
      settingsStore.markLoaded("libraryAgents", saved);
      uiMessage.success(
        `${domain === "skill" ? "技能库" : "素材库"}智能体已恢复默认设置。`
      );
    } catch (error: unknown) {
      uiMessage.error(errorMessage(error, "恢复资料库智能体默认设置失败。"));
    } finally {
      settingsStore.libraryAgentSaving = false;
    }
  }

  return {
    loadAppAlerts,
    closeStartupAlert,
    loadLongAgentSettings,
    ensureLongAgentSettingsLoaded,
    saveLongAgentSettings,
    loadAgentTeamSettings,
    createAgentTeam,
    renameAgentTeam,
    deleteAgentTeam,
    setAgentTeamEnabled,
    saveAgentTeamSettings,
    downloadAgentTeam,
    installAgentTeam,
    loadLibraryAgentSettings,
    saveLibraryAgentSettings,
    resetLibraryAgentSettings
  };
}
