import {
  createSettingsResourceLoader,
  type SettingsLoadDomain,
  type SettingsDomainValueMap,
  type SettingsLoader,
  type DomainLoadState
} from "./settingsResourceLoader";
import { ref, shallowRef } from "vue";
import { defineStore } from "pinia";
import type {
  AgentTeamCatalogSnapshot,
  GeneralSettings,
  LibraryAgentSettings,
  LongAgentSettings,
  ModelSettings,
  ModelUsageDashboard,
  ModelUsageQueryInput,
  OfficialModelBalance,
  SiteOfficialQuota,
  WorkspaceDirectorySettings
} from "@deepwrite/contracts";
import {
  DEFAULT_LIBRARY_AGENT_PROFILES,
  DEFAULT_LONG_AGENT_SETTINGS,
  createDefaultGeneralSettings
} from "@deepwrite/contracts";

export type {
  SettingsLoadDomain,
  OfficialModelsSnapshot,
  SettingsDomainValueMap,
  SettingsLoader
} from "./settingsResourceLoader";
function cloneDefaultLibraryAgentSettings(): LibraryAgentSettings {
  return {
    agents: DEFAULT_LIBRARY_AGENT_PROFILES.map((agent) => ({
      ...agent,
      readAccess: {
        skills: agent.readAccess.skills.map((skill) => ({ ...skill }))
      }
    }))
  };
}

