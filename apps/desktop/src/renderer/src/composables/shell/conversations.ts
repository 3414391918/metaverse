import type { ShellRuntimePorts } from "./runtimePorts";
import type { ConversationsRuntime } from "./conversations.types";
import { deferShellAction } from "./deferShellAction";
import { computed, provide } from "vue";
import type { GeneralPermissionMode } from "@deepwrite/contracts";
import { useAgentConversation } from "../../composables/useAgentConversation";
import { useLibraryConversationCoordinator } from "../../composables/useLibraryConversationCoordinator";
import { conversationRuntimeRegistryStorePort } from "../../composables/conversationRuntimeRegistryStorePort";
import { useConversationRuntimeRegistryCoordinator } from "../../composables/useConversationRuntimeRegistryCoordinator";
import { AGENT_ACTIVITY_CONTEXT_KEY } from "../../composables/agentActivityContext";
import { useAgentActivityCoordinator } from "../../composables/useAgentActivityCoordinator";
import { useCurrentAgentActivityView } from "../../composables/useCurrentAgentActivityView";
import { useLongConversationCoordinator } from "../../composables/useLongConversationCoordinator";
import { uiMessage } from "../../ui-feedback";
import { resolveLongWorkspaceApi } from "../../types/longWorkspace";
import {
  resolveAgentActivityDescriptor,
  resolveAgentActivityNavigationNode
} from "../../utils/agentActivityDescriptors";

