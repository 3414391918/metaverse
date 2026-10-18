import type { CatalogIndexSnapshot, DeepWriteApi } from "@deepwrite/contracts";
import { ref, shallowRef, type Ref, type ShallowRef } from "vue";
import {
  resolveProjectedResourceTargetDocumentId,
  type CatalogWorkspaceProjection
} from "../data/catalogWorkspace";
import type { AgentConversationController } from "./useAgentConversation";
import type { CatalogProjectionReconcileResult } from "./useCatalogDocumentLoader";
import { longBookIdFromResourceId } from "../types/longWorkspace";
import type { EditorDraftState, WorkspaceDocument } from "../types/workspace";
import { reconcileCatalogRecoveryDrafts } from "../utils/catalogDraftRecoveryReconciliation";

type CatalogProjectionApi = Pick<DeepWriteApi["catalog"], "index">;

export interface CatalogWorkspaceProjectionIndexPort {
  snapshot: Readonly<ShallowRef<CatalogIndexSnapshot | null>>;
  projection: Readonly<ShallowRef<CatalogWorkspaceProjection | null>>;
  ensureSnapshot(
    loader: () => Promise<CatalogIndexSnapshot>
  ): Promise<CatalogWorkspaceProjection>;
}

export interface CatalogWorkspaceProjectionDocumentPort {
  values: ShallowRef<WorkspaceDocument[]>;
  reconcileProjection(
    projection: CatalogWorkspaceProjection
  ): CatalogProjectionReconcileResult;
}

export interface CatalogWorkspaceProjectionNotifications {
  error(message: string): void;
  info(message: string, options?: { duration?: number }): void;
  warning(message: string): void;
}

export interface CatalogWorkspaceProjectionScheduler {
  queueMicrotask(task: () => void): void;
}

export interface CatalogWorkspaceProjectionCoordinatorOptions {
  api(): CatalogProjectionApi | undefined;
  index: CatalogWorkspaceProjectionIndexPort;
  documents: CatalogWorkspaceProjectionDocumentPort;
  state: {
    drafts: ShallowRef<Record<string, EditorDraftState>>;
    selectedResourceId: Ref<string>;
  };
  proposals: {
    all(): readonly AgentConversationController[];
    resume(candidates: readonly AgentConversationController[]): void;
  };
  scheduler: CatalogWorkspaceProjectionScheduler;
  notifications: CatalogWorkspaceProjectionNotifications;
}

interface CatalogSnapshotPair {
  snapshot: CatalogIndexSnapshot;
  projection: CatalogWorkspaceProjection;
}

function diagnosticKey(
  diagnostic: NonNullable<CatalogIndexSnapshot["projectDiagnostics"]>[number]
): string {
  return [diagnostic.projectId, diagnostic.code, diagnostic.message].join(
    "\u0000"
  );
}

/**
 * Owns the metadata-index to editor-overlay transaction. Catalog document
 * persistence and library mutations intentionally remain outside this seam.
 */
