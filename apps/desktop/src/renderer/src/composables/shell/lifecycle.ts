import type { ShellRuntimePorts } from "./runtimePorts";
import type { LifecycleRuntime } from "./lifecycle.types";
import { deferShellAction } from "./deferShellAction";
import { useWorkspaceWindowMenus } from "../../composables/useWorkspaceWindowMenus";
import { onBeforeUnmount, onMounted, watch } from "vue";
import { registerWorkspaceSystemEventRoutes } from "../../events/registerWorkspaceSystemEventRoutes";
import { systemEventCenter } from "../../events/systemEventCenter";
import { useWorkspaceLifecycleCoordinator } from "../../composables/useWorkspaceLifecycleCoordinator";

/** lifecycle assembly for the novel and library workspace. */
export function useShellLifecycle(ports: ShellRuntimePorts): LifecycleRuntime {
  function startWorkspaceSystemEvents(): () => void {
    const removeRoutes = registerWorkspaceSystemEventRoutes(systemEventCenter, {
      stageLongPlotDesignEditProposal: deferShellAction(
        () => ports.proposals.stageLongPlotDesignEditProposal
      ),
      stageLongWorldbuildingEditProposal: deferShellAction(
        () => ports.proposals.stageLongWorldbuildingEditProposal
      ),
      stageLongCharacterEditProposal: deferShellAction(
        () => ports.proposals.stageLongCharacterEditProposal
      ),
      stageLongDraftEditProposal: deferShellAction(
        () => ports.proposals.stageLongDraftEditProposal
      ),
      handleLongWorkspaceProposal: (event) =>
        ports.novel.longWorkspaceProposals.handleEvent(event),
      stageLibraryEditProposal: deferShellAction(
        () => ports.proposals.stageLibraryEditProposal
      ),
      allConversations: deferShellAction(
        () => ports.conversations.allConversations
      ),
      scheduleQueuedAgentEdits: deferShellAction(
        () => ports.proposals.scheduleQueuedAgentEdits
      ),
      onAsyncError(error) {
        console.error(
          "DeepWrite long workspace proposal event could not be handled:",
          error
        );
      }
    });
    const removeNativeListener = window.deepwrite?.events.subscribe((event) => {
      systemEventCenter.publish(event);
    });
    let stopped = false;

    return () => {
      if (stopped) return;
      stopped = true;
      removeNativeListener?.();
      removeRoutes();
    };
  }

  const handleGlobalKeydown = useWorkspaceWindowMenus({
    busy: () =>
      ports.state.catalogMutationPending.value ||
      ports.state.longMutationPending.value,
    create: deferShellAction(() => ports.features.openCreateBookDialog),
    open: () =>
      ports.resourceActions.handleResourceAction({
        domain: "creation",
        action: "choose-open-book"
      }),
    settings: ports.features.featureHost.openSettings,
    leftCollapsed: () => ports.state.leftCollapsed.value,
    toggleLeft: () => {
      ports.state.leftCollapsed.value = !ports.state.leftCollapsed.value;
    },
    rightCollapsed: () => ports.state.rightCollapsed.value,
    toggleRight: () => {
      ports.state.rightCollapsed.value = !ports.state.rightCollapsed.value;
    },
    canToggleRight: () => false,
    escape: () => {
      ports.features.closeCreateBookDialog();
      ports.state.bookTransferDialogMode.value = null;
      ports.libraries.libraryProjectDialog.value = null;
      ports.libraries.libraryGroupDialog.value = null;
      ports.editor.keepSaveConflictDraft();
      if (ports.state.currentView.value === "settings")
        void ports.features.featureHost.closeSettings();
    }
  });

  async function refreshWorkspaceOnWindowFocus(): Promise<void> {
    if (!window.deepwrite) return;
    const tasks: Promise<unknown>[] = [
      ports.features.loadAppAlerts(),
      ports.editor.loadCatalogSnapshot(),
      ports.novel.loadLongBookList({ notify: true })
    ];
    const bookId = ports.state.activeLongBookId.value;
    if (bookId) {
      tasks.push(ports.novel.refreshLongWorkspaceOnWindowFocus(bookId));
    }
    const results = await Promise.allSettled(tasks);
    const failure = results.find(
      (result): result is PromiseRejectedResult => result.status === "rejected"
    );
    if (failure) throw failure.reason;
  }

  watch(
    ports.resources.activeRightPanePreferenceKey,
    (key) => ports.state.layoutStore.setActiveRightPanePreferenceKey(key),
    {
      flush: "sync",
      immediate: true
    }
  );

  const workspaceLifecycle = useWorkspaceLifecycleCoordinator({
    windowTarget: window,
    activeFeature: ports.features.activeFeature,
    desktopAvailable: () => Boolean(window.deepwrite),
    handleKeydown: handleGlobalKeydown,
    reconcileLayout: deferShellAction(() => ports.state.reconcilePaneWidths),
    draftRecovery: ports.state.draftRecoveryPersistence,
    hydrateConversationPreferences:
      ports.conversations.hydrateConversationPreferences,
    loadGeneralSettings: deferShellAction(
      () => ports.editor.loadGeneralSettings
    ),
    startSystemEvents: startWorkspaceSystemEvents,
    startDesktopSideEffects: async () => {
      await ports.features.loadAppAlerts();
    },
    loadCatalog: deferShellAction(() => ports.editor.loadCatalogSnapshot),
    ensureFeatureDependencies:
      ports.features.featureHost.ensureActiveFeatureDependencies,
    scheduleDirtyDraftAutoSave: deferShellAction(
      () => ports.editor.scheduleDirtyEditorDraftsForAutoSave
    ),
    loadLongBookList: () => ports.novel.loadLongBookList({ notify: false }),
    refreshOnFocus: refreshWorkspaceOnWindowFocus,
    onDraftRecoveryLoaded: deferShellAction(
      () => ports.editor.recordRecoveredDraftCount
    ),
    notifyRecoveredDrafts: deferShellAction(
      () => ports.editor.notifyRecoveredDrafts
    ),
    cleanupBeforeDraftRecovery: [
      deferShellAction(() => ports.state.disposeLayout),
      ports.features.featureHost.dispose,
      deferShellAction(() => ports.editor.disposeCatalogWorkspaceProjection),
      deferShellAction(
        () => ports.resources.disposeLazyApprovalNavigationCoordinator
      ),
      deferShellAction(() => ports.novelTransactions.disposeLongBookLifecycle),
      deferShellAction(
        () => ports.conversations.disposeLibraryConversationCoordinator
      ),
      deferShellAction(() => ports.conversations.disposeLongConversation),
      deferShellAction(
        () => ports.conversations.disposeConversationRuntimeRegistry
      ),
      deferShellAction(() => ports.novel.disposeLongProposalRuntime),
      deferShellAction(() => ports.proposals.disposeProposalCoordinator),
      deferShellAction(
        () => ports.novelTransactions.disposeLongStructureTransactions
      ),
      deferShellAction(() => ports.editor.disposeEditorAutoSave),
      deferShellAction(() => ports.resources.disposeWorkspaceResources),
      deferShellAction(() => ports.novel.disposeLongWorkspaceSession),
      deferShellAction(() => ports.editor.disposeCatalogDocumentPersistence),
      () => ports.editor.catalogDocumentLoader.dispose(),
      () => ports.state.catalogIndexStore.dispose()
    ],
    cleanup: [
      deferShellAction(() => ports.editor.disposeGeneralSettings),
      () =>
        ports.state.conversationStore.dispose({
          flush: ports.conversations.conversationPersistenceEnabled,
          isCurrent: ports.state.ownsConversationStore
        })
    ],
    onError(error, operation) {
      console.error(
        `DeepWrite workspace lifecycle ${operation} failed:`,
        error
      );
    }
  });

  onMounted(() => {
    void workspaceLifecycle.start().catch((error: unknown) => {
      console.error("DeepWrite workspace startup failed:", error);
    });
  });

  onBeforeUnmount(() => {
    void workspaceLifecycle.dispose();
  });
  return {};
}