/** conversations assembly for the novel and library workspace. */
export function useShellConversations(
  ports: ShellRuntimePorts
): ConversationsRuntime {
  const conversationRuntimeRegistry = useConversationRuntimeRegistryCoordinator(
    {
      store: conversationRuntimeRegistryStorePort(
        ports.state.conversationStore
      ),
      persistenceAdapter: ports.state.conversationPersistenceAdapter,
      modelSettings: ports.state.modelSettings,
      permissionMode: () => ports.state.generalSettings.value.permissionMode,
      createController: (hooks) =>
        useAgentConversation({
          api: () => window.deepwrite,
          autoApproveCrossStageOperations: () =>
            ports.state.generalSettings.value.autoApproveCrossStageOperations,
          onContextWarning: (message) => uiMessage.warning(message),
          ...hooks
        }),
      resumeRecovered: (controllers) =>
        ports.editor.resumeRecoveredAutomaticAgentEditsIfNeeded(controllers),
      notifications: uiMessage
    }
  );

  const {
    allConversations,
    applyModelSettingsToConversations,
    conversationForKey,
    dispose: disposeConversationRuntimeRegistry,
    hydrateConversationPreferences,
    persistenceEnabled: conversationPersistenceEnabled,
    removeAgentRunPreferences,
    synchronizeAgentRunPreferences,
    synchronizeSessionAgentModelSelection
  } = conversationRuntimeRegistry;

  conversationForKey("general");

  const {
    activeConversation: activeLongConversation,
    availableMaterialReferences: activeLongMaterialReferences,
    availableSkillReferences: activeLongSkillReferences,
    dispose: disposeLongConversation,
    newConversation: newLongConversation,
    selectAgentTeamMode: selectLongAgentTeamMode,
    selectApprovalMode: selectLongApprovalMode,
    selectConversation: selectLongConversation,
    selectModel: selectLongModel,
    selectTemperature: selectLongTemperature,
    selectThinking: selectLongThinking,
    sendLongMessage,
    stopGeneration: stopLongGeneration,
    updateDraft: updateLongComposerDraft,
    useSuggestion: useLongSuggestion
  } = useLongConversationCoordinator({
    state: {
      activeBookId: ports.state.activeLongBookId,
      activeBookSummary: ports.state.activeLongBookSummary,
      workspaceIndex: ports.state.activeLongWorkspaceIndex,
      selection: ports.state.activeLongSelection,
      fileContext: ports.state.activeLongFileContext,
      activeRoot: ports.novel.activeLongRoot,
      activeAgentProfile: ports.novel.activeLongAgentProfile,
      activeRuntimeContext: ports.novel.activeLongRuntimeContext,
      sendPreflightPending: ports.state.longSendPreflightPending,
      agentLoadError: ports.state.longAgentLoadError
    },
    runtime: {
      conversationKey: deferShellAction(() => ports.novel.longConversationKey),
      conversationForKey,
      synchronizeSessionModelSelection: synchronizeSessionAgentModelSelection,
      synchronizeRunPreferences: synchronizeAgentRunPreferences
    },
    workspace: {
      ensureAgentSettingsLoaded: deferShellAction(
        () => ports.features.ensureLongAgentSettingsLoaded
      ),
      saveActiveEditorChanges: deferShellAction(
        () => ports.novel.saveActiveLongEditorChanges
      ),
      refreshActiveWorkspace: deferShellAction(
        () => ports.novel.refreshActiveLongWorkspace
      ),
      captureForeshadowingFocus: () =>
        ports.novel.longWorkspaceEditor.value?.captureForeshadowingFocus() ?? {
          threadId: null,
          beatId: null
        },
      api: resolveLongWorkspaceApi
    },
    catalog: {
      indexSnapshot: ports.state.catalogSnapshot,
      documentsForProfile: deferShellAction(
        () => ports.novel.longCatalogContextDocuments
      ),
      ensureDocumentsLoaded: deferShellAction(
        () => ports.resources.ensureCatalogDocumentsLoaded
      ),
      hydratedSnapshot: deferShellAction(
        () => ports.resources.hydratedCatalogSnapshot
      ),
      buildAttachments: deferShellAction(
        () => ports.novel.buildLongLibraryAttachmentsForProfile
      ),
      filterReadableAttachments: deferShellAction(
        () => ports.novel.filterLongReadableAttachmentsForProfile
      )
    },
    settings: {
      permissionMode: () => ports.state.generalSettings.value.permissionMode,
      updatePermissionMode: deferShellAction(
        () => ports.editor.updatePermissionMode
      )
    },
    commands: {
      stopGeneration: deferShellAction(
        () => ports.novel.stopLongGenerationCommand
      )
    },
    showConversation: ports.features.featureHost.showConversation,
    notifications: uiMessage
  });

  const {
    activeConversation,
    conversationContext: writingConversationContext,
    dispose: disposeLibraryConversationCoordinator,
    newConversation: newLibraryConversation,
    selectAgentTeamMode,
    selectApprovalMode,
    selectConversation,
    selectModel,
    selectTemperature,
    selectThinking,
    sendMessage,
    stopGeneration,
    updateDraft: updateComposerDraft,
    useSuggestion
  } = useLibraryConversationCoordinator({
    runtime: {
      conversationForKey,
      synchronizeSessionModelSelection: synchronizeSessionAgentModelSelection,
      synchronizeRunPreferences: synchronizeAgentRunPreferences
    },
    resource: {
      selectedResourceId: ports.state.selectedResourceId,
      activeAgentDocument: ports.resources.activeAgentDocument,
      activePromptDocument: ports.resources.activePromptDocument,
      liveWorkspaceDocuments: ports.resources.liveWorkspaceDocuments,
      pendingEditorReferences: ports.state.pendingEditorReferences,
      leftCollapsed: ports.state.leftCollapsed,
      rightCollapsed: ports.state.rightCollapsed,
      clearEditorSelectionReferences: deferShellAction(
        () => ports.resources.clearEditorSelectionReferences
      ),
      contextDocuments: deferShellAction(
        () => ports.resources.libraryCatalogContextDocuments
      ),
      ensureDocumentsLoaded: deferShellAction(
        () => ports.resources.ensureCatalogDocumentsLoaded
      ),
      hydratedCatalogSnapshot: deferShellAction(
        () => ports.resources.hydratedCatalogSnapshot
      )
    },
    catalog: {
      snapshot: ports.state.catalogSnapshot
    },
    profiles: {
      libraryAgents: ports.state.libraryAgentSettings
    },
    edits: {
      acceptingDocumentIds: ports.state.acceptingAgentEditDocumentIds,
      acceptingWorkspaceIds: ports.state.acceptingAgentEditWorkspaceIds,
      hasQueued: () => ports.state.proposalEditQueueBridge.hasQueued(),
      schedule: (predicate) =>
        ports.proposals.scheduleQueuedAgentEdits(predicate),
      resumeRecovered: (conversations) =>
        ports.editor.resumeRecoveredAutomaticAgentEditsIfNeeded(conversations)
    },
    settings: {
      permissionMode: () => ports.state.generalSettings.value.permissionMode,
      updatePermissionMode: deferShellAction(
        () => ports.editor.updatePermissionMode
      )
    },
    runtimeAvailable: () => ports.state.hasDesktopRuntime.value,
    showConversation: ports.features.featureHost.showConversation,
    notifications: uiMessage
  });

  const libraryAgentActivityResourceId = computed(
    () =>
      ports.tree.resourceTreeLookup.value.resourceIdByDocumentId.get(
        ports.resources.activeAgentDocument.value.id
      ) ??
      (ports.state.activeCreationResourceId.value ||
        ports.state.selectedResourceId.value)
  );

  const longAgentActivityResourceId = computed(() => {
    const bookId = ports.state.activeLongBookId.value;
    const index = ports.state.activeLongWorkspaceIndex.value;
    const selection = ports.state.activeLongSelection.value;
    if (bookId && index && selection) {
      const preferred = ports.tree.preferredLongResourceIdForSelection(
        bookId,
        index,
        selection
      );
      if (
        preferred &&
        ports.tree.resourceTreeLookup.value.nodeById.has(preferred)
      ) {
        return preferred;
      }
    }
    return ports.state.selectedResourceId.value;
  });

  const currentAgentActivityView = useCurrentAgentActivityView({
    activeFeature: ports.features.activeFeature,
    libraryResourceId: libraryAgentActivityResourceId,
    longResourceId: longAgentActivityResourceId,
    libraryConversation: activeConversation,
    libraryContext: writingConversationContext,
    longConversation: activeLongConversation,
    longProfile: ports.novel.activeLongAgentProfile,
    longBook: ports.state.activeLongBookSummary,
    longSelection: ports.state.activeLongSelection,
    longRoot: ports.novel.activeLongRoot
  });

  const agentActivity = useAgentActivityCoordinator({
    controllers: ports.state.conversationControllers,
    scopesByKey: ports.state.conversationScopesByKey,
    registryRevision: ports.state.controllerRegistryRevision,
    currentView: currentAgentActivityView,
    resolveDescriptor: (conversationKey) =>
      resolveAgentActivityDescriptor(conversationKey, {
        documents: ports.state.documents.value,
        resourceTree: ports.tree.resourceTreeLookup.value,
        longAgents: ports.state.longAgentSettings.value,
        libraryAgents: ports.state.libraryAgentSettings.value,
        longBooks: ports.state.longBooks.value
      }),
    async navigate(item) {
      const node = resolveAgentActivityNavigationNode(item, {
        documents: ports.state.documents.value,
        resourceTree: ports.tree.resourceTreeLookup.value,
        longAgents: ports.state.longAgentSettings.value,
        libraryAgents: ports.state.libraryAgentSettings.value,
        longBooks: ports.state.longBooks.value
      });
      if (!node) return "missing";
      await ports.resources.selectResource(node);
      if (item.chapterCardId) {
        await ports.novel.selectLongChapterCardTab(item.chapterCardId);
      }
      return ports.state.selectedResourceId.value === node.id ||
        (item.chapterCardId !== undefined &&
          ports.state.activeLongSelection.value?.chapterCardId ===
            item.chapterCardId)
        ? "navigated"
        : "blocked";
    },
    notifications: uiMessage
  });

  provide(AGENT_ACTIVITY_CONTEXT_KEY, agentActivity.context);

  function applyDefaultApprovalMode(
    permissionMode: GeneralPermissionMode
  ): void {
    conversationRuntimeRegistry.applyDefaultApprovalMode(permissionMode);
  }
  return {
    hydrateConversationPreferences,
    allConversations,
    applyModelSettingsToConversations,
    disposeConversationRuntimeRegistry,
    conversationPersistenceEnabled,
    removeAgentRunPreferences,
    activeLongConversation,
    activeLongMaterialReferences,
    activeLongSkillReferences,
    disposeLongConversation,
    newLongConversation,
    selectLongAgentTeamMode,
    selectLongApprovalMode,
    selectLongConversation,
    selectLongModel,
    selectLongTemperature,
    selectLongThinking,
    sendLongMessage,
    stopLongGeneration,
    updateLongComposerDraft,
    useLongSuggestion,
    activeConversation,
    writingConversationContext,
    disposeLibraryConversationCoordinator,
    newLibraryConversation,
    selectAgentTeamMode,
    selectApprovalMode,
    selectConversation,
    selectModel,
    selectTemperature,
    selectThinking,
    sendMessage,
    stopGeneration,
    updateComposerDraft,
    useSuggestion,
    applyDefaultApprovalMode
  };
}
