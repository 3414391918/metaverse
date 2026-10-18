import type { ShellRuntimePorts } from "./runtimePorts";
import type { NovelRuntime } from "./novel.types";
import { deferShellAction } from "./deferShellAction";
import { useLongLedgerCommitDeletionCoordinator } from "../../composables/useLongLedgerCommitDeletionCoordinator";
import { useLongWorkspacePresentationCoordinator } from "../../composables/useLongWorkspacePresentationCoordinator";
import { useLongProposalRuntimeCoordinator } from "../../composables/useLongProposalRuntimeCoordinator";
import {
  useLongWorkspaceSessionCoordinator,
  type LongWorkspaceEditorPort
} from "../../composables/useLongWorkspaceSessionCoordinator";
import { uiMessage } from "../../ui-feedback";
import { resolveLongWorkspaceApi } from "../../types/longWorkspace";

/** novel assembly for the novel and library workspace. */
export function useShellNovel(ports: ShellRuntimePorts): NovelRuntime {
  const longWorkspacePresentation = useLongWorkspacePresentationCoordinator({
    isLongWorkspaceActive: ports.features.isLongWorkspaceActive,
    long: {
      activeBookId: ports.state.activeLongBookId,
      activeBookSummary: ports.state.activeLongBookSummary,
      workspaceIndex: ports.state.activeLongWorkspaceIndex,
      selection: ports.state.activeLongSelection,
      fileContext: ports.state.activeLongFileContext,
      contextReady: ports.state.activeLongWorkspaceContextReady,
      agentSettings: ports.state.longAgentSettings,
      refreshStatus: ports.state.activeLongWorkspaceRefreshStatus,
      sendPreflightPending: ports.state.longSendPreflightPending,
      proposalApprovalPending: ports.state.longProposalApprovalPending
    },
    catalog: {
      documents: ports.state.documents
    },
    conversations: {
      controllers: ports.state.conversationControllers,
      scopesByKey: ports.state.conversationScopesByKey
    },
    edits: {
      acceptingDocumentIds: ports.state.acceptingAgentEditDocumentIds,
      acceptingWorkspaceIds: ports.state.acceptingAgentEditWorkspaceIds,
      savingDocumentIds: ports.editor.savingDocumentIds
    }
  });

  const {
    activeLongRoot,
    activeLongAgentProfile,
    activeLongRuntimeContext,
    longEditorLocked,
    longEditorLockedReason,
    editorLocked,
    editorLockedLabel,
    editorSaving,
    buildLongLibraryAttachmentsForProfile,
    filterLongReadableAttachmentsForProfile,
    longCatalogContextDocuments,
    documentHasWriteBarrier
  } = longWorkspacePresentation;

  ports.state.documentHasAgentRunWriteBarrier = documentHasWriteBarrier;

  const {
    workspaceProposals: longWorkspaceProposals,
    activeConversationProposalItems: activeLongConversationProposalItems,
    conversationKey: longConversationKey,
    conversationForProposalEvent: longConversationForProposalEvent,
    refreshWorkspaceAfterProposal: refreshLongProposalWorkspace,
    stopBookAgentRuns: stopLongBookAgentRuns,
    disposeBookProposalState: disposeLongBookProposalState,
    disposeBookConversations: disposeLongBookConversations,
    stopActiveGeneration: stopLongGenerationCommand,
    approveProposal: approveLongProposal,
    rejectProposal: rejectLongProposal,
    retryProposalPreview: retryLongProposalPreview,
    locateAcceptedProposal: locateAcceptedLongProposal,
    dispose: disposeLongProposalRuntime
  } = useLongProposalRuntimeCoordinator({
    state: {
      activeBookId: ports.state.activeLongBookId,
      activeBookSummary: ports.state.activeLongBookSummary,
      workspaceIndex: ports.state.activeLongWorkspaceIndex,
      proposalApprovalPending: ports.state.longProposalApprovalPending
    },
    api: resolveLongWorkspaceApi,
    conversations: {
      byKey: ports.state.conversations,
      remove: (key, options) =>
        ports.state.conversationStore.removeController(key, options),
      active: () => ports.conversations.activeLongConversation.value
    },
    workspace: {
      saveActiveEditorChanges: () => saveActiveLongEditorChanges(),
      refreshActiveWorkspace: (bookId) => refreshActiveLongWorkspace(bookId),
      refreshBookList: () => loadLongBookList({ force: true })
    },
    removeAgentRunPreferences: deferShellAction(
      () => ports.conversations.removeAgentRunPreferences
    ),
    navigateToAcceptedProposal: async (item) => {
      const { resolveLongProposalApprovalTarget } =
        await import("../../utils/approvalNavigation");
      return ports.resources.navigateToApprovalTarget(
        resolveLongProposalApprovalTarget(item)
      );
    },
    notifications: uiMessage
  });

  const {
    editor: longWorkspaceEditor,
    loadBookList: loadLongBookList,
    saveActiveEditorChanges: saveActiveLongEditorChanges,
    saveActiveEditorBeforeLeaving: saveActiveLongEditorBeforeLeaving,
    openBook: openLongBook,
    refreshActiveWorkspace: refreshActiveLongWorkspace,
    selectWorkspaceFile: selectLongWorkspaceFile,
    selectCharacterTab: selectLongCharacterTab,
    selectPlotPointTab: selectLongPlotPointTab,
    selectChapterCardTab: selectLongChapterCardTab,
    handleFileContextChange: handleLongFileContextChange,
    handleDocumentSaved: handleLongDocumentSaved,
    retryActiveRefresh: retryActiveLongWorkspaceRefresh,
    refreshOnWindowFocus: refreshLongWorkspaceOnWindowFocus,
    invalidateRefresh: invalidateLongWorkspaceRefresh,
    deactivateActiveBook: deactivateActiveLongBook,
    clearActiveBook: clearActiveLongBook,
    activateOpenedBook: activateOpenedLongBook,
    dispose: disposeLongWorkspaceSession
  } = useLongWorkspaceSessionCoordinator({
    store: ports.state.longWorkspaceStore,
    state: {
      longBooks: ports.state.longBooks,
      activeBookId: ports.state.activeLongBookId,
      activeBookSummary: ports.state.activeLongBookSummary,
      workspaceIndex: ports.state.activeLongWorkspaceIndex,
      selection: ports.state.activeLongSelection,
      fileContext: ports.state.activeLongFileContext,
      refreshStatus: ports.state.longWorkspaceRefreshStatus,
      activeRefreshStatus: ports.state.activeLongWorkspaceRefreshStatus
    },
    api: resolveLongWorkspaceApi,
    isWorkspaceActive: () => ports.features.isLongWorkspaceActive.value,
    prepareOpenDependencies: async () => undefined,
    activateProposalBook: (bookId) =>
      longWorkspaceProposals.activateBook(bookId),
    synchronizeSelectedResourceForLayout: deferShellAction(
      () => ports.tree.synchronizeSelectedLongResourceForLayout
    ),
    async selectFallbackAfterClear() {
      const fallback = ports.tree.resourceTreeSections.value
        .find(({ id }) => id === "creation")
        ?.nodes.find((node) => !node.longBookId);
      if (fallback) {
        await ports.resources.selectResource(fallback);
      } else {
        ports.state.selectedResourceId.value = "";
      }
    },
    notifications: uiMessage,
    scheduler: {
      setTimeout: (task, delayMs) => window.setTimeout(task, delayMs),
      clearTimeout: (handle) => window.clearTimeout(handle)
    }
  });

  const {
    request: requestDeleteLongLedgerCommit,
    close: closeDeleteLongLedgerCommit,
    confirm: confirmDeleteLongLedgerCommit
  } = useLongLedgerCommitDeletionCoordinator({
    api: resolveLongWorkspaceApi,
    activeBookId: ports.state.activeLongBookId,
    workspaceIndex: ports.state.activeLongWorkspaceIndex,
    target: ports.state.longLedgerCommitDelete,
    pending: ports.state.longBookActionPending,
    saveActiveEditorChanges: saveActiveLongEditorChanges,
    refreshActiveWorkspace: refreshActiveLongWorkspace,
    notifications: uiMessage
  });

  function updateLongWorkspaceEditorPort(
    port: LongWorkspaceEditorPort | null
  ): void {
    longWorkspaceEditor.value = port;
  }
  return {
    longWorkspacePresentation,
    activeLongRoot,
    activeLongAgentProfile,
    activeLongRuntimeContext,
    longEditorLocked,
    longEditorLockedReason,
    editorLocked,
    editorLockedLabel,
    editorSaving,
    buildLongLibraryAttachmentsForProfile,
    filterLongReadableAttachmentsForProfile,
    longCatalogContextDocuments,
    longWorkspaceProposals,
    activeLongConversationProposalItems,
    longConversationKey,
    longConversationForProposalEvent,
    refreshLongProposalWorkspace,
    stopLongBookAgentRuns,
    disposeLongBookProposalState,
    disposeLongBookConversations,
    stopLongGenerationCommand,
    approveLongProposal,
    rejectLongProposal,
    retryLongProposalPreview,
    locateAcceptedLongProposal,
    disposeLongProposalRuntime,
    longWorkspaceEditor,
    loadLongBookList,
    saveActiveLongEditorChanges,
    saveActiveLongEditorBeforeLeaving,
    openLongBook,
    refreshActiveLongWorkspace,
    selectLongWorkspaceFile,
    selectLongCharacterTab,
    selectLongPlotPointTab,
    selectLongChapterCardTab,
    handleLongFileContextChange,
    handleLongDocumentSaved,
    retryActiveLongWorkspaceRefresh,
    refreshLongWorkspaceOnWindowFocus,
    invalidateLongWorkspaceRefresh,
    deactivateActiveLongBook,
    clearActiveLongBook,
    activateOpenedLongBook,
    disposeLongWorkspaceSession,
    requestDeleteLongLedgerCommit,
    closeDeleteLongLedgerCommit,
    confirmDeleteLongLedgerCommit,
    updateLongWorkspaceEditorPort
  };
}