export function useCatalogWorkspaceProjectionCoordinator(
  options: CatalogWorkspaceProjectionCoordinatorOptions
) {
  const reconciledSnapshot = shallowRef<CatalogIndexSnapshot | null>(null);
  const reconciledProjection = shallowRef<CatalogWorkspaceProjection | null>(
    null
  );
  const reconciliationVersion = ref(0);

  const seenDiagnosticKeys = new Set<string>();

  let recoveredDraftCount = 0;
  let lifecycleGeneration = 0;
  let proposalResumeGeneration = 0;
  let disposed = false;
  let activeLoad: Promise<boolean> | null = null;
  let trailingRefreshRequested = false;
  let runningTrailingRefresh = false;

  function pairIsCurrent(
    pair: CatalogSnapshotPair,
    requestLifecycleGeneration: number
  ): boolean {
    return (
      !disposed &&
      requestLifecycleGeneration === lifecycleGeneration &&
      options.index.snapshot.value === pair.snapshot &&
      options.index.projection.value === pair.projection
    );
  }

  function currentPairIsReconciled(): boolean {
    return (
      !disposed &&
      reconciledSnapshot.value !== null &&
      reconciledSnapshot.value === options.index.snapshot.value &&
      reconciledProjection.value === options.index.projection.value
    );
  }

  function publishDiagnostics(snapshot: CatalogIndexSnapshot): void {
    const diagnostics = snapshot.projectDiagnostics ?? [];
    const currentKeys = new Set(diagnostics.map(diagnosticKey));
    for (const key of seenDiagnosticKeys) {
      if (!currentKeys.has(key)) seenDiagnosticKeys.delete(key);
    }
    const unseen = diagnostics.filter((diagnostic) => {
      const key = diagnosticKey(diagnostic);
      if (seenDiagnosticKeys.has(key)) return false;
      seenDiagnosticKeys.add(key);
      return true;
    });
    const first = unseen[0];
    if (!first) return;
    options.notifications.warning(
      `项目“${first.projectId}”暂时无法读取：${first.message}${
        unseen.length > 1 ? `（另有 ${unseen.length - 1} 个项目）` : ""
      }`
    );
  }

  function selectionExists(
    projection: CatalogWorkspaceProjection,
    resourceId: string
  ): boolean {
    if (!resourceId || longBookIdFromResourceId(resourceId)) return true;
    return projection.index.workspaceDocumentById.has(
      resolveProjectedResourceTargetDocumentId(projection, resourceId)
    );
  }

  function scheduleProposalResume(pair: CatalogSnapshotPair): void {
    const generation = ++proposalResumeGeneration;
    options.scheduler.queueMicrotask(() => {
      if (
        generation !== proposalResumeGeneration ||
        !pairIsCurrent(pair, lifecycleGeneration) ||
        reconciledSnapshot.value !== pair.snapshot ||
        reconciledProjection.value !== pair.projection
      ) {
        return;
      }
      resumeRecoveredAutomaticEditsIfNeeded();
    });
  }

  function applySnapshotPair(pair: CatalogSnapshotPair): void {
    const selectedBeforeCommit = options.state.selectedResourceId.value;
    const projectedDocuments = pair.projection.index.workspaceDocumentById;
    const nextDrafts = reconcileCatalogRecoveryDrafts(
      options.state.drafts.value,
      projectedDocuments
    );

    const reconciliation = options.documents.reconcileProjection(
      pair.projection
    );
    options.state.drafts.value = nextDrafts;

    if (
      selectedBeforeCommit &&
      !selectionExists(pair.projection, selectedBeforeCommit)
    ) {
      options.state.selectedResourceId.value =
        reconciliation.documents[0]?.id ?? "";
    }

    recoveredDraftCount = Object.keys(nextDrafts).filter((documentId) =>
      projectedDocuments.has(documentId)
    ).length;
    reconciledSnapshot.value = pair.snapshot;
    reconciledProjection.value = pair.projection;
    reconciliationVersion.value += 1;
    publishDiagnostics(pair.snapshot);
    scheduleProposalResume(pair);
  }

  async function loadSnapshotOnce(
    requestLifecycleGeneration: number
  ): Promise<boolean> {
    const api = options.api();
    if (!api || disposed) return false;

    try {
      const projection = await options.index.ensureSnapshot(() => api.index());
      if (disposed || requestLifecycleGeneration !== lifecycleGeneration) {
        return false;
      }
      const snapshot = options.index.snapshot.value;
      if (!snapshot) return false;
      const pair = { snapshot, projection };
      if (!pairIsCurrent(pair, requestLifecycleGeneration)) {
        return currentPairIsReconciled();
      }

      if (
        reconciledSnapshot.value === snapshot &&
        reconciledProjection.value === projection
      )
        return true;
      applySnapshotPair(pair);
      return true;
    } catch (error: unknown) {
      if (disposed || requestLifecycleGeneration !== lifecycleGeneration) {
        return false;
      }
      options.notifications.error(
        error instanceof Error ? error.message : "加载素材库和技能库失败。"
      );
      return false;
    }
  }

  function loadSnapshot(): Promise<boolean> {
    if (disposed) return Promise.resolve(false);
    if (activeLoad) {
      if (!runningTrailingRefresh) trailingRefreshRequested = true;
      return activeLoad;
    }

    const requestLifecycleGeneration = lifecycleGeneration;
    const operation = (async () => {
      let result = await loadSnapshotOnce(requestLifecycleGeneration);
      if (
        !disposed &&
        requestLifecycleGeneration === lifecycleGeneration &&
        trailingRefreshRequested
      ) {
        trailingRefreshRequested = false;
        runningTrailingRefresh = true;
        result = await loadSnapshotOnce(requestLifecycleGeneration);
        runningTrailingRefresh = false;
      }
      return result;
    })().finally(() => {
      if (activeLoad === operation) activeLoad = null;
      trailingRefreshRequested = false;
      runningTrailingRefresh = false;
    });
    activeLoad = operation;
    return operation;
  }

  function resumeRecoveredAutomaticEditsIfNeeded(
    candidates: readonly AgentConversationController[] = options.proposals.all()
  ): void {
    if (
      !currentPairIsReconciled() ||
      !candidates.some((conversation) =>
        conversation.messages.value.some((message) =>
          message.editProposals?.some(
            (proposal) =>
              proposal.approvalMode === "auto-approve" &&
              proposal.status === "pending"
          )
        )
      )
    ) {
      return;
    }
    options.proposals.resume(candidates);
  }

  function recordRecoveredDraftCount(count: number): void {
    if (!disposed) recoveredDraftCount = Math.max(0, count);
  }

  function notifyRecoveredDrafts(): void {
    if (disposed || recoveredDraftCount <= 0) return;
    options.notifications.info(`已恢复 ${recoveredDraftCount} 份未保存草稿`, {
      duration: 1_500
    });
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    lifecycleGeneration += 1;
    proposalResumeGeneration += 1;
    trailingRefreshRequested = false;
    runningTrailingRefresh = false;
    seenDiagnosticKeys.clear();
  }

  return {
    loadSnapshot,
    notifyRecoveredDrafts,
    recordRecoveredDraftCount,
    reconciledProjection,
    reconciledSnapshot,
    reconciliationVersion,
    resumeRecoveredAutomaticEditsIfNeeded,
    dispose
  };
}

export type CatalogWorkspaceProjectionCoordinator = ReturnType<
  typeof useCatalogWorkspaceProjectionCoordinator
>;
