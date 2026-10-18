import type { ShellRuntimePorts } from "./runtimePorts";
import type { EditorRuntime } from "./editor.types";
import { deferShellAction } from "./deferShellAction";
import { createShortWorkspaceContentRevision } from "@deepwrite/contracts";
import { useCatalogDocumentLoader } from "../../composables/useCatalogDocumentLoader";
import { useCatalogDocumentPersistence } from "../../composables/useCatalogDocumentPersistence";
import { useCatalogWorkspaceProjectionCoordinator } from "../../composables/useCatalogWorkspaceProjectionCoordinator";
import { useEditorAutoSaveCoordinator } from "../../composables/useEditorAutoSaveCoordinator";
import { useGeneralSettingsCoordinator } from "../../composables/useGeneralSettingsCoordinator";
import { uiMessage } from "../../ui-feedback";

/** editor assembly for the novel and library workspace. */
export function useShellEditor(ports: ShellRuntimePorts): EditorRuntime {
  const catalogDocumentLoader = useCatalogDocumentLoader({
    catalogIndex: ports.state.catalogIndexStore,
    reader: () => window.deepwrite?.catalog,
    documents: ports.state.documents
  });

  const documentById = catalogDocumentLoader.documentsById;

  const catalogWorkspaceProjection = useCatalogWorkspaceProjectionCoordinator({
    api: () => window.deepwrite?.catalog,
    index: {
      snapshot: ports.state.catalogSnapshot,
      projection: ports.state.catalogProjection,
      ensureSnapshot: (loader) =>
        ports.state.catalogIndexStore.ensureSnapshot(loader)
    },
    documents: {
      values: ports.state.documents,
      reconcileProjection: (projection) =>
        catalogDocumentLoader.reconcileProjection(projection)
    },
    state: {
      drafts: ports.state.editorDrafts,
      selectedResourceId: ports.state.selectedResourceId
    },
    proposals: {
      all: () => ports.conversations.allConversations(),
      resume: (candidates) =>
        ports.proposals.resumeRecoveredAutomaticAgentEdits(candidates)
    },
    scheduler: {
      queueMicrotask: (task) => queueMicrotask(task)
    },
    notifications: uiMessage
  });

  const {
    loadSnapshot: loadCatalogSnapshot,
    notifyRecoveredDrafts,
    recordRecoveredDraftCount,
    reconciledProjection: reconciledCatalogProjection,
    resumeRecoveredAutomaticEditsIfNeeded:
      resumeRecoveredAutomaticAgentEditsIfNeeded,
    dispose: disposeCatalogWorkspaceProjection
  } = catalogWorkspaceProjection;

  const {
    savingDocumentIds,
    saveConflict,
    saveConflictSubmitting,
    applyAcceptedAgentDocumentLocally,
    applySavedLibraryEntry,
    applyUpdatedCatalogLibrary,
    applyCreatedLibraryEntry,
    isCatalogConflict,
    persistEditorDocument,
    persistEditorDocumentWithOutcome,
    keepSaveConflictDraft,
    reloadSaveConflictFromDisk,
    overwriteSaveConflictOnDisk,
    dispose: disposeCatalogDocumentPersistence
  } = useCatalogDocumentPersistence({
    api: () => window.deepwrite?.catalog,
    documents: ports.state.documents,
    drafts: ports.state.editorDrafts,
    loader: catalogDocumentLoader,
    catalog: {
      refreshIndex: loadCatalogSnapshot,
      findLibrary: deferShellAction(() => ports.libraries.findCatalogLibrary)
    },
    nextRecoveryTimestamp: deferShellAction(
      () => ports.state.nextDraftRecoveryTimestamp
    ),
    scheduleAutoSave: (documentId) => scheduleEditorAutoSave(documentId),
    notifications: uiMessage
  });

  const {
    apply: applyDocument,
    cancel: cancelEditorAutoSave,
    dispose: disposeEditorAutoSave,
    drain: drainEditorSaves,
    manualSavingDocumentIds,
    schedule: scheduleEditorAutoSave,
    scheduleDirty: scheduleDirtyEditorDraftsForAutoSave
  } = useEditorAutoSaveCoordinator({
    enabled: ports.state.editorAutoSaveEnabled,
    drafts: ports.state.editorDrafts,
    documents: ports.state.documents,
    timer: window,
    persist: persistEditorDocumentWithOutcome,
    isConflicted: () => saveConflict.value !== null,
    isWriteBlocked: (document) =>
      savingDocumentIds.value.size > 0 ||
      ports.state.documentHasAgentRunWriteBarrier(document) ||
      ports.state.acceptingAgentEditDocumentIds.value.has(document.id) ||
      (document.workspaceId !== undefined &&
        ports.state.acceptingAgentEditWorkspaceIds.value.has(
          document.workspaceId
        )),
    onUnexpectedError: (error) =>
      uiMessage.error(
        error instanceof Error ? error.message : "保存编辑器草稿失败。"
      )
  });

  const {
    dispose: disposeGeneralSettings,
    load: loadGeneralSettings,
    updateAutoApproveCrossStageOperations,
    updateAutoSave: updateEditorAutoSave,
    updateDefaultTextViewMode,
    updateBodyTextFormat,
    updateLanguage: updateAppLanguage,
    updatePermissionMode,
    updateShowContextUsage,
    updateShowInMenuBar,
    updateUseNetworkProxy,
    updateWorkspacePaneLayout
  } = useGeneralSettingsCoordinator({
    settings: ports.state.generalSettings,
    autoSaveEnabled: ports.state.editorAutoSaveEnabled,
    api: () => window.deepwrite?.generalSettings,
    publishLoaded: (settings) =>
      ports.state.settingsStore.markLoaded("general", settings),
    legacyAutoSave: ports.state.legacyGeneralPreferences.autoSave,
    storage: window.localStorage,
    documentRoot: document.documentElement,
    browserLanguage: () => navigator.language,
    applyApprovalMode: deferShellAction(
      () => ports.conversations.applyDefaultApprovalMode
    ),
    scheduleDirtyAutoSave: scheduleDirtyEditorDraftsForAutoSave,
    cancelAutoSave: cancelEditorAutoSave,
    resumeAutomaticAgentEdits: resumeRecoveredAutomaticAgentEditsIfNeeded,
    notifications: uiMessage
  });

  function revealTextPane(): void {
    if (
      ports.state.generalSettings.value.workspacePaneLayout === "agent-editor"
    ) {
      ports.state.layoutStore.setPaneCollapsed("right", false);
    }
  }

  function stageEditorDraft(payload: {
    id: string;
    title: string;
    content: string;
  }): void {
    const persisted = ports.state.documents.value.find(
      (document) => document.id === payload.id
    );
    const existingDraft = ports.state.editorDrafts.value[payload.id];
    ports.state.editorDrafts.value = {
      ...ports.state.editorDrafts.value,
      [payload.id]: {
        title: payload.title,
        content: payload.content,
        dirty: true,
        recoveryUpdatedAt: ports.state.nextDraftRecoveryTimestamp(),
        ...(existingDraft?.baseRevision
          ? { baseRevision: existingDraft.baseRevision }
          : persisted
            ? {
                baseRevision: createShortWorkspaceContentRevision(
                  persisted.content
                )
              }
            : {}),
        ...(existingDraft?.baseProjectRevision !== undefined
          ? { baseProjectRevision: existingDraft.baseProjectRevision }
          : persisted?.catalogProjectRevision === undefined
            ? {}
            : { baseProjectRevision: persisted.catalogProjectRevision })
      }
    };
  }

  function handleLiveDocumentChange(rawPayload: {
    id: string;
    title: string;
    content: string;
  }): void {
    stageEditorDraft(rawPayload);
    scheduleEditorAutoSave(rawPayload.id);
  }
  return {
    notifyRecoveredDrafts,
    savingDocumentIds,
    applyCreatedLibraryEntry,
    applySavedLibraryEntry,
    loadGeneralSettings,
    catalogDocumentLoader,
    documentById,
    loadCatalogSnapshot,
    recordRecoveredDraftCount,
    reconciledCatalogProjection,
    resumeRecoveredAutomaticAgentEditsIfNeeded,
    disposeCatalogWorkspaceProjection,
    saveConflict,
    saveConflictSubmitting,
    applyAcceptedAgentDocumentLocally,
    applyUpdatedCatalogLibrary,
    isCatalogConflict,
    persistEditorDocument,
    keepSaveConflictDraft,
    reloadSaveConflictFromDisk,
    overwriteSaveConflictOnDisk,
    disposeCatalogDocumentPersistence,
    applyDocument,
    cancelEditorAutoSave,
    disposeEditorAutoSave,
    drainEditorSaves,
    manualSavingDocumentIds,
    scheduleDirtyEditorDraftsForAutoSave,
    disposeGeneralSettings,
    updateAutoApproveCrossStageOperations,
    updateEditorAutoSave,
    updateDefaultTextViewMode,
    updateBodyTextFormat,
    updateAppLanguage,
    updatePermissionMode,
    updateShowContextUsage,
    updateShowInMenuBar,
    updateUseNetworkProxy,
    updateWorkspacePaneLayout,
    revealTextPane,
    handleLiveDocumentChange
  };
}
