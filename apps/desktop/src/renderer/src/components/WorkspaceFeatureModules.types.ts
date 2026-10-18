import type {
  AppLanguage,
  BodyTextFormats,
  GeneralPermissionMode,
  LibraryAgentSettings,
  LongAgentSettings,
  TextViewMode,
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
  useNetworkProxy: boolean;
  workspacePaneLayout: WorkspacePaneLayout;
  defaultTextViewMode: TextViewMode;
  bodyTextFormats: BodyTextFormats;
  longAgentSettings: LongAgentSettings | null;
  longAgentLoading: boolean;
  longAgentSaving: boolean;
  longAgentError: string | null;
  libraryAgentSettings: LibraryAgentSettings | null;
  libraryAgentLoading: boolean;
  libraryAgentSaving: boolean;
  runtimeAvailable: boolean;
}

export interface DirectoryFeatureModule {
  kind: "directory";
  path: string | null;
  loading: boolean;
}

export type WorkspaceFeatureModule =
  | { kind: "tools" }
  | { kind: "voice-manager" }
  | { kind: "prompt-templates" }
  | SettingsFeatureModule
  | DirectoryFeatureModule;
