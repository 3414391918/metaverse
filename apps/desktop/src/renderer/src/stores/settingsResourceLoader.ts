import type { Ref } from "vue";
import type {
  AgentTeamCatalogSnapshot,
  GeneralSettings,
  LibraryAgentSettings,
  LongAgentSettings,
  ModelSettings,
  ModelUsageDashboard,
  OfficialModelBalance,
  WorkspaceDirectorySettings
} from "@deepwrite/contracts";
export type SettingsLoadDomain =
  | "general"
  | "models"
  | "officialModels"
  | "longAgents"
  | "agentTeams"
  | "libraryAgents"
  | "workspaceDirectory";

export interface OfficialModelsSnapshot {
  settings: ModelSettings;
  usageDashboard: ModelUsageDashboard | null;
  balance: OfficialModelBalance | null;
}

export interface SettingsDomainValueMap {
  general: GeneralSettings;
  models: ModelSettings;
  officialModels: OfficialModelsSnapshot;
  longAgents: LongAgentSettings;
  agentTeams: AgentTeamCatalogSnapshot;
  libraryAgents: LibraryAgentSettings;
  workspaceDirectory: WorkspaceDirectorySettings;
}

export type SettingsLoader<Domain extends SettingsLoadDomain> = () => Promise<
  SettingsDomainValueMap[Domain]
>;

export interface DomainLoadState {
  loaded: Ref<boolean>;
  loading: Ref<boolean>;
  error: Ref<string | null>;
}

interface SettingsResourceLoaderOptions {
  domainStates: Record<SettingsLoadDomain, DomainLoadState>;
  valueFor<Domain extends SettingsLoadDomain>(
    domain: Domain
  ): SettingsDomainValueMap[Domain];
  applyValue<Domain extends SettingsLoadDomain>(
    domain: Domain,
    value: SettingsDomainValueMap[Domain]
  ): void;
}
/** Coalesce settings reads and prevent older responses replacing newer values. */
export function createSettingsResourceLoader({
  domainStates,
  valueFor,
  applyValue
}: SettingsResourceLoaderOptions) {
  const loadPromises = new Map<SettingsLoadDomain, Promise<unknown>>();
  const loadEpochs: Record<SettingsLoadDomain, number> = {
    general: 0,
    models: 0,
    officialModels: 0,
    longAgents: 0,
    agentTeams: 0,
    libraryAgents: 0,
    workspaceDirectory: 0
  };
  function ensureLoaded<Domain extends SettingsLoadDomain>(
    domain: Domain,
    loader: SettingsLoader<Domain>
  ): Promise<SettingsDomainValueMap[Domain]> {
    const state = domainStates[domain];
    if (state.loaded.value) {
      return Promise.resolve(valueFor(domain));
    }
    const existing = loadPromises.get(domain);
    if (existing) {
      return existing as Promise<SettingsDomainValueMap[Domain]>;
    }

    const epoch = loadEpochs[domain];
    state.loading.value = true;
    state.error.value = null;
    const pending = loader()
      .then((value) => {
        if (loadEpochs[domain] === epoch) {
          applyValue(domain, value);
          state.loaded.value = true;
        }
        return value;
      })
      .catch((error: unknown) => {
        if (loadEpochs[domain] === epoch) {
          state.loaded.value = false;
          state.error.value =
            error instanceof Error ? error.message : "加载设置失败。";
        }
        throw error;
      })
      .finally(() => {
        if (loadPromises.get(domain) === pending) {
          loadPromises.delete(domain);
          state.loading.value = false;
        }
      });
    loadPromises.set(domain, pending);
    return pending;
  }

  function invalidate(domain: SettingsLoadDomain): void {
    loadEpochs[domain] += 1;
    loadPromises.delete(domain);
    const state = domainStates[domain];
    state.loaded.value = false;
    state.loading.value = false;
    state.error.value = null;
  }

  function markLoaded<Domain extends SettingsLoadDomain>(
    domain: Domain,
    value?: SettingsDomainValueMap[Domain]
  ): void {
    loadEpochs[domain] += 1;
    loadPromises.delete(domain);
    if (value !== undefined) {
      applyValue(domain, value);
    }
    const state = domainStates[domain];
    state.loaded.value = true;
    state.loading.value = false;
    state.error.value = null;
  }

  return { ensureLoaded, invalidate, markLoaded };
}
