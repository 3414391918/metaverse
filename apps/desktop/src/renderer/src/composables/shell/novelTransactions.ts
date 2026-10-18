import type { ShellRuntimePorts } from "./runtimePorts";
import type { NovelTransactionsRuntime } from "./novelTransactions.types";
import { deferShellAction } from "./deferShellAction";
import { nextTick } from "vue";
import { useLazyLongBookLifecycleCoordinator } from "../../composables/useLazyLongBookLifecycleCoordinator";
import { useLazyLongStructureTransactionsCoordinator } from "../../composables/useLazyLongStructureTransactionsCoordinator";
import { uiMessage } from "../../ui-feedback";
import { resolveLongWorkspaceApi } from "../../types/longWorkspace";

/** novelTransactions assembly for the novel and library workspace. */
export function useShellNovelTransactions(
  ports: ShellRuntimePorts
): NovelTransactionsRuntime {
  const {
    createLongBook,
    openExistingLongBook,
    chooseContinuationImportSource,
    importPortableLongBook,
    confirmContinuationImport,
    closeContinuationImportDialog,
    handleLongBookAction,
    closeLegacySyncDialog,
    confirmLegacySync,
    closeLongExportDialog,
    exportLongBookManuscript,
    closeLongBookRenameDialog,
    renameLongBook,
    closeLongBookBindingsDialog,
    updateLongBookBindings,
    closeLongBookRemovalDialog,
    confirmLongBookRemoval,
    saveLongAgentsMd,
    dispose: disposeLongBookLifecycle
  } = useLazyLongBookLifecycleCoordinator({
    api: resolveLongWorkspaceApi,
    state: {
      longBooks: ports.state.longBooks,
      activeBookId: ports.state.activeLongBookId,
      activeBookSummary: ports.state.activeLongBookSummary,
      workspaceIndex: ports.state.activeLongWorkspaceIndex,
      refreshStatus: ports.state.longWorkspaceRefreshStatus,
      mutationPending: ports.state.longMutationPending,
      bookActionPending: ports.state.longBookActionPending,
      manuscriptExportPending: ports.state.longManuscriptExportPending,
      continuationImportPreview: ports.state.continuationImportPreview,
      legacySyncPreview: ports.state.legacySyncPreview,
      legacySyncResult: ports.state.legacySyncResult,
      structureDialogOpen: ports.state.longStructureDialogOpen,
      structureAgentsMd: ports.state.longStructureAgentsMd,
      structureAgentsMdPending: ports.state.longStructureAgentsMdPending,
      bindingsDialogMode: ports.state.longBindingsDialogMode,
      exportTarget: ports.state.longExportTarget,
      bookRenameTarget: ports.state.longBookRenameDialog,
      bookRemovalTarget: ports.state.longBookRemovalDialog,
      createBookDialogOpen: ports.state.createBookDialogOpen,
      selectedResourceId: ports.state.selectedResourceId
    },
    session: {
      activateOpenedBook: deferShellAction(
        () => ports.novel.activateOpenedLongBook
      ),
      loadAgentSettings: () => ports.features.loadLongAgentSettings(),
      saveActiveEditorChanges: deferShellAction(
        () => ports.novel.saveActiveLongEditorChanges
      ),
      saveActiveEditorBeforeLeaving: deferShellAction(
        () => ports.novel.saveActiveLongEditorBeforeLeaving
      ),
      openBook: deferShellAction(() => ports.novel.openLongBook),
      refreshActiveWorkspace: deferShellAction(
        () => ports.novel.refreshActiveLongWorkspace
      ),
      clearActiveBook: deferShellAction(() => ports.novel.clearActiveLongBook),
      invalidateWorkspaceRefresh: deferShellAction(
        () => ports.novel.invalidateLongWorkspaceRefresh
      ),
      selectWorkspaceFile: deferShellAction(
        () => ports.novel.selectLongWorkspaceFile
      )
    },
    workflow: {
      stopBookAgentRuns: deferShellAction(
        () => ports.novel.stopLongBookAgentRuns
      ),
      quarantineBook: (bookId) =>
        ports.novel.longWorkspaceProposals.discardBook(bookId),
      reactivateBook: (bookId) =>
        ports.novel.longWorkspaceProposals.activateBook(bookId),
      disposeBookProposalState: deferShellAction(
        () => ports.novel.disposeLongBookProposalState
      )
    },
    conversations: {
      disposeBookConversations: deferShellAction(
        () => ports.novel.disposeLongBookConversations
      )
    },
    catalog: {
      loadBookList: deferShellAction(() => ports.novel.loadLongBookList),
      refreshWorkspaceDirectory:
        ports.features.featureHost.loadWorkspaceDirectory
    },
    resources: {
      async selectBook(bookId) {
        const target = ports.tree.longBookResourceNodes.value.find(
          (node) => node.longBookId === bookId
        );
        if (target) await ports.resources.selectResource(target);
      },
      showConversation: ports.features.featureHost.showConversation,
      revealEditor: () => {
        ports.editor.revealTextPane();
      }
    },
    manuscript: {
      available: () => Boolean(window.deepwrite),
      exportLong(input) {
        const desktop = window.deepwrite;
        if (!desktop) {
          throw new Error("桌面运行时已断开，无法导出小说。");
        }
        return desktop.manuscript.exportLong(input);
      }
    },
    scheduler: {
      settleUi: () => nextTick()
    },
    notifications: uiMessage
  });

  const {
    longWorldbuildingSyncBookOptions,
    openLongChapterCardCreate,
    requestCreateLongDraftSection,
    handleLongDraftSectionAction,
    handleCreateLongTreeItem,
    handleLongTreeItemAction,
    confirmDeleteLongTreeItem,
    confirmDeleteLongDraftSection,
    renameLongCharacter,
    renameLongStructureTitle,
    openLongCharacterCreate,
    openLongWorldbuildingItemCreate,
    openLongVolumeCreate,
    openLongPlotPointCreate,
    saveLongVolumeOutline,
    saveLongPlotPointContent,
    createLongVolume,
    createLongWorldbuildingItem,
    createLongPlotPoint,
    createLongChapterCard,
    handleActiveLongStructureMutation,
    previewActiveLongStructureMutation,
    handleLongWorldbuildingSync,
    previewActiveLongNavigationStructure,
    deleteActiveLongNavigationStructure,
    createLongCharacter,
    closeLongStructureDialog,
    closeLongCharacterCreate,
    closeLongWorldbuildingItemCreate,
    closeLongPlotPointCreate,
    closeLongChapterCardCreate,
    closeLongDraftSectionDelete,
    closeLongTreeItemDelete,
    closeLongVolumeCreate,
    dispose: disposeLongStructureTransactions
  } = useLazyLongStructureTransactionsCoordinator({
    api: resolveLongWorkspaceApi,
    state: {
      longBooks: ports.state.longBooks,
      activeBookId: ports.state.activeLongBookId,
      activeBookSummary: ports.state.activeLongBookSummary,
      workspaceIndex: ports.state.activeLongWorkspaceIndex,
      selection: ports.state.activeLongSelection,
      mutationPending: ports.state.longBookActionPending,
      structureDialogOpen: ports.state.longStructureDialogOpen,
      characterCreateTarget: ports.state.longCharacterCreate,
      worldbuildingItemCreateTarget: ports.state.longWorldbuildingItemCreate,
      plotPointCreateTarget: ports.state.longPlotPointCreate,
      chapterCardCreateTarget: ports.state.longChapterCardCreate,
      draftSectionDeleteTarget: ports.state.longDraftSectionDelete,
      treeItemDeleteTarget: ports.state.longTreeItemDelete,
      volumeCreateTarget: ports.state.longVolumeCreate,
      selectedResourceId: ports.state.selectedResourceId
    },
    session: {
      saveActiveEditorChanges: deferShellAction(
        () => ports.novel.saveActiveLongEditorChanges
      ),
      saveActiveEditorBeforeLeaving: deferShellAction(
        () => ports.novel.saveActiveLongEditorBeforeLeaving
      ),
      openBook: deferShellAction(() => ports.novel.openLongBook),
      refreshActiveWorkspace: deferShellAction(
        () => ports.novel.refreshActiveLongWorkspace
      ),
      refreshWorkspaceAfterProposal: deferShellAction(
        () => ports.novel.refreshLongProposalWorkspace
      ),
      selectWorkspaceFile: deferShellAction(
        () => ports.novel.selectLongWorkspaceFile
      ),
      selectChapterCardTab: deferShellAction(
        () => ports.novel.selectLongChapterCardTab
      ),
      editor: ports.novel.longWorkspaceEditor
    },
    resources: {
      node: deferShellAction(() => ports.resources.resourceNode),
      select: deferShellAction(() => ports.resources.selectResource),
      synchronizeSelectedResourceForLayout: deferShellAction(
        () => ports.tree.synchronizeSelectedLongResourceForLayout
      ),
      revealEditor: () => {
        ports.editor.revealTextPane();
      }
    },
    notifications: uiMessage
  });
  return {
    createLongBook,
    openExistingLongBook,
    chooseContinuationImportSource,
    importPortableLongBook,
    confirmContinuationImport,
    closeContinuationImportDialog,
    handleLongBookAction,
    closeLegacySyncDialog,
    confirmLegacySync,
    closeLongExportDialog,
    exportLongBookManuscript,
    closeLongBookRenameDialog,
    renameLongBook,
    closeLongBookBindingsDialog,
    updateLongBookBindings,
    closeLongBookRemovalDialog,
    confirmLongBookRemoval,
    saveLongAgentsMd,
    disposeLongBookLifecycle,
    longWorldbuildingSyncBookOptions,
    openLongChapterCardCreate,
    requestCreateLongDraftSection,
    handleLongDraftSectionAction,
    handleCreateLongTreeItem,
    handleLongTreeItemAction,
    confirmDeleteLongTreeItem,
    confirmDeleteLongDraftSection,
    renameLongCharacter,
    renameLongStructureTitle,
    openLongCharacterCreate,
    openLongWorldbuildingItemCreate,
    openLongVolumeCreate,
    openLongPlotPointCreate,
    saveLongVolumeOutline,
    saveLongPlotPointContent,
    createLongVolume,
    createLongWorldbuildingItem,
    createLongPlotPoint,
    createLongChapterCard,
    handleActiveLongStructureMutation,
    previewActiveLongStructureMutation,
    handleLongWorldbuildingSync,
    previewActiveLongNavigationStructure,
    deleteActiveLongNavigationStructure,
    createLongCharacter,
    closeLongStructureDialog,
    closeLongCharacterCreate,
    closeLongWorldbuildingItemCreate,
    closeLongPlotPointCreate,
    closeLongChapterCardCreate,
    closeLongDraftSectionDelete,
    closeLongTreeItemDelete,
    closeLongVolumeCreate,
    disposeLongStructureTransactions
  };
}
