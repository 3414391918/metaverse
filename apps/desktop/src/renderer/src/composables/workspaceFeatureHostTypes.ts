import type { CatalogSnapshot, DeepWriteApi } from "@deepwrite/contracts";
import type { ComputedRef, Ref } from "vue";
import type { WorkspaceFeatureModule } from "../components/WorkspaceFeatureModules.types";
import type { AppView, WorkspaceMainView } from "../stores/layoutStore";
import type { useSettingsStore } from "../stores/settingsStore";
import type { DialogMode } from "../types/workspace";

export type ActiveFeature = WorkspaceMainView | "settings" | "long-workspace";

export interface WorkspaceFeatureHostNotifications {
  error(message: string): void;
  success(message: string): void;
}

export interface WorkspaceFeatureHostApi {
  workspaceDirectory: Pick<
    DeepWriteApi["workspaceDirectory"],
    "choose" | "list"
  >;
}

export interface WorkspaceFeatureHostCoordinatorOptions {
  api(): WorkspaceFeatureHostApi | undefined;
  view: {
    current: Ref<AppView>;
    settingsInitialCategory: Ref<string>;
    workspaceMain: Ref<WorkspaceMainView>;
    activeLongBookId: Readonly<Ref<string | null>>;
  };
  settingsStore: ReturnType<typeof useSettingsStore>;
  catalogSnapshot: Readonly<Ref<CatalogSnapshot | null>>;
  actions: {
    saveActiveLongEditorBeforeLeaving(): Promise<boolean>;
    newLibraryConversation(): void;
    newLongConversation(): void;
  };
  loaders: {
    ensureLongAgentSettingsLoaded(): Promise<unknown>;
    loadAgentTeamSettings(): Promise<unknown>;
    loadLibraryAgentSettings(): Promise<unknown>;
    loadCatalogSnapshot(): Promise<unknown>;
  };
  notifications: WorkspaceFeatureHostNotifications;
}

export interface WorkspaceFeatureHostCoordinator {
  isLongWorkspaceActive: ComputedRef<boolean>;
  activeFeature: ComputedRef<ActiveFeature>;
  workspaceFeatureModule: ComputedRef<WorkspaceFeatureModule | null>;
  showConversation(): void;
  newConversation(): void;
  openWorkspaceDialog(mode: DialogMode): Promise<void>;
  openSettings(category?: string): Promise<void>;
  openAgentTeams(): Promise<void>;
  loadWorkspaceDirectory(): Promise<void>;
  chooseWorkspaceDirectory(): Promise<void>;
  closeSettings(): void;
  ensureActiveFeatureDependencies(feature: ActiveFeature): Promise<void>;
  dispose(): void;
}