export const useSettingsStore = defineStore("settings", () => {
  const generalSettings = shallowRef<GeneralSettings>(
    createDefaultGeneralSettings()
  );
  const editorAutoSaveEnabled = ref(generalSettings.value.autoSave);
  const generalSettingsLoaded = ref(false);
  const generalSettingsLoading = ref(false);
  const generalSettingsSaving = ref(false);
  const generalSettingsLoadError = ref<string | null>(null);

  const modelSettings = shallowRef<ModelSettings | null>(null);
  const modelLoading = ref(false);
  const modelSaving = ref(false);
  const modelsLoaded = ref(false);
  const freeModelsRefreshing = ref(false);
  const freeModelsSaving = ref(false);
  const siteOfficialModelsRefreshing = ref(false);
  const siteOfficialModelsSaving = ref(false);
  const siteOfficialQuota = shallowRef<SiteOfficialQuota | null>(null);
  const modelError = ref<string | null>(null);
  const modelTestMessage = ref<string | null>(null);
  const testingModelId = ref<string | null>(null);
  const lastModelTestCapacity = shallowRef<{
    modelId: string;
    contextWindow: number;
    maxTokens: number;
  } | null>(null);
  const modelAlertMessages = shallowRef<string[]>([
    "官方模型已经上线！直连厂商！软件整体用量越多，折扣会越大！"
  ]);
  const startupAlertMessages = shallowRef<string[]>([]);
  const startupAlertRevision = ref("");
  const modelUsageDashboard = shallowRef<ModelUsageDashboard | null>(null);
  const modelUsageLoading = ref(false);
  const modelUsageError = ref<string | null>(null);
  const modelUsageQuery = shallowRef<ModelUsageQueryInput>({});

  const officialModelUsageDashboard = shallowRef<ModelUsageDashboard | null>(
    null
  );
  const officialModelBalance = shallowRef<OfficialModelBalance | null>(null);
  const officialModelsLoading = ref(false);
  const officialModelsSaving = ref(false);
  const officialModelsLoaded = ref(false);
  const officialModelsLoadError = ref<string | null>(null);

  const longAgentSettings = shallowRef<LongAgentSettings>(
    structuredClone(DEFAULT_LONG_AGENT_SETTINGS)
  );
  const longAgentLoading = ref(false);
  const longAgentSaving = ref(false);
  const longAgentLoaded = ref(false);
  const longAgentLoadError = ref<string | null>(null);

  const agentTeamCatalog = shallowRef<AgentTeamCatalogSnapshot | null>(null);
  const agentTeamLoading = ref(false);
  const agentTeamSaving = ref(false);
  const agentTeamLoaded = ref(false);
  const agentTeamLoadError = ref<string | null>(null);

  const libraryAgentSettings = shallowRef<LibraryAgentSettings>(
    cloneDefaultLibraryAgentSettings()
  );
  const libraryAgentLoading = ref(false);
  const libraryAgentSaving = ref(false);
  const libraryAgentsLoaded = ref(false);
  const libraryAgentLoadError = ref<string | null>(null);

  const workspaceDirectorySettings =
    shallowRef<WorkspaceDirectorySettings | null>(null);
  const workspaceDirectoryPath = ref<string | null>(null);
  const workspaceDirectoryLoading = ref(false);
  const workspaceDirectoryLoaded = ref(false);
  const workspaceDirectoryLoadError = ref<string | null>(null);

  const domainStates: Record<SettingsLoadDomain, DomainLoadState> = {
    general: {
      loaded: generalSettingsLoaded,
      loading: generalSettingsLoading,
      error: generalSettingsLoadError
    },
    models: {
      loaded: modelsLoaded,
      loading: modelLoading,
      error: modelError
    },
    officialModels: {
      loaded: officialModelsLoaded,
      loading: officialModelsLoading,
      error: officialModelsLoadError
    },
    longAgents: {
      loaded: longAgentLoaded,
      loading: longAgentLoading,
      error: longAgentLoadError
    },
    agentTeams: {
      loaded: agentTeamLoaded,
      loading: agentTeamLoading,
      error: agentTeamLoadError
    },
    libraryAgents: {
      loaded: libraryAgentsLoaded,
      loading: libraryAgentLoading,
      error: libraryAgentLoadError
    },
    workspaceDirectory: {
      loaded: workspaceDirectoryLoaded,
      loading: workspaceDirectoryLoading,
      error: workspaceDirectoryLoadError
    }
  };

  function valueFor<Domain extends SettingsLoadDomain>(
    domain: Domain
  ): SettingsDomainValueMap[Domain] {
    switch (domain) {
      case "general":
        return generalSettings.value as SettingsDomainValueMap[Domain];
      case "models":
        return modelSettings.value as SettingsDomainValueMap[Domain];
      case "officialModels":
        return {
          settings: modelSettings.value,
          usageDashboard: officialModelUsageDashboard.value,
          balance: officialModelBalance.value
        } as SettingsDomainValueMap[Domain];
      case "longAgents":
        return longAgentSettings.value as SettingsDomainValueMap[Domain];
      case "agentTeams":
        return agentTeamCatalog.value as SettingsDomainValueMap[Domain];
      case "libraryAgents":
        return libraryAgentSettings.value as SettingsDomainValueMap[Domain];
      case "workspaceDirectory":
        return workspaceDirectorySettings.value as SettingsDomainValueMap[Domain];
    }
  }

  function applyValue<Domain extends SettingsLoadDomain>(
    domain: Domain,
    value: SettingsDomainValueMap[Domain]
  ): void {
    switch (domain) {
      case "general": {
        const settings = value as SettingsDomainValueMap["general"];
        generalSettings.value = settings;
        editorAutoSaveEnabled.value = settings.autoSave;
        break;
      }
      case "models":
        modelSettings.value = value as SettingsDomainValueMap["models"];
        break;
      case "officialModels": {
        const snapshot = value as SettingsDomainValueMap["officialModels"];
        // Official refreshes also return the complete model configuration.
        // Supersede an older in-flight models request so it cannot overwrite
        // the newer official snapshot when it resolves late.
        markLoaded("models", snapshot.settings);
        officialModelUsageDashboard.value = snapshot.usageDashboard;
        officialModelBalance.value = snapshot.balance;
        break;
      }
      case "longAgents":
        longAgentSettings.value = value as SettingsDomainValueMap["longAgents"];
        break;
      case "agentTeams":
        agentTeamCatalog.value = value as SettingsDomainValueMap["agentTeams"];
        break;
      case "libraryAgents":
        libraryAgentSettings.value =
          value as SettingsDomainValueMap["libraryAgents"];
        break;
      case "workspaceDirectory": {
        const settings = value as SettingsDomainValueMap["workspaceDirectory"];
        workspaceDirectorySettings.value = settings;
        workspaceDirectoryPath.value = settings.path;
        break;
      }
    }
  }

  const { ensureLoaded, invalidate, markLoaded } = createSettingsResourceLoader(
    { domainStates, valueFor, applyValue }
  );

  function ensureModelsLoaded(loader: SettingsLoader<"models">) {
    return ensureLoaded("models", loader);
  }

  function ensureOfficialModelsLoaded(
    loader: SettingsLoader<"officialModels">
  ) {
    return ensureLoaded("officialModels", loader);
  }

  function ensureLongAgentsLoaded(loader: SettingsLoader<"longAgents">) {
    return ensureLoaded("longAgents", loader);
  }

  function ensureAgentTeamsLoaded(loader: SettingsLoader<"agentTeams">) {
    return ensureLoaded("agentTeams", loader);
  }

  function ensureLibraryAgentsLoaded(loader: SettingsLoader<"libraryAgents">) {
    return ensureLoaded("libraryAgents", loader);
  }

  function ensureWorkspaceDirectoryLoaded(
    loader: SettingsLoader<"workspaceDirectory">
  ) {
    return ensureLoaded("workspaceDirectory", loader);
  }

  return {
    generalSettings,
    editorAutoSaveEnabled,
    generalSettingsLoaded,
    generalSettingsLoading,
    generalSettingsSaving,
    generalSettingsLoadError,
    modelSettings,
    modelLoading,
    modelSaving,
    modelsLoaded,
    freeModelsRefreshing,
    freeModelsSaving,
    siteOfficialModelsRefreshing,
    siteOfficialModelsSaving,
    siteOfficialQuota,
    modelError,
    modelTestMessage,
    testingModelId,
    lastModelTestCapacity,
    modelAlertMessages,
    startupAlertMessages,
    startupAlertRevision,
    modelUsageDashboard,
    modelUsageLoading,
    modelUsageError,
    modelUsageQuery,
    officialModelUsageDashboard,
    officialModelBalance,
    officialModelsLoading,
    officialModelsSaving,
    officialModelsLoaded,
    officialModelsLoadError,
    longAgentSettings,
    longAgentLoading,
    longAgentSaving,
    longAgentLoaded,
    longAgentLoadError,
    agentTeamCatalog,
    agentTeamLoading,
    agentTeamSaving,
    agentTeamLoaded,
    agentTeamLoadError,
    libraryAgentSettings,
    libraryAgentLoading,
    libraryAgentSaving,
    libraryAgentsLoaded,
    libraryAgentLoadError,
    workspaceDirectorySettings,
    workspaceDirectoryPath,
    workspaceDirectoryLoading,
    workspaceDirectoryLoaded,
    workspaceDirectoryLoadError,
    ensureLoaded,
    ensureModelsLoaded,
    ensureOfficialModelsLoaded,
    ensureLongAgentsLoaded,
    ensureAgentTeamsLoaded,
    ensureLibraryAgentsLoaded,
    ensureWorkspaceDirectoryLoaded,
    invalidate,
    markLoaded
  };
});
