import { useSettingsFeatureCoordinator } from "../../composables/useSettingsFeatureCoordinator";
import { useWorkspaceDialogModuleCoordinator } from "../../composables/useWorkspaceDialogModuleCoordinator";
import { useWorkspaceFeatureHostCoordinator } from "../../composables/useWorkspaceFeatureHostCoordinator";
import { useCreativeBookCreation } from "../../composables/useCreativeBookCreation";
export interface FeaturesRuntime {
  featureHost: ReturnType<typeof useWorkspaceFeatureHostCoordinator>;
  isLongWorkspaceActive: ReturnType<
    typeof useWorkspaceFeatureHostCoordinator
  >["isLongWorkspaceActive"];
  activeFeature: ReturnType<
    typeof useWorkspaceFeatureHostCoordinator
  >["activeFeature"];
  workspaceFeatureModule: ReturnType<
    typeof useWorkspaceFeatureHostCoordinator
  >["workspaceFeatureModule"];
  closeCreateBookDialog: ReturnType<
    typeof useCreativeBookCreation
  >["closeCreateBookDialog"];
  openCreateBookDialog: ReturnType<
    typeof useCreativeBookCreation
  >["openCreateBookDialog"];
  createCreativeBook: ReturnType<
    typeof useCreativeBookCreation
  >["createCreativeBook"];
  workspaceDialogModule: ReturnType<typeof useWorkspaceDialogModuleCoordinator>;
  loadAppAlerts: ReturnType<
    typeof useSettingsFeatureCoordinator
  >["loadAppAlerts"];
  closeStartupAlert: ReturnType<
    typeof useSettingsFeatureCoordinator
  >["closeStartupAlert"];
  loadLongAgentSettings: ReturnType<
    typeof useSettingsFeatureCoordinator
  >["loadLongAgentSettings"];
  ensureLongAgentSettingsLoaded: ReturnType<
    typeof useSettingsFeatureCoordinator
  >["ensureLongAgentSettingsLoaded"];
  saveLongAgentSettings: ReturnType<
    typeof useSettingsFeatureCoordinator
  >["saveLongAgentSettings"];
  loadAgentTeamSettings: ReturnType<
    typeof useSettingsFeatureCoordinator
  >["loadAgentTeamSettings"];
  createAgentTeam: ReturnType<
    typeof useSettingsFeatureCoordinator
  >["createAgentTeam"];
  renameAgentTeam: ReturnType<
    typeof useSettingsFeatureCoordinator
  >["renameAgentTeam"];
  deleteAgentTeam: ReturnType<
    typeof useSettingsFeatureCoordinator
  >["deleteAgentTeam"];
  downloadAgentTeam: ReturnType<
    typeof useSettingsFeatureCoordinator
  >["downloadAgentTeam"];
  installAgentTeam: ReturnType<
    typeof useSettingsFeatureCoordinator
  >["installAgentTeam"];
  setAgentTeamEnabled: ReturnType<
    typeof useSettingsFeatureCoordinator
  >["setAgentTeamEnabled"];
  saveAgentTeamSettings: ReturnType<
    typeof useSettingsFeatureCoordinator
  >["saveAgentTeamSettings"];
  saveLibraryAgentSettings: ReturnType<
    typeof useSettingsFeatureCoordinator
  >["saveLibraryAgentSettings"];
  resetLibraryAgentSettings: ReturnType<
    typeof useSettingsFeatureCoordinator
  >["resetLibraryAgentSettings"];
}
