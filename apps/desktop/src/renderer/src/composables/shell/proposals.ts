import type { ShellRuntimePorts } from "./runtimePorts";
import type { ProposalsRuntime } from "./proposals.types";
import { deferShellAction } from "./deferShellAction";
import { useLazyProposalCoordinator } from "../../composables/useLazyProposalCoordinator";
import { uiMessage } from "../../ui-feedback";

/** proposals assembly for the novel and library workspace. */
export function useShellProposals(ports: ShellRuntimePorts): ProposalsRuntime {
  function setAgentEditDocumentAccepting(
    documentId: string,
    accepting: boolean
  ): void {
    const next = new Set(ports.state.acceptingAgentEditDocumentIds.value);
    if (accepting) {
      next.add(documentId);
    } else {
      next.delete(documentId);
    }
    ports.state.acceptingAgentEditDocumentIds.value = next;
  }

  function setAgentEditWorkspaceAccepting(
    workspaceId: string,
    accepting: boolean
  ): void {
    const next = new Set(ports.state.acceptingAgentEditWorkspaceIds.value);
    if (accepting) {
      next.add(workspaceId);
    } else {
      next.delete(workspaceId);
    }
    ports.state.acceptingAgentEditWorkspaceIds.value = next;
  }

  function rememberWorkspaceMutationEvent(eventId: string): boolean {
    if (ports.state.handledWorkspaceMutationEventIds.has(eventId)) return false;
    ports.state.handledWorkspaceMutationEventIds.add(eventId);
    while (ports.state.handledWorkspaceMutationEventIds.size > 2_000) {
      const oldest = ports.state.handledWorkspaceMutationEventIds
        .values()
        .next().value as string | undefined;
      if (!oldest) break;
      ports.state.handledWorkspaceMutationEventIds.delete(oldest);
    }
    return true;
  }

  const {
    resumeRecoveredAutomaticAgentEdits,
    hasQueuedAgentEdits,
    reviewAgentEdit,
    reviewLongAgentEdit,
    discardAgentEdit,
    scheduleQueuedAgentEdits,
    stageLibraryEditProposal,
    stageLongCharacterEditProposal,
    stageLongDraftEditProposal,
    stageLongPlotDesignEditProposal,
    stageLongWorldbuildingEditProposal,
    dispose: disposeProposalCoordinator
  } = useLazyProposalCoordinator({
    api: () => window.deepwrite,
    notifications: uiMessage,
    catalog: {
      snapshot: ports.state.catalogSnapshot,
      findCatalogLibrary: deferShellAction(
        () => ports.libraries.findCatalogLibrary
      ),
      loadSnapshot: deferShellAction(() => ports.editor.loadCatalogSnapshot),
      applyAcceptedDocumentLocally: deferShellAction(
        () => ports.editor.applyAcceptedAgentDocumentLocally
      ),
      applyCreatedLibraryEntry: deferShellAction(
        () => ports.editor.applyCreatedLibraryEntry
      ),
      applySavedLibraryEntry: deferShellAction(
        () => ports.editor.applySavedLibraryEntry
      ),
      applyUpdatedLibrary: deferShellAction(
        () => ports.editor.applyUpdatedCatalogLibrary
      ),
      isConflict: deferShellAction(() => ports.editor.isCatalogConflict)
    },
    editor: {
      documents: ports.state.documents,
      drafts: ports.state.editorDrafts,
      liveDocuments: ports.resources.liveWorkspaceDocuments,
      acceptingWorkspaceIds: ports.state.acceptingAgentEditWorkspaceIds,
      savingDocumentIds: ports.editor.savingDocumentIds,
      rememberWorkspaceMutationEvent,
      setDocumentAccepting: setAgentEditDocumentAccepting,
      setWorkspaceAccepting: setAgentEditWorkspaceAccepting
    },
    conversations: {
      active: ports.conversations.activeConversation,
      activeLong: ports.conversations.activeLongConversation,
      byKey: ports.state.conversations,
      all: deferShellAction(() => ports.conversations.allConversations),
      forLongProposal: deferShellAction(
        () => ports.novel.longConversationForProposalEvent
      )
    },
    longWorkspace: {
      activeBookId: ports.state.activeLongBookId,
      books: ports.state.longBooks,
      refreshWorkspaceAfterProposal: deferShellAction(
        () => ports.novel.refreshLongProposalWorkspace
      ),
      saveActiveEditorChanges: deferShellAction(
        () => ports.novel.saveActiveLongEditorChanges
      )
    },
    navigation: {
      selectedResourceId: ports.state.selectedResourceId,
      activeCreationResourceId: ports.state.activeCreationResourceId,
      rightCollapsed: ports.state.rightCollapsed
    }
  });

  ports.state.proposalEditQueueBridge.hasQueued = hasQueuedAgentEdits;
  return {
    stageLibraryEditProposal,
    stageLongPlotDesignEditProposal,
    stageLongWorldbuildingEditProposal,
    stageLongCharacterEditProposal,
    stageLongDraftEditProposal,
    resumeRecoveredAutomaticAgentEdits,
    reviewAgentEdit,
    reviewLongAgentEdit,
    discardAgentEdit,
    scheduleQueuedAgentEdits,
    disposeProposalCoordinator
  };
}
