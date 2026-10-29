import type {
  AppLanguage,
  BodyTextFormats,
  GeneralPermissionMode,
  LibraryAgentSettings,
  LongAgentSettings,
  WorkspacePaneLayout
} from "@deepwrite/contracts";

export interface SettingsFeatureModule {
  kind: "settings";
  initialCategory: string;
  permissionMode: GeneralPermissionMode;
  autoApproveCrossStageOperations: boolean;
  autoSaveEnabled: boolean;
  language: AppLanguage;
  showContextUsage: boolean;
  showInMenuBar: boolean;
  workspacePaneLayout: WorkspacePaneLayout;
  bodyTextFormats: BodyTextFormats;
  longAgentSettings: LongAgentSettings | null;
  longAgentLoading: boolean;
  longAgentSaving: boolean;
  longAgentError: string | null;
  libraryAgentSettings: LibraryAgentSettings | null;
  libraryAgentLoading: boolean;
  libraryAgentSaving: boolean;
  runtimeAvailable: boolean;
  workspaceDirectoryPath: string | null;
  workspaceDirectoryLoading: boolean;
  workspaceDirectoryPreviousPath: string | null;
  workspaceDirectoryMigrationSourcePath: string | null;
}

export type WorkspaceFeatureModule =
  | { kind: "assistant" }
  | { kind: "resources" }
  | { kind: "tools" }
  | { kind: "voice-manager" }
  | { kind: "prompt-templates" }
  | SettingsFeatureModule;
