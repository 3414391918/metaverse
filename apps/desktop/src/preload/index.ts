import {
  SystemHealthPayloadSchema,
  UPDATE_STATE_EVENT_CHANNEL,
  UpdateStateSchema,
  createEnvelope,
  type DeepWriteApi,
  type SystemHealthPayload,
  type UpdateState
} from "@deepwrite/contracts";
import { contextBridge, ipcRenderer } from "electron";
import {
  createAgentTeam,
  deleteAgentTeam,
  downloadAgentTeam,
  installAgentTeam,
  listAgentTeams,
  renameAgentTeam,
  saveAgentTeams,
  saveBuiltinSubagents,
  setAgentTeamEnabled
} from "./agent-teams-api";
import {
  acknowledgeDesktopAlert,
  checkForUpdates,
  downloadUpdate,
  getAppAlerts,
  getUpdateState,
  installUpdate
} from "./app-notification-api";
import { appearance } from "./appearance-api";
import {
  createLibrary,
  createLibraryGroup,
  updateLibrary,
  updateLibraryGroup
} from "./catalog-library-api";
import {
  chooseExternalLibraryEntries,
  createLibraryEntry,
  importLibraryEntries,
  moveLibraryEntry,
  removeLibraryEntry,
  saveLibraryEntry
} from "./catalog-library-entry-api";
import {
  deleteProject,
  duplicateProject,
  importLegacyLibrary,
  openProject,
  unregisterProject
} from "./catalog-project-api";
import {
  getCatalogIndex,
  getCatalogSnapshot,
  loadDraftRecovery,
  readCatalogDocument,
  readWritingContext,
  saveDraftRecovery,
  writeWritingContext
} from "./catalog-read-api";
import {
  chatAssistantProjectConfig,
  chatAssistantRoleplay
} from "./chat-assistant-api";
import { conversationExport } from "./conversation-export-api";
import { conversationPersistence } from "./conversation-persistence-api";
import { desktopEvents } from "./desktop-events-api";
import { fishAudio } from "./fish-audio-api";
import { toolLibrary } from "./tool-library-api";
import {
  copyPromptTemplateImage,
  deletePromptTemplate,
  listPromptTemplates,
  readPromptTemplateImage,
  savePromptTemplate
} from "./prompt-template-api";
import { browserId, invokeCommand } from "./invoke";
import {
  deleteBook,
  saveDocument,
  updateBook
} from "./legacy-catalog-book-api";
import { long } from "./long-api";
import {
  chooseWorkspaceDirectory,
  exportLongManuscript,
  listGeneralSettings,
  listLibraryAgents,
  listLongAgents,
  listWorkspaceDirectory,
  resetLibraryAgents,
  resetLongAgents,
  saveGeneralSettings,
  saveLibraryAgents,
  saveLongAgents
} from "./settings-api";
import { textContextMenu } from "./text-context-menu-api";
async function getHealth(): Promise<SystemHealthPayload> {
  const id = browserId("cmd_health");
  return SystemHealthPayloadSchema.parse(
    await invokeCommand<SystemHealthPayload>(
      createEnvelope("system.health", {}, { id, correlationId: id })
    )
  );
}
function removedModelFeature(): Promise<never> {
  return Promise.reject(new Error("应用内模型调用功能已移除。"));
}
const api: DeepWriteApi = {
  fishAudio,
  toolLibrary,
  textContextMenu,
  system: {
    health: getHealth
  },
  conversationPersistence,
  conversationExport,
  updates: {
    getState: getUpdateState,
    check: checkForUpdates,
    download: downloadUpdate,
    install: installUpdate,
    subscribe(listener: (state: UpdateState) => void): () => void {
      const handler = (
        _event: Electron.IpcRendererEvent,
        rawState: unknown
      ): void => {
        const parsed = UpdateStateSchema.safeParse(rawState);
        if (!parsed.success) {
          console.warn("DeepWrite discarded an invalid update state event.");
          return;
        }
        listener(parsed.data);
      };
      ipcRenderer.on(UPDATE_STATE_EVENT_CHANNEL, handler);
      return () =>
        ipcRenderer.removeListener(UPDATE_STATE_EVENT_CHANNEL, handler);
    }
  },
  appAlerts: {
    get: getAppAlerts,
    acknowledgeDesktop: acknowledgeDesktopAlert
  },
  catalog: {
    index: getCatalogIndex,
    readDocument: readCatalogDocument,
    readWritingContext,
    writeWritingContext,
    snapshot: getCatalogSnapshot,
    loadDraftRecovery,
    saveDraftRecovery,
    createLibrary,
    updateLibrary,
    createLibraryGroup,
    openProject,
    importLegacyLibrary,
    updateBook,
    updateLibraryGroup,
    deleteBook,
    saveDocument,
    saveLibraryEntry,
    createLibraryEntry,
    chooseExternalLibraryEntries,
    importLibraryEntries,
    removeLibraryEntry,
    moveLibraryEntry,
    unregisterProject,
    deleteProject,
    duplicateProject
  },
  long,
  session: {
    prompt: removedModelFeature,
    abort: removedModelFeature,
    submitUserInput: removedModelFeature
  },
  models: {
    list: removedModelFeature,
    refreshFree: removedModelFeature,
    setFreeModelEnabled: removedModelFeature,
    refreshOfficial: removedModelFeature,
    queryOfficialBalance: removedModelFeature,
    saveOfficialToken: removedModelFeature,
    clearOfficialToken: removedModelFeature,
    saveSiteOfficialToken: removedModelFeature,
    clearSiteOfficialToken: removedModelFeature,
    refreshSiteOfficial: removedModelFeature,
    querySiteOfficialQuota: removedModelFeature,
    mergeSiteOfficialQuota: removedModelFeature,
    setSiteOfficialModelEnabled: removedModelFeature,
    setOfficialModelEnabled: removedModelFeature,
    save: removedModelFeature,
    test: removedModelFeature,
    resolveCapacity: removedModelFeature,
    listRemote: removedModelFeature
  },
  modelUsage: { query: removedModelFeature },
  chatAssistantProjectConfig,
  chatAssistantRoleplay,
  longAgents: {
    list: listLongAgents,
    save: saveLongAgents,
    reset: resetLongAgents
  },
  promptTemplates: {
    list: listPromptTemplates,
    save: savePromptTemplate,
    delete: deletePromptTemplate,
    readImage: readPromptTemplateImage,
    copyImage: copyPromptTemplateImage
  },
  agentTeams: {
    saveBuiltins: saveBuiltinSubagents,
    list: listAgentTeams,
    create: createAgentTeam,
    rename: renameAgentTeam,
    delete: deleteAgentTeam,
    setEnabled: setAgentTeamEnabled,
    save: saveAgentTeams,
    download: downloadAgentTeam,
    install: installAgentTeam
  },
  libraryAgents: {
    list: listLibraryAgents,
    save: saveLibraryAgents,
    reset: resetLibraryAgents
  },
  workspaceDirectory: {
    list: listWorkspaceDirectory,
    choose: chooseWorkspaceDirectory
  },
  appearance,
  generalSettings: {
    list: listGeneralSettings,
    save: saveGeneralSettings
  },
  manuscript: {
    exportLong: exportLongManuscript
  },
  ...desktopEvents
};
contextBridge.exposeInMainWorld("deepwrite", api);
