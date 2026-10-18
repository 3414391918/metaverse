import { storeToRefs } from "pinia";
import { useDraftRecoveryPersistence } from "../../composables/useDraftRecoveryPersistence";
import type { EditorTextReferenceNavigation } from "../../types/conversation";
import type {
  EditorDraftState,
  WorkspaceDocument
} from "../../types/workspace";
import { createConversationPersistenceAdapter } from "../../utils/conversationPersistence";
import { loadGeneralPreferences } from "../../utils/generalPreferences";
import { useLayoutStore } from "../../stores/layoutStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { useCatalogIndexStore } from "../../stores/catalogIndexStore";
import { useConversationStore } from "../../stores/conversationStore";
import { useLongWorkspaceStore } from "../../stores/longWorkspaceStore";
export interface StateRuntime {
  ownsConversationStore: () => boolean;
  layoutStore: ReturnType<typeof useLayoutStore>;
  currentView: ReturnType<
    typeof storeToRefs<ReturnType<typeof useLayoutStore>>
  >["currentView"];
  workspaceMainView: ReturnType<
    typeof storeToRefs<ReturnType<typeof useLayoutStore>>
  >["workspaceMainView"];
  activePrimaryFeature: ReturnType<
    typeof storeToRefs<ReturnType<typeof useLayoutStore>>
  >["activePrimaryFeature"];
  leftCollapsed: ReturnType<
    typeof storeToRefs<ReturnType<typeof useLayoutStore>>
  >["leftCollapsed"];
  rightCollapsed: ReturnType<
    typeof storeToRefs<ReturnType<typeof useLayoutStore>>
  >["rightCollapsed"];
  desktopShell: ReturnType<
    typeof storeToRefs<ReturnType<typeof useLayoutStore>>
  >["desktopShell"];
  leftPaneWidth: ReturnType<
    typeof storeToRefs<ReturnType<typeof useLayoutStore>>
  >["leftPaneWidth"];
  shellClasses: ReturnType<
    typeof storeToRefs<ReturnType<typeof useLayoutStore>>
  >["shellClasses"];
  shellStyle: ReturnType<
    typeof storeToRefs<ReturnType<typeof useLayoutStore>>
  >["shellStyle"];
  writingRightPaneViewModel: ReturnType<
    typeof storeToRefs<ReturnType<typeof useLayoutStore>>
  >["writingRightPaneViewModel"];
  reconcilePaneWidths: ReturnType<typeof useLayoutStore>["reconcilePaneWidths"];
  startPaneResize: ReturnType<typeof useLayoutStore>["startPaneResize"];
  handleResizeKeydown: ReturnType<typeof useLayoutStore>["handleResizeKeydown"];
  disposeLayout: ReturnType<typeof useLayoutStore>["disposeLayout"];
  selectedResourceId: import("vue").Ref<string, string>;
  activeCreationResourceId: import("vue").Ref<string, string>;
  documents: import("vue").ShallowRef<WorkspaceDocument[], WorkspaceDocument[]>;
  editorDrafts: import("vue").ShallowRef<
    Record<string, EditorDraftState>,
    Record<string, EditorDraftState>
  >;
  draftRecoveryPersistence: ReturnType<typeof useDraftRecoveryPersistence>;
  nextDraftRecoveryTimestamp: ReturnType<
    typeof useDraftRecoveryPersistence
  >["nextTimestamp"];
  settingsStore: ReturnType<typeof useSettingsStore>;
  generalSettings: ReturnType<
    typeof storeToRefs<ReturnType<typeof useSettingsStore>>
  >["generalSettings"];
  editorAutoSaveEnabled: ReturnType<
    typeof storeToRefs<ReturnType<typeof useSettingsStore>>
  >["editorAutoSaveEnabled"];
  startupAlertMessages: ReturnType<
    typeof storeToRefs<ReturnType<typeof useSettingsStore>>
  >["startupAlertMessages"];
  longAgentSettings: ReturnType<
    typeof storeToRefs<ReturnType<typeof useSettingsStore>>
  >["longAgentSettings"];
  longAgentLoadError: ReturnType<
    typeof storeToRefs<ReturnType<typeof useSettingsStore>>
  >["longAgentLoadError"];
  libraryAgentSettings: ReturnType<
    typeof storeToRefs<ReturnType<typeof useSettingsStore>>
  >["libraryAgentSettings"];
  legacyGeneralPreferences: ReturnType<typeof loadGeneralPreferences>;
  editorReferenceNavigation: import("vue").Ref<
    EditorTextReferenceNavigation | undefined,
    EditorTextReferenceNavigation | undefined
  >;
  acceptingAgentEditDocumentIds: import("vue").Ref<Set<string>>;
  acceptingAgentEditWorkspaceIds: import("vue").Ref<Set<string>>;
  catalogIndexStore: ReturnType<typeof useCatalogIndexStore>;
  catalogSnapshot: ReturnType<
    typeof storeToRefs<ReturnType<typeof useCatalogIndexStore>>
  >["snapshot"];
  catalogProjection: ReturnType<
    typeof storeToRefs<ReturnType<typeof useCatalogIndexStore>>
  >["projection"];
  catalogLoading: ReturnType<
    typeof storeToRefs<ReturnType<typeof useCatalogIndexStore>>
  >["snapshotLoading"];
  documentHasAgentRunWriteBarrier: (_document: WorkspaceDocument) => boolean;
  catalogMutationPending: import("vue").Ref<boolean, boolean>;
  createBookDialogOpen: import("vue").Ref<boolean, boolean>;
  bookTransferDialogMode: import("vue").Ref<
    | import("../../components/BookTransferDialog.vue").BookTransferDialogMode
    | null
  >;
  longWorkspaceStore: ReturnType<typeof useLongWorkspaceStore>;
  longBooks: ReturnType<
    typeof storeToRefs<ReturnType<typeof useLongWorkspaceStore>>
  >["longBooks"];
  activeLongBookId: ReturnType<
    typeof storeToRefs<ReturnType<typeof useLongWorkspaceStore>>
  >["activeBookId"];
  activeLongBookSummary: ReturnType<
    typeof storeToRefs<ReturnType<typeof useLongWorkspaceStore>>
  >["activeBookSummary"];
  activeLongWorkspaceIndex: ReturnType<
    typeof storeToRefs<ReturnType<typeof useLongWorkspaceStore>>
  >["workspaceIndex"];
  activeLongSelection: ReturnType<
    typeof storeToRefs<ReturnType<typeof useLongWorkspaceStore>>
  >["selection"];
  activeLongFileContext: ReturnType<
    typeof storeToRefs<ReturnType<typeof useLongWorkspaceStore>>
  >["fileContext"];
  longWorkspaceRefreshStatus: ReturnType<
    typeof storeToRefs<ReturnType<typeof useLongWorkspaceStore>>
  >["refreshStatus"];
  activeLongWorkspaceRefreshStatus: ReturnType<
    typeof storeToRefs<ReturnType<typeof useLongWorkspaceStore>>
  >["activeRefreshStatus"];
  activeLongWorkspaceContextReady: ReturnType<
    typeof storeToRefs<ReturnType<typeof useLongWorkspaceStore>>
  >["activeContextReady"];
  longCatalogLoadError: ReturnType<
    typeof storeToRefs<ReturnType<typeof useLongWorkspaceStore>>
  >["bookListError"];
  longWorkspaceLoading: ReturnType<
    typeof storeToRefs<ReturnType<typeof useLongWorkspaceStore>>
  >["workspaceLoading"];
  longSendPreflightPending: ReturnType<
    typeof storeToRefs<ReturnType<typeof useLongWorkspaceStore>>
  >["sendPreflightPending"];
  longMutationPending: ReturnType<
    typeof storeToRefs<ReturnType<typeof useLongWorkspaceStore>>
  >["mutationPending"];
  longProposalApprovalPending: ReturnType<
    typeof storeToRefs<ReturnType<typeof useLongWorkspaceStore>>
  >["proposalApprovalPending"];
  longStructureDialogOpen: ReturnType<
    typeof storeToRefs<ReturnType<typeof useLongWorkspaceStore>>
  >["structureDialogOpen"];
  longStructureAgentsMd: ReturnType<
    typeof storeToRefs<ReturnType<typeof useLongWorkspaceStore>>
  >["structureAgentsMd"];
  longStructureAgentsMdPending: ReturnType<
    typeof storeToRefs<ReturnType<typeof useLongWorkspaceStore>>
  >["structureAgentsMdPending"];
  longCharacterCreate: ReturnType<
    typeof storeToRefs<ReturnType<typeof useLongWorkspaceStore>>
  >["characterCreateTarget"];
  longWorldbuildingItemCreate: ReturnType<
    typeof storeToRefs<ReturnType<typeof useLongWorkspaceStore>>
  >["worldbuildingItemCreateTarget"];
  longPlotPointCreate: ReturnType<
    typeof storeToRefs<ReturnType<typeof useLongWorkspaceStore>>
  >["plotPointCreateTarget"];
  longChapterCardCreate: ReturnType<
    typeof storeToRefs<ReturnType<typeof useLongWorkspaceStore>>
  >["chapterCardCreateTarget"];
  longDraftSectionDelete: ReturnType<
    typeof storeToRefs<ReturnType<typeof useLongWorkspaceStore>>
  >["draftSectionDeleteTarget"];
  longTreeItemDelete: ReturnType<
    typeof storeToRefs<ReturnType<typeof useLongWorkspaceStore>>
  >["treeItemDeleteTarget"];
  longLedgerCommitDelete: ReturnType<
    typeof storeToRefs<ReturnType<typeof useLongWorkspaceStore>>
  >["ledgerCommitDeleteTarget"];
  longVolumeCreate: ReturnType<
    typeof storeToRefs<ReturnType<typeof useLongWorkspaceStore>>
  >["volumeCreateTarget"];
  longBindingsDialogMode: ReturnType<
    typeof storeToRefs<ReturnType<typeof useLongWorkspaceStore>>
  >["bindingsDialogMode"];
  longBookActionPending: ReturnType<
    typeof storeToRefs<ReturnType<typeof useLongWorkspaceStore>>
  >["bookActionPending"];
  longManuscriptExportPending: ReturnType<
    typeof storeToRefs<ReturnType<typeof useLongWorkspaceStore>>
  >["manuscriptExportPending"];
  continuationImportPreview: ReturnType<
    typeof storeToRefs<ReturnType<typeof useLongWorkspaceStore>>
  >["continuationImportPreview"];
  legacySyncPreview: ReturnType<
    typeof storeToRefs<ReturnType<typeof useLongWorkspaceStore>>
  >["legacySyncPreview"];
  legacySyncResult: ReturnType<
    typeof storeToRefs<ReturnType<typeof useLongWorkspaceStore>>
  >["legacySyncResult"];
  longExportTarget: ReturnType<
    typeof storeToRefs<ReturnType<typeof useLongWorkspaceStore>>
  >["exportTarget"];
  longBookRenameDialog: ReturnType<
    typeof storeToRefs<ReturnType<typeof useLongWorkspaceStore>>
  >["bookRenameTarget"];
  longBookRemovalDialog: ReturnType<
    typeof storeToRefs<ReturnType<typeof useLongWorkspaceStore>>
  >["bookRemovalTarget"];
  conversationStore: ReturnType<typeof useConversationStore>;
  conversationControllers: ReturnType<
    typeof storeToRefs<ReturnType<typeof useConversationStore>>
  >["controllers"];
  conversationScopesByKey: ReturnType<
    typeof storeToRefs<ReturnType<typeof useConversationStore>>
  >["scopesByKey"];
  controllerRegistryRevision: ReturnType<
    typeof storeToRefs<ReturnType<typeof useConversationStore>>
  >["controllerRegistryRevision"];
  conversations: ReturnType<
    typeof storeToRefs<ReturnType<typeof useConversationStore>>
  >["controllers"]["value"];
  conversationPersistenceAdapter: ReturnType<
    typeof createConversationPersistenceAdapter
  >;
  handledWorkspaceMutationEventIds: Set<string>;
  hasDesktopRuntime: import("vue").ComputedRef<boolean>;
  proposalEditQueueBridge: { hasQueued: () => boolean };
  settingsInitialCategory: ReturnType<
    typeof storeToRefs<ReturnType<typeof useLayoutStore>>
  >["settingsInitialCategory"];
  modelSettings: ReturnType<
    typeof storeToRefs<ReturnType<typeof useSettingsStore>>
  >["modelSettings"];
  pendingEditorReferences: import("vue").Ref<
    import("../../types/conversation").EditorTextReference[]
  >;
  longCatalogDiagnostics: ReturnType<
    typeof storeToRefs<ReturnType<typeof useLongWorkspaceStore>>
  >["longCatalogDiagnostics"];
}
