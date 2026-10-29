import type { AssistantApi } from "./assistant";
import type {
  AgentTeamCatalogSnapshot,
  AgentTeamPackageExportResult,
  AgentTeamPackageInstallResult,
  AgentTeamProfileCreateInput,
  AgentTeamProfileRenameInput,
  AgentTeamProfileSaveInput,
  AgentTeamProfileSetEnabledInput,
  AgentTeamProfileTargetInput
} from "./agent-team-catalog";
import type { AppAlertSnapshot } from "./app-alert";
import type {
  AppearanceCustomFontId,
  AppearanceFontCatalogSnapshot,
  AppearanceFontInstallResult,
  AppearanceFontRemoveResult,
  AppearanceSettings,
  AppearanceSettingsSnapshot
} from "./appearance";
import type { BuiltinSubagentSettings } from "./builtin-subagents";
import type {
  Book,
  CatalogDraftRecovery,
  CatalogIndexSnapshot,
  CatalogLibrary,
  CatalogLibraryEntry,
  CatalogLibraryGroup,
  CatalogLibraryProjectDomain,
  CatalogOpenProjectResult,
  CatalogProjectDomain,
  CatalogReadDocumentInput,
  CatalogReadDocumentResult,
  CatalogSnapshot,
  CreateLibraryEntryInput,
  CreateLibraryGroupInput,
  CreateLibraryInput,
  DeleteBookResult,
  DeleteCatalogProjectInput,
  DeleteCatalogProjectResult,
  DuplicateCatalogProjectInput,
  DuplicateCatalogProjectResult,
  ExternalLibrarySelectionResult,
  ExternalLibrarySourceKind,
  ImportLegacyLibraryResult,
  ImportLibraryEntriesInput,
  ImportLibraryEntriesResult,
  MoveLibraryEntryInput,
  MoveLibraryEntryResult,
  RemoveLibraryEntryInput,
  RemoveLibraryEntryResult,
  SaveDocumentInput,
  SaveDocumentResult,
  SaveLibraryEntryInput,
  UnregisterCatalogProjectInput,
  UnregisterCatalogProjectResult,
  UpdateBookInput,
  UpdateLibraryGroupInput,
  UpdateLibraryInput
} from "./catalog";
import type { ChatAssistantConfigApi } from "./chat-assistant-config-api";
import type { ConversationExportApi } from "./conversation-export";
import type { FishAudioPreloadApi } from "./fish-audio";
import type {
  GeneralSettings,
  GeneralSettingsSnapshot
} from "./general-settings";
import type {
  LibraryAgentDomain,
  LibraryAgentSettings,
  LibraryAgentSettingsInput
} from "./library-agent";
import type {
  LongAgentSettings,
  LongAgentSettingsInput
} from "./long-agent-settings";
import type {
  ExportLongManuscriptInput,
  ExportLongManuscriptResult
} from "./long-manuscript-export";
import type { LongPreloadApi } from "./long-preload-api";
import type { ResourceManagerApi } from "./resource-manager";
import type { LongAgentId } from "./long-workspace";
import type { ConversationPersistenceApi } from "./renderer-state";
import type { SystemEventEnvelope, SystemHealthPayload } from "./system";
import type { TextContextMenuPreloadApi } from "./text-context-menu";
import type { UpdateState } from "./update";
import type { WindowFrameApi } from "./window-frame";
import type { WorkspaceDirectorySettings } from "./workspace-directory";
import type {
  ReadWritingContextInput,
  ReadWritingContextResult,
  WriteWritingContextInput,
  WriteWritingContextResult
} from "./writing-context";
export interface DeepWriteApi
  extends TextContextMenuPreloadApi, ChatAssistantConfigApi {
  fishAudio: FishAudioPreloadApi;
  toolLibrary: import("./tool-library").ToolLibraryApi;
  resourceManager?: ResourceManagerApi;
  assistant?: AssistantApi;
  windowFrame?: WindowFrameApi;
  system: {
    health(): Promise<SystemHealthPayload>;
  };
  conversationPersistence?: ConversationPersistenceApi;
  conversationExport?: ConversationExportApi;
  updates: {
    getState(): Promise<UpdateState>;
    check(): Promise<UpdateState>;
    download(): Promise<UpdateState>;
    install(): Promise<void>;
    subscribe(listener: (state: UpdateState) => void): () => void;
  };
  appAlerts: {
    get(): Promise<AppAlertSnapshot>;
    acknowledgeDesktop(revision: string): Promise<void>;
  };
  catalog: {
    index(): Promise<CatalogIndexSnapshot>;
    readDocument(
      input: CatalogReadDocumentInput
    ): Promise<CatalogReadDocumentResult>;
    readWritingContext(
      input: ReadWritingContextInput
    ): Promise<ReadWritingContextResult>;
    writeWritingContext(
      input: WriteWritingContextInput
    ): Promise<WriteWritingContextResult>;
    snapshot(): Promise<CatalogSnapshot>;
    loadDraftRecovery(): Promise<CatalogDraftRecovery>;
    saveDraftRecovery(drafts: CatalogDraftRecovery): Promise<void>;
    createLibrary(input: CreateLibraryInput): Promise<CatalogLibrary | null>;
    updateLibrary(input: UpdateLibraryInput): Promise<CatalogLibrary>;
    createLibraryGroup(
      input: CreateLibraryGroupInput
    ): Promise<CatalogLibraryGroup | null>;
    openProject(
      domain: CatalogProjectDomain
    ): Promise<CatalogOpenProjectResult | null>;
    importLegacyLibrary(
      domain: CatalogLibraryProjectDomain
    ): Promise<ImportLegacyLibraryResult | null>;
    updateBook(input: UpdateBookInput): Promise<Book>;
    updateLibraryGroup(
      input: UpdateLibraryGroupInput
    ): Promise<CatalogLibraryGroup>;
    deleteBook(bookId: string): Promise<DeleteBookResult>;
    saveDocument(input: SaveDocumentInput): Promise<SaveDocumentResult>;
    saveLibraryEntry(
      input: SaveLibraryEntryInput
    ): Promise<CatalogLibraryEntry>;
    createLibraryEntry(
      input: CreateLibraryEntryInput
    ): Promise<CatalogLibraryEntry>;
    chooseExternalLibraryEntries(
      sourceKind: ExternalLibrarySourceKind
    ): Promise<ExternalLibrarySelectionResult | null>;
    importLibraryEntries(
      input: ImportLibraryEntriesInput
    ): Promise<ImportLibraryEntriesResult>;
    removeLibraryEntry(
      input: RemoveLibraryEntryInput
    ): Promise<RemoveLibraryEntryResult>;
    moveLibraryEntry(
      input: MoveLibraryEntryInput
    ): Promise<MoveLibraryEntryResult>;
    unregisterProject(
      input: UnregisterCatalogProjectInput
    ): Promise<UnregisterCatalogProjectResult>;
    deleteProject(
      input: DeleteCatalogProjectInput
    ): Promise<DeleteCatalogProjectResult>;
    duplicateProject(
      input: DuplicateCatalogProjectInput
    ): Promise<DuplicateCatalogProjectResult>;
  };
  long: LongPreloadApi;
  longAgents: {
    list(): Promise<LongAgentSettings>;
    save(settings: LongAgentSettingsInput): Promise<LongAgentSettings>;
    reset(agentId?: LongAgentId): Promise<LongAgentSettings>;
  };
  promptTemplates: {
    list(): Promise<import("./prompt-templates").PromptTemplate[]>;
    save(
      input: import("./prompt-templates").PromptTemplateSave
    ): Promise<import("./prompt-templates").PromptTemplate[]>;
    delete(id: string): Promise<import("./prompt-templates").PromptTemplate[]>;
    readImage(
      input: import("./prompt-templates").PromptTemplateImageRequest
    ): Promise<import("./prompt-templates").PromptTemplateImageResult>;
    copyImage(
      input: import("./prompt-templates").PromptTemplateCopyImageInput
    ): Promise<void>;
  };
  agentTeams: {
    saveBuiltins(
      input: BuiltinSubagentSettings
    ): Promise<AgentTeamCatalogSnapshot>;
    list(): Promise<AgentTeamCatalogSnapshot>;
    create(
      input: AgentTeamProfileCreateInput
    ): Promise<AgentTeamCatalogSnapshot>;
    rename(
      input: AgentTeamProfileRenameInput
    ): Promise<AgentTeamCatalogSnapshot>;
    delete(
      input: AgentTeamProfileTargetInput
    ): Promise<AgentTeamCatalogSnapshot>;
    setEnabled(
      input: AgentTeamProfileSetEnabledInput
    ): Promise<AgentTeamCatalogSnapshot>;
    save(input: AgentTeamProfileSaveInput): Promise<AgentTeamCatalogSnapshot>;
    download(
      input: AgentTeamProfileTargetInput
    ): Promise<AgentTeamPackageExportResult>;
    install(): Promise<AgentTeamPackageInstallResult>;
  };
  libraryAgents: {
    list(): Promise<LibraryAgentSettings>;
    save(settings: LibraryAgentSettingsInput): Promise<LibraryAgentSettings>;
    reset(domain?: LibraryAgentDomain): Promise<LibraryAgentSettings>;
  };
  workspaceDirectory: {
    list(): Promise<WorkspaceDirectorySettings>;
    choose(): Promise<WorkspaceDirectorySettings | null>;
    restore(): Promise<WorkspaceDirectorySettings>;
    migrate(): Promise<WorkspaceDirectorySettings>;
  };
  appearance: {
    list(): Promise<AppearanceSettingsSnapshot>;
    save(settings: AppearanceSettings): Promise<AppearanceSettingsSnapshot>;
    fonts: {
      list(): Promise<AppearanceFontCatalogSnapshot>;
      install(): Promise<AppearanceFontInstallResult>;
      remove(id: AppearanceCustomFontId): Promise<AppearanceFontRemoveResult>;
    };
  };
  generalSettings: {
    list(): Promise<GeneralSettingsSnapshot>;
    save(settings: GeneralSettings): Promise<GeneralSettingsSnapshot>;
  };
  manuscript: {
    exportLong(
      input: ExportLongManuscriptInput
    ): Promise<ExportLongManuscriptResult>;
  };
  events: {
    subscribe(listener: (event: SystemEventEnvelope) => void): () => void;
  };
}
