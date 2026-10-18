import type {
  CatalogIndexSnapshot,
  CatalogSnapshot,
  LongBookSummary,
  LongWorkspaceIndexSnapshot,
  LongWorkspaceRuntimeContext
} from "@deepwrite/contracts";
import { PROMPT_ATTACHMENT_MAX_ITEMS } from "@deepwrite/contracts";
import { computed, watch, type Ref } from "vue";
import type { CatalogWorkspaceProjection } from "../data/catalogWorkspace";
import type {
  CatalogDocumentsLoadResult,
  useCatalogDocumentLoader
} from "./useCatalogDocumentLoader";
import type {
  EditorTextReference,
  EditorTextReferenceNavigation
} from "../types/conversation";
import {
  reconcileLongWorkspaceSelection,
  type LongWorkspaceSelection
} from "../types/longWorkspace";
import type {
  EditorDraftState,
  ResourceTreeNode,
  ResourceTreeSection,
  WorkspaceDocument
} from "../types/workspace";
import { rightPanePreferenceKey } from "../utils/rightPanePreferences";
import type { ResourceTreeLookup } from "../utils/resourceTreeLookup";

export interface WorkspaceResourceCoordinatorOptions {
  state: {
    selectedResourceId: Ref<string>;
    pendingEditorReferences: Ref<EditorTextReference[]>;
    editorReferenceNavigation: Ref<EditorTextReferenceNavigation | undefined>;
    documents: Ref<WorkspaceDocument[]>;
    editorDrafts: Ref<Record<string, EditorDraftState>>;
  };
  catalog: {
    snapshot: Readonly<Ref<CatalogIndexSnapshot | null>>;
    projection: Readonly<Ref<CatalogWorkspaceProjection | null>>;
    reconciledProjection?: Readonly<Ref<CatalogWorkspaceProjection | null>>;
    loader: Pick<
      ReturnType<typeof useCatalogDocumentLoader>,
      "documentsById" | "ensureLoaded" | "ensureOne" | "contextSnapshot"
    >;
  };
  tree: {
    sections: Readonly<Ref<readonly ResourceTreeSection[]>>;
    lookup: Readonly<Ref<ResourceTreeLookup>>;
  };
  longNavigation: {
    books: Readonly<Ref<readonly LongBookSummary[]>>;
    activeBookId: Readonly<Ref<string | null>>;
    activeBookSummary: Readonly<Ref<LongBookSummary | null>>;
    workspaceIndex: Readonly<Ref<LongWorkspaceIndexSnapshot | null>>;
    activeRoot: Readonly<Ref<LongWorkspaceRuntimeContext["activeRoot"]>>;
    workspaceActive: Readonly<Ref<boolean>>;
    saveActiveEditorBeforeLeaving(nextBookId?: string): Promise<boolean>;
    openBook(
      bookId: string,
      selection?: LongWorkspaceSelection | null
    ): Promise<void>;
    selectWorkspaceFile(selection: LongWorkspaceSelection): Promise<unknown>;
    deactivateActiveBook(): void;
  };
  emptyDocument: Readonly<WorkspaceDocument>;
  showConversation(): void;
  revealEditor(): void;
  notifications: {
    error(message: string): void;
    info(message: string): void;
    warning(message: string): void;
  };
}

export type WorkspaceResourceCatalogPort =
  WorkspaceResourceCoordinatorOptions["catalog"];

