import { createShortWorkspaceContentRevision } from "@deepwrite/contracts";
import { ref } from "vue";
import type { WorkspaceDocument } from "../types/workspace";
import type {
  CatalogDocumentPayload,
  CatalogDocumentPersistenceOptions,
  SaveConflictState
} from "./catalogDocumentPersistence.types";
export function createCatalogSaveConflicts(
  options: CatalogDocumentPersistenceOptions,
  save: (
    document: WorkspaceDocument,
    payload: CatalogDocumentPayload
  ) => Promise<boolean>
) {
  const api = options.api;
  const saveConflict = ref<SaveConflictState | null>(null);
  const saveConflictSubmitting = ref(false);
  const {
    drafts: editorDrafts,
    loader,
    catalog,
    nextRecoveryTimestamp,
    scheduleAutoSave,
    notifications: uiMessage
  } = options;

  function scheduleDirtyAutoSaves(excludedDocumentId?: string): void {
    for (const [documentId, draft] of Object.entries(editorDrafts.value)) {
      if (draft.dirty && documentId !== excludedDocumentId) {
        scheduleAutoSave(documentId);
      }
    }
  }

  function isCatalogConflict(error: unknown): boolean {
    return (
      error instanceof Error && error.message.startsWith("catalog.conflict:")
    );
  }

  async function readLatestCatalogDocument(
    documentId: string
  ): Promise<WorkspaceDocument> {
    if (!api()) throw new Error("桌面文件服务当前不可用。");
    if (!(await catalog.refreshIndex())) {
      throw new Error("无法刷新目录索引，当前草稿仍保留在恢复区");
    }
    const result = await loader.ensureOne(documentId, { refresh: true });
    const document = result.document;
    if (result.ok && document && document.catalogContentLoaded !== false) {
      return document;
    }
    const failure = result.failures[0];
    if (failure?.error instanceof Error) throw failure.error;
    if (failure?.code === "reader-unavailable") {
      throw new Error("桌面文件服务当前不可用。");
    }
    if (failure?.code === "stale-descriptor") {
      throw new Error("磁盘版本在读取期间再次变化，请重试。");
    }
    if (failure?.code === "invalid-result") {
      throw new Error("磁盘版本返回了无效内容，当前草稿仍保留在恢复区");
    }
    throw new Error("磁盘版本已不存在，当前草稿仍保留在恢复区");
  }

  async function openSaveConflict(
    document: WorkspaceDocument,
    payload: CatalogDocumentPayload
  ): Promise<void> {
    if (!api()) return;
    try {
      const diskDocument = await readLatestCatalogDocument(document.id);
      const diskTitle = diskDocument.title;
      const diskContent = diskDocument.content;
      if (diskTitle === payload.title && diskContent === payload.content) {
        const nextDrafts = { ...editorDrafts.value };
        const currentDraft = nextDrafts[payload.id];
        const hasNewerDraft = Boolean(
          currentDraft &&
          (currentDraft.title !== payload.title ||
            currentDraft.content !== payload.content)
        );
        if (currentDraft && hasNewerDraft) {
          nextDrafts[payload.id] = {
            ...currentDraft,
            dirty: true,
            recoveryUpdatedAt: nextRecoveryTimestamp(),
            baseRevision: createShortWorkspaceContentRevision(diskContent),
            ...(diskDocument.catalogProjectRevision === undefined
              ? {}
              : {
                  baseProjectRevision: diskDocument.catalogProjectRevision
                })
          };
        } else {
          delete nextDrafts[payload.id];
        }
        editorDrafts.value = nextDrafts;
        uiMessage.info(
          hasNewerDraft
            ? "磁盘已包含较早修改；你随后输入的新草稿仍保留"
            : "磁盘版本已经包含当前修改，无需重复保存"
        );
        // The failed save returns `false`, so the outer auto-save runner cannot
        // infer that a newer draft survived this conflict-equivalent outcome.
        // Explicitly restore liveness for B after the disk was found to contain A.
        if (hasNewerDraft) scheduleAutoSave(payload.id);
        return;
      }
      saveConflict.value = {
        documentId: payload.id,
        payload,
        diskTitle,
        diskContent
      };
    } catch (snapshotError: unknown) {
      uiMessage.error(
        snapshotError instanceof Error
          ? snapshotError.message
          : "读取磁盘冲突版本失败，当前草稿仍保留"
      );
    }
  }

  function keepSaveConflictDraft(): void {
    const conflictDocumentId = saveConflict.value?.documentId;
    saveConflict.value = null;
    scheduleDirtyAutoSaves(conflictDocumentId);
  }

  async function reloadSaveConflictFromDisk(): Promise<void> {
    const conflict = saveConflict.value;
    if (!conflict || saveConflictSubmitting.value) return;
    const draftAtReload = editorDrafts.value[conflict.documentId];
    saveConflictSubmitting.value = true;
    try {
      await readLatestCatalogDocument(conflict.documentId);
      if (saveConflict.value !== conflict) return;
      if (editorDrafts.value[conflict.documentId] !== draftAtReload) {
        saveConflict.value = null;
        uiMessage.info("读取期间检测到新的编辑，已保留当前草稿");
        scheduleDirtyAutoSaves();
        return;
      }
      const nextDrafts = { ...editorDrafts.value };
      delete nextDrafts[conflict.documentId];
      editorDrafts.value = nextDrafts;
      saveConflict.value = null;
      uiMessage.success("已重新加载磁盘版本");
      scheduleDirtyAutoSaves();
    } catch (error: unknown) {
      uiMessage.error(
        error instanceof Error ? error.message : "重新加载磁盘版本失败"
      );
    } finally {
      saveConflictSubmitting.value = false;
    }
  }

  async function overwriteSaveConflictOnDisk(): Promise<void> {
    const conflict = saveConflict.value;
    if (!conflict || saveConflictSubmitting.value) return;
    saveConflictSubmitting.value = true;
    try {
      const document = await readLatestCatalogDocument(conflict.documentId);
      if (saveConflict.value !== conflict) return;
      const saved = await save(document, conflict.payload);
      if (saved) {
        saveConflict.value = null;
        scheduleDirtyAutoSaves();
      }
    } catch (error: unknown) {
      uiMessage.error(
        error instanceof Error ? error.message : "覆盖磁盘版本失败"
      );
    } finally {
      saveConflictSubmitting.value = false;
    }
  }
  return {
    scheduleDirtyAutoSaves,
    isCatalogConflict,
    readLatestCatalogDocument,
    openSaveConflict,
    keepSaveConflictDraft,
    reloadSaveConflictFromDisk,
    overwriteSaveConflictOnDisk,
    saveConflict,
    saveConflictSubmitting
  };
}
