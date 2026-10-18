import { useCatalogDocumentLoader } from "../../composables/useCatalogDocumentLoader";
import { useCatalogDocumentPersistence } from "../../composables/useCatalogDocumentPersistence";
import { useCatalogWorkspaceProjectionCoordinator } from "../../composables/useCatalogWorkspaceProjectionCoordinator";
import { useEditorAutoSaveCoordinator } from "../../composables/useEditorAutoSaveCoordinator";
import { useGeneralSettingsCoordinator } from "../../composables/useGeneralSettingsCoordinator";
export interface EditorRuntime {
  catalogDocumentLoader: ReturnType<typeof useCatalogDocumentLoader>;
  documentById: ReturnType<typeof useCatalogDocumentLoader>["documentsById"];
  loadCatalogSnapshot: ReturnType<
    typeof useCatalogWorkspaceProjectionCoordinator
  >["loadSnapshot"];
  recordRecoveredDraftCount: ReturnType<
    typeof useCatalogWorkspaceProjectionCoordinator
  >["recordRecoveredDraftCount"];
  reconciledCatalogProjection: ReturnType<
    typeof useCatalogWorkspaceProjectionCoordinator
  >["reconciledProjection"];
  resumeRecoveredAutomaticAgentEditsIfNeeded: ReturnType<
    typeof useCatalogWorkspaceProjectionCoordinator
  >["resumeRecoveredAutomaticEditsIfNeeded"];
  disposeCatalogWorkspaceProjection: ReturnType<
    typeof useCatalogWorkspaceProjectionCoordinator
  >["dispose"];
  saveConflict: ReturnType<
    typeof useCatalogDocumentPersistence
  >["saveConflict"];
  saveConflictSubmitting: ReturnType<
    typeof useCatalogDocumentPersistence
  >["saveConflictSubmitting"];
  applyAcceptedAgentDocumentLocally: ReturnType<
    typeof useCatalogDocumentPersistence
  >["applyAcceptedAgentDocumentLocally"];
  applyUpdatedCatalogLibrary: ReturnType<
    typeof useCatalogDocumentPersistence
  >["applyUpdatedCatalogLibrary"];
  isCatalogConflict: ReturnType<
    typeof useCatalogDocumentPersistence
  >["isCatalogConflict"];
  persistEditorDocument: ReturnType<
    typeof useCatalogDocumentPersistence
  >["persistEditorDocument"];
  keepSaveConflictDraft: ReturnType<
    typeof useCatalogDocumentPersistence
  >["keepSaveConflictDraft"];
  reloadSaveConflictFromDisk: ReturnType<
    typeof useCatalogDocumentPersistence
  >["reloadSaveConflictFromDisk"];
  overwriteSaveConflictOnDisk: ReturnType<
    typeof useCatalogDocumentPersistence
  >["overwriteSaveConflictOnDisk"];
  disposeCatalogDocumentPersistence: ReturnType<
    typeof useCatalogDocumentPersistence
  >["dispose"];
  applyDocument: ReturnType<typeof useEditorAutoSaveCoordinator>["apply"];
  cancelEditorAutoSave: ReturnType<
    typeof useEditorAutoSaveCoordinator
  >["cancel"];
  disposeEditorAutoSave: ReturnType<
    typeof useEditorAutoSaveCoordinator
  >["dispose"];
  drainEditorSaves: ReturnType<typeof useEditorAutoSaveCoordinator>["drain"];
  manualSavingDocumentIds: ReturnType<
    typeof useEditorAutoSaveCoordinator
  >["manualSavingDocumentIds"];
  scheduleDirtyEditorDraftsForAutoSave: ReturnType<
    typeof useEditorAutoSaveCoordinator
  >["scheduleDirty"];
  disposeGeneralSettings: ReturnType<
    typeof useGeneralSettingsCoordinator
  >["dispose"];
  updateAutoApproveCrossStageOperations: ReturnType<
    typeof useGeneralSettingsCoordinator
  >["updateAutoApproveCrossStageOperations"];
  updateEditorAutoSave: ReturnType<
    typeof useGeneralSettingsCoordinator
  >["updateAutoSave"];
  updateDefaultTextViewMode: ReturnType<
    typeof useGeneralSettingsCoordinator
  >["updateDefaultTextViewMode"];
  updateBodyTextFormat: ReturnType<
    typeof useGeneralSettingsCoordinator
  >["updateBodyTextFormat"];
  updateAppLanguage: ReturnType<
    typeof useGeneralSettingsCoordinator
  >["updateLanguage"];
  updatePermissionMode: ReturnType<
    typeof useGeneralSettingsCoordinator
  >["updatePermissionMode"];
  updateShowContextUsage: ReturnType<
    typeof useGeneralSettingsCoordinator
  >["updateShowContextUsage"];
  updateShowInMenuBar: ReturnType<
    typeof useGeneralSettingsCoordinator
  >["updateShowInMenuBar"];
  updateUseNetworkProxy: ReturnType<
    typeof useGeneralSettingsCoordinator
  >["updateUseNetworkProxy"];
  updateWorkspacePaneLayout: ReturnType<
    typeof useGeneralSettingsCoordinator
  >["updateWorkspacePaneLayout"];
  revealTextPane: () => void;
  handleLiveDocumentChange: (rawPayload: {
    id: string;
    title: string;
    content: string;
  }) => void;
  notifyRecoveredDrafts: ReturnType<
    typeof useCatalogWorkspaceProjectionCoordinator
  >["notifyRecoveredDrafts"];
  savingDocumentIds: ReturnType<
    typeof useCatalogDocumentPersistence
  >["savingDocumentIds"];
  applyCreatedLibraryEntry: ReturnType<
    typeof useCatalogDocumentPersistence
  >["applyCreatedLibraryEntry"];
  applySavedLibraryEntry: ReturnType<
    typeof useCatalogDocumentPersistence
  >["applySavedLibraryEntry"];
  loadGeneralSettings: ReturnType<typeof useGeneralSettingsCoordinator>["load"];
}
