import type { BrowserWindow } from "electron";
import type {
  AppearanceSettings,
  GeneralSettings,
  SystemEventEnvelope
} from "@deepwrite/contracts";
import type { AgentTeamConfigStore } from "../agent-team-config-store";
import type { AppearanceService } from "../appearance-service";
import type { ChatAssistantProjectConfigStore } from "../chat-assistant-project-config-store";
import type { ContinuationImportPreviewRegistry } from "../continuation-import-preview-registry";
import type { readExternalLibraryEntries } from "../external-library-import";
import type { GeneralSettingsStore } from "../general-settings-store";
import type { FishAudioService } from "../fish-audio-service";
import type { importLegacyLibraryArchives } from "../legacy-library-import-batch";
import type { LegacySyncPreviewRegistry } from "../legacy-sync-preview-registry";
import type { LibraryAgentConfigStore } from "../library-agent-config-store";
import type { LongAgentConfigStore } from "../long-agent-config-store";
import type { PromptTemplateStore } from "../prompt-template-store";
import type { ToolLibraryStore } from "../tool-library-store";
import type { exportLongManuscript } from "../long-manuscript-export";
import type { createRendererStateFlushCoordinator } from "../renderer-state-flush";
import type { UtilitySupervisor } from "../supervisor";
import type { WorkspaceDirectoryStore } from "../workspace-directory-store";
import type {
  chooseWorkspaceDirectory,
  workspaceGroupParent,
  workspaceResourceParent
} from "./workspace-paths";
export interface IpcCommandContext {
  getMainWindow: () => BrowserWindow;
  supervisor: UtilitySupervisor;
  broadcastEvent: (event: SystemEventEnvelope) => void;
  dialog: Pick<Electron.Dialog, "showOpenDialog" | "showSaveDialog">;
  continuationImportPreviews: ContinuationImportPreviewRegistry;
  legacySyncPreviews: LegacySyncPreviewRegistry;
  requireChatAssistantProjectConfigStore: () => ChatAssistantProjectConfigStore;
  requireAgentTeamConfigStore: () => AgentTeamConfigStore;
  requireLibraryAgentConfigStore: () => LibraryAgentConfigStore;
  requireLongAgentConfigStore: () => LongAgentConfigStore;
  requirePromptTemplateStore: () => PromptTemplateStore;
  requireToolLibraryStore: () => ToolLibraryStore;
  requireWorkspaceDirectoryStore: () => WorkspaceDirectoryStore;
  requireAppearanceService: () => AppearanceService;
  requireGeneralSettingsStore: () => GeneralSettingsStore;
  requireFishAudioService: () => FishAudioService;
  exportLongManuscript: typeof exportLongManuscript;
  remoteFetch?: (input: string, init?: RequestInit) => Promise<Response>;
  fishAudioFetch?: (input: string, init?: RequestInit) => Promise<Response>;
  rendererStateFlush: ReturnType<typeof createRendererStateFlushCoordinator>;
  readExternalLibraryEntries: typeof readExternalLibraryEntries;
  importLegacyLibraryArchives: typeof importLegacyLibraryArchives;
  cachedAppearanceSettings: () => AppearanceSettings;
  syncNativeAppearanceChrome: (settings: AppearanceSettings) => void;
  syncGeneralSettings: (settings: GeneralSettings) => void;
  requireSelectedWorkspaceDirectory: () => Promise<string | null>;
  workspaceResourceParent: typeof workspaceResourceParent;
  workspaceGroupParent: typeof workspaceGroupParent;
  chooseWorkspaceDirectory: () => ReturnType<typeof chooseWorkspaceDirectory>;
  senderWebContentsId: number;
  getDocumentsPath: () => string;
  getAppVersion: () => string;
}
