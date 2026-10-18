import type { ShellRuntimePorts } from "./runtimePorts";
import type { LibrariesRuntime } from "./libraries.types";
import { deferShellAction } from "./deferShellAction";
import { useCatalogLibraryTransactionsCoordinator } from "../../composables/useCatalogLibraryTransactionsCoordinator";
import { uiMessage } from "../../ui-feedback";

/** libraries assembly for the novel and library workspace. */
export function useShellLibraries(ports: ShellRuntimePorts): LibrariesRuntime {
  const {
    libraryProjectDialog,
    externalLibraryImport,
    libraryGroupDialog,
    libraryRemovalDialog,
    libraryEntryClipboardDomain,
    pendingLibraryEntryMove,
    activeLibraryGroup,
    createCatalogLibrary,
    saveCatalogLibraryGroup,
    createCatalogLibraryEntry,
    renameCatalogLibrary,
    renameCatalogLibraryEntry,
    removeCatalogLibraryEntry,
    requestCatalogLibraryEntryMove,
    confirmCatalogLibraryEntryMove,
    confirmLibraryRemoval,
    handleResourceNodeAction
  } = useCatalogLibraryTransactionsCoordinator({
    api: () => window.deepwrite?.catalog,
    snapshot: ports.state.catalogSnapshot,
    documents: ports.state.documents,
    drafts: ports.state.editorDrafts,
    mutationPending: ports.state.catalogMutationPending,
    findLibrary: findCatalogLibrary,
    ensureDocumentLoaded: (document) =>
      ports.resources.ensureCatalogDocumentLoaded(document),
    refreshCatalog: deferShellAction(() => ports.editor.loadCatalogSnapshot),
    refreshWorkspaceDirectory() {
      return ports.features.featureHost.loadWorkspaceDirectory();
    },
    advanceDraftProjectRevision: advanceLibraryDraftProjectRevision,
    isConflict: deferShellAction(() => ports.editor.isCatalogConflict),
    prepareProjectsForDuplicate: prepareLibraryProjectsForDuplicate,
    selectDocument(documentId, revealEditor) {
      ports.state.selectedResourceId.value = documentId;
      if (revealEditor) ports.editor.revealTextPane();
    },
    async navigateToDocumentResource(documentId) {
      const targetNode = ports.resources.findResourceNodeIn(
        ports.tree.resourceTreeSections.value,
        documentId
      );
      if (targetNode) await ports.resources.selectResource(targetNode);
    },
    collectResourceNodeIds: (node) => ports.tree.collectResourceNodeIds(node),
    disposeLibraryConversation,
    notifications: uiMessage
  });

  async function prepareLibraryProjectsForDuplicate(
    libraryIds: ReadonlySet<string>
  ): Promise<boolean> {
    await ports.editor.drainEditorSaves();
    const scopedDocuments = ports.state.documents.value.filter(
      (document) => document.libraryId && libraryIds.has(document.libraryId)
    );
    if (
      ports.editor.saveConflict.value &&
      scopedDocuments.some(
        ({ id }) => id === ports.editor.saveConflict.value?.documentId
      )
    ) {
      uiMessage.warning("请先处理资料库尚未解决的保存冲突。");
      return false;
    }
    for (const document of scopedDocuments) {
      if (document.readOnly) continue;
      const draft = ports.state.editorDrafts.value[document.id];
      if (!draft?.dirty) continue;
      ports.editor.cancelEditorAutoSave(document.id);
      const saved = await ports.editor.persistEditorDocument(
        { id: document.id, title: draft.title, content: draft.content },
        false
      );
      if (!saved) {
        uiMessage.warning("存在无法安全保存的资料库草稿，复制已取消。");
        return false;
      }
    }
    return true;
  }

  function disposeLibraryConversation(
    domain: "material" | "skill",
    libraryId: string
  ): void {
    const key = `library:${domain}:${libraryId}`;
    ports.state.conversationStore.removeController(key);
    ports.conversations.removeAgentRunPreferences(key);
  }

  function findCatalogLibrary(domain: "material" | "skill", libraryId: string) {
    return domain === "material"
      ? ports.state.catalogSnapshot.value?.materials.find(
          (library) => library.id === libraryId
        )
      : ports.state.catalogSnapshot.value?.skills.find(
          (library) => library.id === libraryId
        );
  }

  function advanceLibraryDraftProjectRevision(
    domain: "material" | "skill",
    libraryId: string,
    expectedProjectRevision: number | undefined
  ): void {
    const projectRevision = findCatalogLibrary(
      domain,
      libraryId
    )?.projectRevision;
    if (
      projectRevision === undefined ||
      expectedProjectRevision === undefined ||
      projectRevision !== expectedProjectRevision
    ) {
      return;
    }
    const documentIds = new Set(
      ports.state.documents.value
        .filter(
          (document) =>
            document.domain === domain && document.libraryId === libraryId
        )
        .map((document) => document.id)
    );
    ports.state.editorDrafts.value = Object.fromEntries(
      Object.entries(ports.state.editorDrafts.value).map(
        ([documentId, draft]) => [
          documentId,
          documentIds.has(documentId) && draft.dirty
            ? {
                ...draft,
                recoveryUpdatedAt: ports.state.nextDraftRecoveryTimestamp(),
                baseProjectRevision: projectRevision
              }
            : draft
        ]
      )
    );
  }
  return {
    libraryProjectDialog,
    externalLibraryImport,
    libraryGroupDialog,
    libraryRemovalDialog,
    libraryEntryClipboardDomain,
    pendingLibraryEntryMove,
    activeLibraryGroup,
    createCatalogLibrary,
    saveCatalogLibraryGroup,
    createCatalogLibraryEntry,
    renameCatalogLibrary,
    renameCatalogLibraryEntry,
    removeCatalogLibraryEntry,
    requestCatalogLibraryEntryMove,
    confirmCatalogLibraryEntryMove,
    confirmLibraryRemoval,
    handleResourceNodeAction,
    findCatalogLibrary
  };
}
