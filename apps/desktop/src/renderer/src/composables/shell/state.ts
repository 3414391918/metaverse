import type { ShellRuntimePorts } from "./runtimePorts";
import type { StateRuntime } from "./state.types";
import { computed, ref, shallowRef } from "vue";
import { storeToRefs } from "pinia";
import type { BookTransferDialogMode } from "../../components/BookTransferDialog.vue";
import { useAppearance } from "../../composables/useAppearance";
import { useDraftRecoveryPersistence } from "../../composables/useDraftRecoveryPersistence";
import { uiMessage } from "../../ui-feedback";
import { EMPTY_WORKSPACE_DOCUMENT } from "../../data/emptyWorkspaceDocument";
import type {
  EditorTextReference,
  EditorTextReferenceNavigation
} from "../../types/conversation";
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

/** state assembly for the novel and library workspace. */
export function useShellState(_ports: ShellRuntimePorts): StateRuntime {
  useAppearance();

  const layoutStore = useLayoutStore();

  const {
    currentView,
    settingsInitialCategory,
    workspaceMainView,
    activePrimaryFeature,
    leftCollapsed,
    rightCollapsed,
    desktopShell,
    leftPaneWidth,
    shellClasses,
    shellStyle,
    writingRightPaneViewModel
  } = storeToRefs(layoutStore);

  const {
    reconcilePaneWidths,
    startPaneResize,
    handleResizeKeydown,
    disposeLayout
  } = layoutStore;

  const selectedResourceId = ref("");

  const activeCreationResourceId = ref("");

  const documents = shallowRef<WorkspaceDocument[]>([
    { ...EMPTY_WORKSPACE_DOCUMENT }
  ]);

  const editorDrafts = shallowRef<Record<string, EditorDraftState>>({});

  const draftRecoveryPersistence = useDraftRecoveryPersistence({
    drafts: editorDrafts,
    api: () => window.deepwrite?.catalog,
    warning: (message) => uiMessage.warning(message)
  });

  const nextDraftRecoveryTimestamp = draftRecoveryPersistence.nextTimestamp;

  const settingsStore = useSettingsStore();

  const {
    generalSettings,
    editorAutoSaveEnabled,
    modelSettings,
    startupAlertMessages,
    longAgentSettings,
    longAgentLoadError,
    libraryAgentSettings
  } = storeToRefs(settingsStore);

  const legacyGeneralPreferences = loadGeneralPreferences(window.localStorage);

  const pendingEditorReferences = ref<EditorTextReference[]>([]);

  const editorReferenceNavigation = ref<EditorTextReferenceNavigation>();

  const acceptingAgentEditDocumentIds = ref<Set<string>>(new Set());

  const acceptingAgentEditWorkspaceIds = ref<Set<string>>(new Set());

  const catalogIndexStore = useCatalogIndexStore();

  const {
    snapshot: catalogSnapshot,
    projection: catalogProjection,
    snapshotLoading: catalogLoading
  } = storeToRefs(catalogIndexStore);

  const documentHasAgentRunWriteBarrier = (
    _document: WorkspaceDocument
  ): boolean => false;

  const catalogMutationPending = ref(false);

  const createBookDialogOpen = ref(false);

  const bookTransferDialogMode = ref<BookTransferDialogMode | null>(null);

  const longWorkspaceStore = useLongWorkspaceStore();

  const {
    longBooks,
    longCatalogDiagnostics,
    activeBookId: activeLongBookId,
    activeBookSummary: activeLongBookSummary,
    workspaceIndex: activeLongWorkspaceIndex,
    selection: activeLongSelection,
    fileContext: activeLongFileContext,
    refreshStatus: longWorkspaceRefreshStatus,
    activeRefreshStatus: activeLongWorkspaceRefreshStatus,
    activeContextReady: activeLongWorkspaceContextReady,
    bookListError: longCatalogLoadError,
    workspaceLoading: longWorkspaceLoading,
    sendPreflightPending: longSendPreflightPending,
    mutationPending: longMutationPending,
    proposalApprovalPending: longProposalApprovalPending,
    structureDialogOpen: longStructureDialogOpen,
    structureAgentsMd: longStructureAgentsMd,
    structureAgentsMdPending: longStructureAgentsMdPending,
    characterCreateTarget: longCharacterCreate,
    worldbuildingItemCreateTarget: longWorldbuildingItemCreate,
    plotPointCreateTarget: longPlotPointCreate,
    chapterCardCreateTarget: longChapterCardCreate,
    draftSectionDeleteTarget: longDraftSectionDelete,
    treeItemDeleteTarget: longTreeItemDelete,
    ledgerCommitDeleteTarget: longLedgerCommitDelete,
    volumeCreateTarget: longVolumeCreate,
    bindingsDialogMode: longBindingsDialogMode,
    bookActionPending: longBookActionPending,
    manuscriptExportPending: longManuscriptExportPending,
    continuationImportPreview,
    legacySyncPreview,
    legacySyncResult,
    exportTarget: longExportTarget,
    bookRenameTarget: longBookRenameDialog,
    bookRemovalTarget: longBookRemovalDialog
  } = storeToRefs(longWorkspaceStore);

  const conversationStore = useConversationStore();
  const ownsConversationStore = conversationStore.claimLifecycle();

  const {
    controllers: conversationControllers,
    scopesByKey: conversationScopesByKey,
    controllerRegistryRevision
  } = storeToRefs(conversationStore);

  const conversations = conversationControllers.value;

  const conversationPersistenceAdapter = createConversationPersistenceAdapter(
    window.deepwrite?.conversationPersistence,
    { storage: window.localStorage }
  );

  const handledWorkspaceMutationEventIds = new Set<string>();

  const hasDesktopRuntime = computed(() => Boolean(window.deepwrite));

  const proposalEditQueueBridge = {
    hasQueued: (): boolean => false
  };
  return {
    settingsInitialCategory,
    modelSettings,
    pendingEditorReferences,
    longCatalogDiagnostics,
    layoutStore,
    currentView,
    workspaceMainView,
    activePrimaryFeature,
    leftCollapsed,
    rightCollapsed,
    desktopShell,
    leftPaneWidth,
    shellClasses,
    shellStyle,
    writingRightPaneViewModel,
    reconcilePaneWidths,
    startPaneResize,
    handleResizeKeydown,
    disposeLayout,
    selectedResourceId,
    activeCreationResourceId,
    documents,
    editorDrafts,
    draftRecoveryPersistence,
    nextDraftRecoveryTimestamp,
    settingsStore,
    generalSettings,
    editorAutoSaveEnabled,
    startupAlertMessages,
    longAgentSettings,
    longAgentLoadError,
    libraryAgentSettings,
    legacyGeneralPreferences,
    editorReferenceNavigation,
    acceptingAgentEditDocumentIds,
    acceptingAgentEditWorkspaceIds,
    catalogIndexStore,
    catalogSnapshot,
    catalogProjection,
    catalogLoading,
    documentHasAgentRunWriteBarrier,
    catalogMutationPending,
    createBookDialogOpen,
    bookTransferDialogMode,
    longWorkspaceStore,
    longBooks,
    activeLongBookId,
    activeLongBookSummary,
    activeLongWorkspaceIndex,
    activeLongSelection,
    activeLongFileContext,
    longWorkspaceRefreshStatus,
    activeLongWorkspaceRefreshStatus,
    activeLongWorkspaceContextReady,
    longCatalogLoadError,
    longWorkspaceLoading,
    longSendPreflightPending,
    longMutationPending,
    longProposalApprovalPending,
    longStructureDialogOpen,
    longStructureAgentsMd,
    longStructureAgentsMdPending,
    longCharacterCreate,
    longWorldbuildingItemCreate,
    longPlotPointCreate,
    longChapterCardCreate,
    longDraftSectionDelete,
    longTreeItemDelete,
    longLedgerCommitDelete,
    longVolumeCreate,
    longBindingsDialogMode,
    longBookActionPending,
    longManuscriptExportPending,
    continuationImportPreview,
    legacySyncPreview,
    legacySyncResult,
    longExportTarget,
    longBookRenameDialog,
    longBookRemovalDialog,
    conversationStore,
    conversationControllers,
    conversationScopesByKey,
    controllerRegistryRevision,
    conversations,
    conversationPersistenceAdapter,
    ownsConversationStore,
    handledWorkspaceMutationEventIds,
    hasDesktopRuntime,
    proposalEditQueueBridge
  };
}
