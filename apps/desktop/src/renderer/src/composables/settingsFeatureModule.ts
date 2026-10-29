import type { SettingsFeatureModule } from "../components/WorkspaceFeatureModules.types";
import type { WorkspaceFeatureHostCoordinatorOptions } from "./workspaceFeatureHostTypes";

export function buildSettingsFeatureModule(
  options: WorkspaceFeatureHostCoordinatorOptions
): SettingsFeatureModule {
  const { settingsStore } = options;
  return {
    kind: "settings",
    initialCategory: options.view.settingsInitialCategory.value,
    permissionMode: settingsStore.generalSettings.permissionMode,
    autoApproveCrossStageOperations:
      settingsStore.generalSettings.autoApproveCrossStageOperations,
    autoSaveEnabled: settingsStore.editorAutoSaveEnabled,
    language: settingsStore.generalSettings.language,
    showContextUsage: settingsStore.generalSettings.showContextUsage,
    showInMenuBar: settingsStore.generalSettings.showInMenuBar,
    workspacePaneLayout: settingsStore.generalSettings.workspacePaneLayout,
    bodyTextFormats: settingsStore.generalSettings.bodyTextFormats,
    longAgentSettings: settingsStore.longAgentSettings,
    longAgentLoading: settingsStore.longAgentLoading,
    longAgentSaving: settingsStore.longAgentSaving,
    longAgentError: settingsStore.longAgentLoadError,
    libraryAgentSettings: settingsStore.libraryAgentSettings,
    libraryAgentLoading: settingsStore.libraryAgentLoading,
    libraryAgentSaving: settingsStore.libraryAgentSaving,
    runtimeAvailable: Boolean(options.api()),
    workspaceDirectoryPath: settingsStore.workspaceDirectoryPath,
    workspaceDirectoryLoading: settingsStore.workspaceDirectoryLoading,
    workspaceDirectoryPreviousPath:
      settingsStore.workspaceDirectorySettings?.previousPath ?? null,
    workspaceDirectoryMigrationSourcePath:
      settingsStore.workspaceDirectorySettings?.migrationSourcePath ?? null
  };
}
