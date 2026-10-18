import type {
  LongBookSummary,
  LongWorkspaceIndexSnapshot
} from "@deepwrite/contracts";
import type { LongWorkspaceSelection } from "../types/longWorkspace";
import type { ResourceTreeNode, WorkspaceDocument } from "../types/workspace";
import type {
  ApprovalNavigationTarget,
  LongApprovalEditorFocus,
  ResolvedLongApprovalNavigation
} from "../utils/approvalNavigation";

type LongTarget = Extract<ApprovalNavigationTarget, { kind: "long" }>;

export interface ApprovalNavigationCatalogPort {
  documents(): readonly WorkspaceDocument[];
  documentById(documentId: string): WorkspaceDocument | undefined;
  refresh(): Promise<unknown>;
}

export interface ApprovalNavigationResourcePort {
  resourceIdForDocumentId(documentId: string): string | undefined;
  node(resourceId: string): ResourceTreeNode | undefined;
  libraryNode(libraryId: string): ResourceTreeNode | undefined;
  select(node: ResourceTreeNode): Promise<void>;
  selectedResourceId(): string;
  documentForResourceId(resourceId: string): WorkspaceDocument | undefined;
  preferredLongResourceId(
    bookId: string,
    index: LongWorkspaceIndexSnapshot,
    selection: LongWorkspaceSelection
  ): string | undefined;
  longNavigationResourceId(bookId: string, selectionKey: string): string;
  longBookResourceId(bookId: string): string;
  setSelectedResourceId(resourceId: string): void;
}

export interface ApprovalNavigationLongEditorPort {
  focusTarget(target: LongApprovalEditorFocus): Promise<boolean>;
}

export interface ApprovalNavigationLongWorkspacePort {
  activeBookId(): string | null;
  activeBookSummary(): LongBookSummary | null;
  workspaceIndex(): LongWorkspaceIndexSnapshot | null;
  editor(): ApprovalNavigationLongEditorPort | null;
  saveEditorBeforeLeaving(nextBookId: string): Promise<boolean>;
  saveActiveEditorChanges(): Promise<boolean>;
  openBook(bookId: string): Promise<void>;
  refresh(bookId: string): Promise<unknown>;
  selectFile(selection: LongWorkspaceSelection): Promise<boolean>;
  resolveNavigation(
    target: LongTarget,
    summary: LongBookSummary,
    index: LongWorkspaceIndexSnapshot
  ):
    | ResolvedLongApprovalNavigation
    | undefined
    | Promise<ResolvedLongApprovalNavigation | undefined>;
}

export interface ApprovalNavigationViewPort {
  showConversation(): void;
  expandRightPane(): void;
  afterUpdate(): Promise<void>;
  info(message: string): void;
}

export interface ApprovalNavigationCoordinatorContext {
  catalog: ApprovalNavigationCatalogPort;
  resources: ApprovalNavigationResourcePort;
  longWorkspace: ApprovalNavigationLongWorkspacePort;
  view: ApprovalNavigationViewPort;
}

/**
 * Owns accepted-edit navigation after a target has already been resolved.
 * The resolver itself remains a cold-path dependency supplied by the shell.
 */