/** Navigate novels and library documents while preserving save and load guards. */
export function useWorkspaceResourceCoordinator(
  options: WorkspaceResourceCoordinatorOptions
) {
  const { state, catalog, tree, longNavigation } = options;
  let generation = 0;
  let disposed = false;
  let referenceClock = 0;
  const current = (request: number) => !disposed && request === generation;
  function findResourceNodeIn(
    sections: readonly ResourceTreeSection[],
    id: string
  ): ResourceTreeNode | undefined {
    if (sections === tree.sections.value)
      return tree.lookup.value.nodeById.get(id);
    const visit = (
      nodes: readonly ResourceTreeNode[]
    ): ResourceTreeNode | undefined => {
      for (const node of nodes) {
        if (node.id === id) return node;
        const nested = visit(node.children ?? []);
        if (nested) return nested;
      }
      return undefined;
    };
    return visit(sections.flatMap(({ nodes }) => nodes));
  }
  function resourceNode(id: string) {
    return tree.lookup.value.nodeById.get(id);
  }
  function findResourceNodeWhere(
    predicate: (node: ResourceTreeNode) => boolean
  ) {
    return [...tree.lookup.value.nodeById.values()].find(predicate);
  }
  function resourceIdForDocumentId(id: string) {
    return tree.lookup.value.resourceIdByDocumentId.get(id);
  }
  function documentForResourceId(id: string): WorkspaceDocument | undefined {
    const node = resourceNode(id);
    const documentId =
      tree.lookup.value.targetDocumentIdByResourceId.get(id) ??
      node?.children?.find((child) => child.catalogNodeType === "document")
        ?.id ??
      id;
    const document = catalog.loader.documentsById.value.get(documentId);
    return document?.domain === "creation" ? undefined : document;
  }
  const activeDocument = computed(() =>
    liveDocument(
      documentForResourceId(state.selectedResourceId.value) ??
        options.emptyDocument
    )
  );
  const activeEditorDraft = computed(
    () => state.editorDrafts.value[activeDocument.value.id]
  );
  const liveWorkspaceDocuments = computed(() =>
    state.documents.value
      .filter((document) => document.domain !== "creation")
      .map((document) => {
        const draft = state.editorDrafts.value[document.id];
        return draft
          ? { ...document, title: draft.title, content: draft.content }
          : document;
      })
  );
  function liveDocument(document: WorkspaceDocument) {
    const draft = state.editorDrafts.value[document.id];
    return draft
      ? { ...document, title: draft.title, content: draft.content }
      : document;
  }
  const activeRightPanePreferenceKey = computed(() =>
    longNavigation.workspaceActive.value
      ? rightPanePreferenceKey({
          domain: "creation",
          workspaceType: "long",
          stageId: longNavigation.activeRoot.value
        })
      : rightPanePreferenceKey({
          domain: activeDocument.value.domain,
          ...(activeDocument.value.stageCategoryId
            ? { stageId: activeDocument.value.stageCategoryId }
            : {})
        })
  );
  function reportCatalogLoadFailure(
    result: CatalogDocumentsLoadResult,
    notify = true
  ): void {
    if (disposed || !notify) return;
    const failure = result.failures.find(
      ({ code }) =>
        code === "reader-unavailable" ||
        code === "read-failed" ||
        code === "invalid-result"
    );
    if (failure)
      options.notifications.error(
        failure.error instanceof Error
          ? failure.error.message
          : "读取资料库文稿失败，请重新选择后重试。"
      );
  }
  async function ensureCatalogDocumentLoaded(
    document: WorkspaceDocument,
    loadOptions: { notify?: boolean } = {}
  ): Promise<WorkspaceDocument> {
    if (disposed) return document;
    const result = await catalog.loader.ensureOne(document);
    if (disposed) return document;
    reportCatalogLoadFailure(result, loadOptions.notify !== false);
    return result.document ?? document;
  }
  async function ensureCatalogDocumentsLoaded(
    documents: readonly WorkspaceDocument[],
    loadOptions: { notify?: boolean } = {}
  ): Promise<boolean> {
    if (disposed) return false;
    const result = await catalog.loader.ensureLoaded(documents);
    if (disposed) return false;
    reportCatalogLoadFailure(result, loadOptions.notify !== false);
    return result.ok;
  }
  function hydratedCatalogSnapshot(): CatalogSnapshot | null {
    return catalog.loader.contextSnapshot(
      catalog.snapshot.value,
      liveWorkspaceDocuments.value
    );
  }
  function libraryCatalogContextDocuments(): WorkspaceDocument[] {
    const libraryId = activeDocument.value.libraryId;
    const snapshot = catalog.snapshot.value;
    const groups =
      activeDocument.value.domain === "skill"
        ? snapshot?.skillGroups
        : snapshot?.materialGroups;
    const group = groups?.find((group) =>
      Object.values(group.members).includes(libraryId)
    );
    const ids = new Set([libraryId, ...Object.values(group?.members ?? {})]);
    return state.documents.value.filter(
      (document) => document.libraryId && ids.has(document.libraryId)
    );
  }
  const stopActiveDocumentLoad = watch(
    () => {
      const document = documentForResourceId(state.selectedResourceId.value);
      return document
        ? `${document.id}\u0000${document.catalogContentStamp ?? ""}\u0000${document.catalogContentLoaded === false ? "unloaded" : "loaded"}`
        : "";
    },
    () => {
      const document = documentForResourceId(state.selectedResourceId.value);
      if (document?.catalogContentLoaded === false)
        void ensureCatalogDocumentLoaded(document).catch((error: unknown) => {
          if (!disposed)
            options.notifications.error(
              error instanceof Error ? error.message : "加载资料库文稿失败。"
            );
        });
    },
    { immediate: true }
  );
  const stopSelectionReconciliation = watch(
    () => ({
      sections: tree.sections.value,
      reconciled: catalog.reconciledProjection?.value
    }),
    () => {
      if (
        catalog.reconciledProjection &&
        catalog.projection.value !== catalog.reconciledProjection.value
      )
        return;
      const selected = state.selectedResourceId.value;
      if (!selected || resourceNode(selected)) return;
      generation += 1;
      state.selectedResourceId.value =
        state.documents.value.find((document) => document.domain !== "creation")
          ?.id ?? "";
    },
    { flush: "sync" }
  );
  async function selectResource(node: ResourceTreeNode): Promise<void> {
    let request = ++generation;
    if (
      !(await longNavigation.saveActiveEditorBeforeLeaving(node.longBookId)) ||
      !current(request)
    )
      return;
    if (node.longBookId) {
      options.showConversation();
      state.selectedResourceId.value = node.id;
      options.revealEditor();
      if (
        longNavigation.activeBookId.value !== node.longBookId ||
        !longNavigation.workspaceIndex.value
      )
        await longNavigation.openBook(
          node.longBookId,
          node.longWorkspaceSelection ?? null
        );
      if (!current(request)) return;
      if (
        node.longWorkspaceSelection &&
        longNavigation.activeBookSummary.value?.id === node.longBookId &&
        longNavigation.workspaceIndex.value
      ) {
        const selection = reconcileLongWorkspaceSelection(
          longNavigation.activeBookSummary.value,
          longNavigation.workspaceIndex.value,
          node.longWorkspaceSelection
        );
        if (selection) await longNavigation.selectWorkspaceFile(selection);
      }
      return;
    }
    const document = documentForResourceId(node.id);
    if (!document) return;
    if (longNavigation.activeBookId.value) {
      longNavigation.deactivateActiveBook();
      // The contraction reconciles old novel nodes synchronously.
      request = ++generation;
    }
    const loaded = await ensureCatalogDocumentLoaded(document);
    if (!current(request) || loaded.catalogContentLoaded === false) return;
    options.showConversation();
    state.selectedResourceId.value = node.id;
    options.revealEditor();
  }
  function clearEditorSelectionReferences() {
    state.pendingEditorReferences.value = [];
  }
  function removeEditorSelectionReference(id: string) {
    state.pendingEditorReferences.value =
      state.pendingEditorReferences.value.filter(
        (reference) => reference.id !== id
      );
  }
  function insertEditorSelectionReference(reference: EditorTextReference) {
    if (
      state.pendingEditorReferences.value.some(
        (item) =>
          item.documentId === reference.documentId &&
          item.start === reference.start &&
          item.end === reference.end &&
          item.text === reference.text
      )
    ) {
      options.notifications.info("这段文稿已经插入输入框");
      return;
    }
    if (
      state.pendingEditorReferences.value.length >= PROMPT_ATTACHMENT_MAX_ITEMS
    ) {
      options.notifications.warning(
        `每条消息最多插入 ${PROMPT_ATTACHMENT_MAX_ITEMS} 段文稿引用`
      );
      return;
    }
    state.pendingEditorReferences.value = [
      ...state.pendingEditorReferences.value,
      reference
    ];
  }
  function locateEditorSelectionReference(reference: EditorTextReference) {
    if (disposed) return;
    const document = state.documents.value.find(
      ({ id }) => id === reference.documentId
    );
    if (!document) {
      removeEditorSelectionReference(reference.id);
      options.notifications.warning("引用的文稿文件已不存在，已移除这条引用");
      return;
    }
    generation += 1;
    state.selectedResourceId.value =
      resourceIdForDocumentId(document.id) ?? document.id;
    options.revealEditor();
    state.editorReferenceNavigation.value = {
      requestId: ++referenceClock,
      reference
    };
  }
  function dispose() {
    disposed = true;
    generation += 1;
    stopActiveDocumentLoad();
    stopSelectionReconciliation();
  }
  return {
    activeDocument,
    activeAgentDocument: activeDocument,
    activePromptDocument: activeDocument,
    activeEditorDraft,
    activeRightPanePreferenceKey,
    liveWorkspaceDocuments,
    liveDocument,
    documentForResourceId,
    promptDocumentForResourceId: documentForResourceId,
    resourceIdForDocumentId,
    findResourceNodeIn,
    findResourceNodeWhere,
    resourceNode,
    ensureCatalogDocumentLoaded,
    ensureCatalogDocumentsLoaded,
    hydratedCatalogSnapshot,
    libraryCatalogContextDocuments,
    selectResource,
    clearEditorSelectionReferences,
    removeEditorSelectionReference,
    insertEditorSelectionReference,
    locateEditorSelectionReference,
    dispose
  };
}
