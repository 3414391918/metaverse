import type { ShellRuntimePorts } from "./runtimePorts";
import type { ResourcesRuntime } from "./resources.types";
import { deferShellAction } from "./deferShellAction";
import { computed, nextTick } from "vue";
import { useLazyApprovalNavigationCoordinator } from "../../composables/useLazyApprovalNavigationCoordinator";
import { useWorkspaceResourceNavigation } from "../../composables/useWorkspaceResourceNavigation";
import { uiMessage } from "../../ui-feedback";
import { EMPTY_WORKSPACE_DOCUMENT } from "../../data/emptyWorkspaceDocument";
import { longBookResourceId } from "../../types/longWorkspace";
import {
  editorEntrySearchDocuments,
  editorEntrySearchSources
} from "../../utils/editorEntrySearch";
import type { ApprovalNavigationTarget } from "../../utils/approvalNavigation";
import { longNavigationNodeId } from "../../utils/longWorkspaceResourceTree";

/** resources assembly for the novel and library workspace. */
export function useShellResources(ports: ShellRuntimePorts): ResourcesRuntime {
  const {
    activeAgentDocument,
    activeDocument,
    activeEditorDraft,
    activePromptDocument,
    activeRightPanePreferenceKey,
    clearEditorSelectionReferences,
    dispose: disposeWorkspaceResources,
    documentForResourceId,
    ensureCatalogDocumentLoaded,
    ensureCatalogDocumentsLoaded,
    findResourceNodeIn,
    findResourceNodeWhere,
    hydratedCatalogSnapshot,
    insertEditorSelectionReference,
    liveWorkspaceDocuments,
    locateEditorSelectionReference,
    promptDocumentForResourceId,
    removeEditorSelectionReference,
    resourceIdForDocumentId,
    resourceNode,
    selectResource,
    libraryCatalogContextDocuments
  } = useWorkspaceResourceNavigation({
    state: {
      selectedResourceId: ports.state.selectedResourceId,
      pendingEditorReferences: ports.state.pendingEditorReferences,
      editorReferenceNavigation: ports.state.editorReferenceNavigation,
      documents: ports.state.documents,
      editorDrafts: ports.state.editorDrafts
    },
    catalog: {
      snapshot: ports.state.catalogSnapshot,
      projection: ports.state.catalogProjection,
      reconciledProjection: ports.editor.reconciledCatalogProjection,
      loader: ports.editor.catalogDocumentLoader
    },
    tree: {
      sections: ports.tree.resourceTreeSections,
      lookup: ports.tree.resourceTreeLookup
    },
    longNavigation: {
      books: ports.state.longBooks,
      activeBookId: ports.state.activeLongBookId,
      activeBookSummary: ports.state.activeLongBookSummary,
      workspaceIndex: ports.state.activeLongWorkspaceIndex,
      activeRoot: ports.novel.activeLongRoot,
      workspaceActive: ports.features.isLongWorkspaceActive,
      saveActiveEditorBeforeLeaving: deferShellAction(
        () => ports.novel.saveActiveLongEditorBeforeLeaving
      ),
      openBook: deferShellAction(() => ports.novel.openLongBook),
      selectWorkspaceFile: deferShellAction(
        () => ports.novel.selectLongWorkspaceFile
      ),
      deactivateActiveBook: deferShellAction(
        () => ports.novel.deactivateActiveLongBook
      )
    },
    emptyDocument: EMPTY_WORKSPACE_DOCUMENT,
    showConversation: ports.features.featureHost.showConversation,
    revealEditor: () => {
      ports.editor.revealTextPane();
    },
    notifications: uiMessage
  });

  ports.novel.longWorkspacePresentation.bindEditor({
    selectedResourceId: ports.state.selectedResourceId,
    activeDocument,
    activeAgentDocument,
    promptDocumentForResourceId
  });

  const activeEditorEntrySearchItems = computed(() =>
    editorEntrySearchSources(liveWorkspaceDocuments.value, activeDocument.value)
  );

  const writingEditorViewModel = computed(() => ({
    document: activeDocument.value,
    resourceId: ports.state.selectedResourceId.value,
    draftState: activeEditorDraft.value,
    locateReference: ports.state.editorReferenceNavigation.value,
    locked: ports.novel.editorLocked.value,
    lockedLabel: ports.novel.editorLockedLabel.value,
    saving: ports.novel.editorSaving.value,
    manualSaving: ports.editor.manualSavingDocumentIds.value.has(
      activeDocument.value.id
    ),
    autoSaveEnabled: ports.state.editorAutoSaveEnabled.value,
    defaultViewMode: ports.state.generalSettings.value.defaultTextViewMode,
    entrySearchItems: activeEditorEntrySearchItems.value
  }));

  const approvalNavigation = useLazyApprovalNavigationCoordinator({
    context: {
      catalog: {
        documents: () => ports.state.documents.value,
        documentById: (documentId) =>
          ports.editor.documentById.value.get(documentId),
        refresh: deferShellAction(() => ports.editor.loadCatalogSnapshot)
      },
      resources: {
        resourceIdForDocumentId,
        node: resourceNode,
        libraryNode: (libraryId) =>
          findResourceNodeWhere(
            (node) =>
              node.catalogNodeType === "library" && node.libraryId === libraryId
          ),
        select: selectResource,
        selectedResourceId: () => ports.state.selectedResourceId.value,
        documentForResourceId,
        preferredLongResourceId: deferShellAction(
          () => ports.tree.preferredLongResourceIdForSelection
        ),
        longNavigationResourceId: longNavigationNodeId,
        longBookResourceId,
        setSelectedResourceId: (resourceId) => {
          ports.state.selectedResourceId.value = resourceId;
        }
      },
      longWorkspace: {
        activeBookId: () => ports.state.activeLongBookId.value,
        activeBookSummary: () => ports.state.activeLongBookSummary.value,
        workspaceIndex: () => ports.state.activeLongWorkspaceIndex.value,
        editor: () => ports.novel.longWorkspaceEditor.value,
        saveEditorBeforeLeaving: deferShellAction(
          () => ports.novel.saveActiveLongEditorBeforeLeaving
        ),
        saveActiveEditorChanges: deferShellAction(
          () => ports.novel.saveActiveLongEditorChanges
        ),
        async openBook(bookId) {
          await ports.novel.openLongBook(bookId);
        },
        refresh: deferShellAction(() => ports.novel.refreshActiveLongWorkspace),
        selectFile: deferShellAction(() => ports.novel.selectLongWorkspaceFile),
        async resolveNavigation(target, summary, index) {
          const { resolveLongApprovalNavigation } =
            await import("../../utils/approvalNavigation");
          return resolveLongApprovalNavigation(target, summary, index);
        }
      },
      view: {
        showConversation: ports.features.featureHost.showConversation,
        expandRightPane() {
          ports.editor.revealTextPane();
        },
        afterUpdate: nextTick,
        info: (message) => uiMessage.info(message)
      }
    },
    notifications: uiMessage
  });

  function navigateToApprovalTarget(
    target: ApprovalNavigationTarget
  ): Promise<boolean> {
    return approvalNavigation.navigateToTarget(target);
  }

  async function selectEditorEntrySearchResult(
    documentId: string
  ): Promise<void> {
    const target = liveWorkspaceDocuments.value.find(
      (document) => document.id === documentId
    );
    if (!target) {
      uiMessage.warning("目标条目已不存在，无法跳转。");
      return;
    }
    const navigated = await navigateToApprovalTarget({
      kind: "document",
      workspaceId: target.workspaceId ?? target.libraryId ?? target.id,
      documentId: target.id
    });
    if (!navigated) uiMessage.warning("目标条目暂时无法打开。");
  }

  async function prepareEditorEntrySearch(): Promise<void> {
    await ensureCatalogDocumentsLoaded(
      editorEntrySearchDocuments(
        liveWorkspaceDocuments.value,
        activeDocument.value
      )
    );
  }

  async function selectLongEntrySearchResult(fileId: string): Promise<void> {
    const bookId = ports.state.activeLongBookId.value;
    if (!bookId) return;
    const navigated = await navigateToApprovalTarget({
      kind: "long",
      bookId,
      candidates: [{ kind: "file", fileId }]
    });
    if (!navigated) uiMessage.warning("目标小说条目暂时无法打开。");
  }

  const disposeLazyApprovalNavigationCoordinator = approvalNavigation.dispose;

  async function locateAcceptedEditProposal(input: {
    runId: string;
    proposalId: string;
  }): Promise<void> {
    const conversation = ports.features.isLongWorkspaceActive.value
      ? ports.conversations.activeLongConversation.value
      : ports.conversations.activeConversation.value;
    const proposal = conversation?.getEditProposal(
      input.runId,
      input.proposalId
    );
    if (!proposal || proposal.status !== "accepted") return;
    const { resolveAgentEditApprovalTarget } =
      await import("../../utils/approvalNavigation");
    if (
      !(await navigateToApprovalTarget(
        resolveAgentEditApprovalTarget(proposal)
      ))
    ) {
      uiMessage.warning("目标文件或所属条目已不存在，无法跳转。");
    }
  }
  return {
    activePromptDocument,
    activeAgentDocument,
    activeRightPanePreferenceKey,
    clearEditorSelectionReferences,
    disposeWorkspaceResources,
    ensureCatalogDocumentLoaded,
    ensureCatalogDocumentsLoaded,
    findResourceNodeIn,
    hydratedCatalogSnapshot,
    insertEditorSelectionReference,
    liveWorkspaceDocuments,
    locateEditorSelectionReference,
    removeEditorSelectionReference,
    resourceNode,
    selectResource,
    libraryCatalogContextDocuments,
    writingEditorViewModel,
    navigateToApprovalTarget,
    selectEditorEntrySearchResult,
    prepareEditorEntrySearch,
    selectLongEntrySearchResult,
    disposeLazyApprovalNavigationCoordinator,
    locateAcceptedEditProposal
  };
}