export function useApprovalNavigationCoordinator(
  context: ApprovalNavigationCoordinatorContext
) {
  const activeTasks = new Set<Promise<unknown>>();
  let navigationTail: Promise<void> = Promise.resolve();
  let requestEpoch = 0;
  let disposed = false;

  function requestIsCurrent(requestId: number): boolean {
    return !disposed && requestId === requestEpoch;
  }

  function track<T>(task: Promise<T>): Promise<T> {
    activeTasks.add(task);
    void task.then(
      () => activeTasks.delete(task),
      () => activeTasks.delete(task)
    );
    return task;
  }

  function schedule(
    operation: (requestId: number) => Promise<boolean>
  ): Promise<boolean> {
    if (disposed) return Promise.resolve(false);
    const requestId = ++requestEpoch;
    const task = navigationTail.then(async () => {
      if (!requestIsCurrent(requestId)) return false;
      return await operation(requestId);
    });
    navigationTail = task.then(
      () => undefined,
      () => undefined
    );
    return track(task);
  }

  async function selectResource(
    node: ResourceTreeNode,
    requestId: number
  ): Promise<boolean> {
    if (!requestIsCurrent(requestId)) return false;
    await context.resources.select(node);
    return (
      requestIsCurrent(requestId) &&
      context.resources.selectedResourceId() === node.id
    );
  }

  async function navigateToApprovalDocumentInternal(
    document: WorkspaceDocument,
    requestId: number
  ): Promise<boolean> {
    if (!requestIsCurrent(requestId)) return false;
    const targetResourceId =
      context.resources.resourceIdForDocumentId(document.id) ?? document.id;
    const node = context.resources.node(targetResourceId);
    if (!node || !(await selectResource(node, requestId))) return false;
    return context.resources.documentForResourceId(node.id)?.id === document.id;
  }

  async function navigateToDocumentInternal(
    target: Extract<ApprovalNavigationTarget, { kind: "document" }>,
    requestId: number,
    refresh = true
  ): Promise<boolean> {
    const document = context.catalog.documentById(target.documentId);
    if (
      document &&
      (await navigateToApprovalDocumentInternal(document, requestId))
    ) {
      return true;
    }
    if (!requestIsCurrent(requestId)) return false;
    if (refresh) {
      await context.catalog.refresh();
      if (!requestIsCurrent(requestId)) return false;
      return await navigateToDocumentInternal(target, requestId, false);
    }
    const fallback = context.catalog
      .documents()
      .find((candidate) => candidate.workspaceId === target.workspaceId);
    return fallback
      ? await navigateToApprovalDocumentInternal(fallback, requestId)
      : false;
  }

  async function navigateToLibraryInternal(
    target: Extract<ApprovalNavigationTarget, { kind: "library" }>,
    requestId: number,
    refresh = true
  ): Promise<boolean> {
    const document = target.entryId
      ? context.catalog
          .documents()
          .find(
            (candidate) =>
              candidate.domain === target.domain &&
              candidate.libraryId === target.libraryId &&
              candidate.catalogEntryId === target.entryId
          )
      : context.catalog.documentById(target.documentId);
    if (
      document &&
      (await navigateToApprovalDocumentInternal(document, requestId))
    ) {
      return true;
    }
    if (!requestIsCurrent(requestId)) return false;
    if (refresh) {
      await context.catalog.refresh();
      if (!requestIsCurrent(requestId)) return false;
      return await navigateToLibraryInternal(target, requestId, false);
    }
    const fallbackNode = context.resources
      .libraryNode(target.libraryId)
      ?.children?.find((node) => node.catalogNodeType === "document");
    return fallbackNode ? await selectResource(fallbackNode, requestId) : false;
  }

  async function resolveLongNavigation(
    target: LongTarget,
    requestId: number
  ): Promise<ResolvedLongApprovalNavigation | undefined> {
    const summary = context.longWorkspace.activeBookSummary();
    const index = context.longWorkspace.workspaceIndex();
    if (!summary || !index || !requestIsCurrent(requestId)) return undefined;
    const resolved = await context.longWorkspace.resolveNavigation(
      target,
      summary,
      index
    );
    return requestIsCurrent(requestId) ? resolved : undefined;
  }

  async function navigateToLongInternal(
    target: LongTarget,
    requestId: number
  ): Promise<boolean> {
    if (context.longWorkspace.activeBookId() !== target.bookId) {
      if (
        !(await context.longWorkspace.saveEditorBeforeLeaving(target.bookId)) ||
        !requestIsCurrent(requestId)
      ) {
        return false;
      }
      await context.longWorkspace.openBook(target.bookId);
      if (!requestIsCurrent(requestId)) return false;
    } else if (
      !(await context.longWorkspace.saveActiveEditorChanges()) ||
      !requestIsCurrent(requestId)
    ) {
      return false;
    }
    if (context.longWorkspace.activeBookId() !== target.bookId) return false;

    let resolved = await resolveLongNavigation(target, requestId);
    if (!requestIsCurrent(requestId)) return false;
    if (!resolved || resolved.candidateIndex > 0) {
      const previousResolution = resolved;
      await context.longWorkspace.refresh(target.bookId);
      if (!requestIsCurrent(requestId)) return false;
      resolved =
        (await resolveLongNavigation(target, requestId)) ?? previousResolution;
    }
    if (!resolved || !requestIsCurrent(requestId)) return false;
    if (!(await context.longWorkspace.selectFile(resolved.selection))) {
      return false;
    }
    if (!requestIsCurrent(requestId)) return false;

    context.view.showConversation();
    context.view.expandRightPane();
    if (!requestIsCurrent(requestId)) return false;
    const index = context.longWorkspace.workspaceIndex();
    const navigationId =
      (index
        ? context.resources.preferredLongResourceId(
            target.bookId,
            index,
            resolved.selection
          )
        : undefined) ??
      context.resources.longNavigationResourceId(
        target.bookId,
        resolved.selection.key
      );
    context.resources.setSelectedResourceId(
      context.resources.node(navigationId)?.id ??
        context.resources.longBookResourceId(target.bookId)
    );
    if (!requestIsCurrent(requestId)) return false;
    await context.view.afterUpdate();
    if (!requestIsCurrent(requestId)) return false;

    const editor = context.longWorkspace.editor();
    if (resolved.focus && editor) {
      const focused = await editor.focusTarget(resolved.focus);
      if (!requestIsCurrent(requestId)) return false;
      if (!focused) {
        context.view.info("已跳转到所属条目，目标文件暂未就绪。");
      }
    }
    return requestIsCurrent(requestId);
  }

  async function navigateToTargetInternal(
    target: ApprovalNavigationTarget,
    requestId: number
  ): Promise<boolean> {
    if (target.kind === "document") {
      return await navigateToDocumentInternal(target, requestId);
    }
    if (target.kind === "library") {
      return await navigateToLibraryInternal(target, requestId);
    }
    if (target.kind === "long")
      return await navigateToLongInternal(target, requestId);
    return false;
  }

  function navigateToApprovalDocument(
    document: WorkspaceDocument
  ): Promise<boolean> {
    return schedule((requestId) =>
      navigateToApprovalDocumentInternal(document, requestId)
    );
  }

  function navigateToDocument(
    target: Extract<ApprovalNavigationTarget, { kind: "document" }>
  ): Promise<boolean> {
    return schedule((requestId) =>
      navigateToDocumentInternal(target, requestId)
    );
  }

  function navigateToLibrary(
    target: Extract<ApprovalNavigationTarget, { kind: "library" }>
  ): Promise<boolean> {
    return schedule((requestId) =>
      navigateToLibraryInternal(target, requestId)
    );
  }

  function navigateToLong(target: LongTarget): Promise<boolean> {
    return schedule((requestId) => navigateToLongInternal(target, requestId));
  }

  function navigateToTarget(
    target: ApprovalNavigationTarget
  ): Promise<boolean> {
    return schedule((requestId) => navigateToTargetInternal(target, requestId));
  }

  async function drain(): Promise<void> {
    while (activeTasks.size > 0) {
      await Promise.allSettled([...activeTasks]);
    }
    await navigationTail;
  }

  async function dispose(): Promise<void> {
    if (!disposed) {
      disposed = true;
      requestEpoch += 1;
    }
    await drain();
  }

  return {
    dispose,
    drain,
    navigateToApprovalDocument,
    navigateToDocument,
    navigateToLibrary,
    navigateToLong,
    navigateToTarget
  };
}
