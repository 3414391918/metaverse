import { createCatalogDraftOverlay } from "./catalogDraftOverlay";
import { createCatalogLibraryPersistence } from "./catalogLibraryPersistence";
import { createCatalogSaveConflicts } from "./catalogSaveConflicts";
import type {
  CatalogDocumentPayload,
  CatalogDocumentPersistenceOptions,
  CatalogDocumentPersistOutcome
} from "./catalogDocumentPersistence.types";
export type * from "./catalogDocumentPersistence.types";
import {
  type CatalogLibrary,
  type CatalogLibraryEntry
} from "@deepwrite/contracts";
import { ref } from "vue";
import { resolveWorkspaceDocumentTitle } from "../utils/fixedWorkspaceDocumentTitle";

/**
 * Owns durable catalog writes and the draft transitions around them. Timers,
 * editor input staging, and proposal write barriers remain outside this
 * boundary so the Shell can coordinate those independent concerns explicitly.
 */
export function useCatalogDocumentPersistence(
  options: CatalogDocumentPersistenceOptions
) {
  const { documents, notifications: uiMessage } = options;
  const savingDocumentIds = ref<Set<string>>(new Set());
  const activeOperations = new Set<Promise<unknown>>();
  let disposed = false;
  const overlay = createCatalogDraftOverlay(options);
  const { applyDocumentLocally, applyAcceptedAgentDocumentLocally } = overlay;
  const conflicts = createCatalogSaveConflicts(options, (document, payload) =>
    document.catalogLibraryField === "overview"
      ? library.saveCatalogLibraryOverview(document, payload, { force: true })
      : library.saveCatalogLibraryEntry(document, payload, { force: true })
  );
  const {
    saveConflict,
    saveConflictSubmitting,
    keepSaveConflictDraft,
    reloadSaveConflictFromDisk,
    overwriteSaveConflictOnDisk,
    isCatalogConflict
  } = conflicts;
  const library = createCatalogLibraryPersistence(
    options,
    overlay,
    conflicts,
    savingDocumentIds,
    setDocumentSaving
  );
  const {
    applySavedLibraryEntry,
    applyUpdatedCatalogLibrary,
    applyCreatedLibraryEntry,
    saveCatalogLibraryEntry,
    saveCatalogLibraryOverview
  } = library;

  function trackOperation<Value>(
    start: () => Promise<Value>,
    disposedValue: Value
  ): Promise<Value> {
    if (disposed) return Promise.resolve(disposedValue);
    let operation: Promise<Value>;
    try {
      operation = start();
    } catch (error: unknown) {
      operation = Promise.reject(error);
    }
    activeOperations.add(operation);
    void operation.then(
      () => activeOperations.delete(operation),
      () => activeOperations.delete(operation)
    );
    return operation;
  }

  async function drain(): Promise<void> {
    while (activeOperations.size > 0) {
      await Promise.allSettled([...activeOperations]);
    }
  }

  async function dispose(): Promise<void> {
    disposed = true;
    await drain();
  }

  function setDocumentSaving(documentId: string, saving: boolean): void {
    const next = new Set(savingDocumentIds.value);
    if (saving) next.add(documentId);
    else next.delete(documentId);
    savingDocumentIds.value = next;
  }

  async function persistEditorDocumentWithOutcome(
    payload: CatalogDocumentPayload,
    announceSuccess: boolean
  ): Promise<CatalogDocumentPersistOutcome> {
    if (saveConflict.value) {
      if (announceSuccess) {
        uiMessage.info("请先处理当前保存冲突，再保存其他文稿");
      }
      return "paused";
    }
    const document = documents.value.find(
      (candidate) => candidate.id === payload.id
    );
    if (!document) return "paused";
    const normalizedPayload = {
      ...payload,
      title: resolveWorkspaceDocumentTitle(document, payload.title)
    };
    if (!normalizedPayload.title.trim()) {
      if (announceSuccess) {
        uiMessage.warning("请输入文档标题后再保存");
      }
      return "paused";
    }
    if (
      document.catalogLibraryField === "overview" &&
      document.libraryId &&
      (document.domain === "material" || document.domain === "skill")
    ) {
      const saved = await saveCatalogLibraryOverview(
        document,
        normalizedPayload,
        { announceSuccess }
      );
      return saved ? "saved" : saveConflict.value ? "paused" : "retry";
    }
    if (
      document.catalogEntryId &&
      document.libraryId &&
      (document.domain === "material" || document.domain === "skill")
    ) {
      const saved = await saveCatalogLibraryEntry(document, normalizedPayload, {
        announceSuccess
      });
      return saved ? "saved" : saveConflict.value ? "paused" : "retry";
    }
    applyDocumentLocally(normalizedPayload);
    return "saved";
  }

  async function persistEditorDocument(
    payload: CatalogDocumentPayload,
    announceSuccess: boolean
  ): Promise<boolean> {
    return (
      (await persistEditorDocumentWithOutcome(payload, announceSuccess)) ===
      "saved"
    );
  }

  return {
    savingDocumentIds,
    saveConflict,
    saveConflictSubmitting,
    applyDocumentLocally,
    applyAcceptedAgentDocumentLocally,
    applySavedLibraryEntry: (
      domain: "material" | "skill",
      libraryId: string,
      saved: CatalogLibraryEntry,
      projectRevision: number | undefined
    ) =>
      trackOperation(
        () => applySavedLibraryEntry(domain, libraryId, saved, projectRevision),
        undefined
      ),
    applyUpdatedCatalogLibrary: (
      domain: "material" | "skill",
      updated: CatalogLibrary
    ) =>
      trackOperation(
        () => applyUpdatedCatalogLibrary(domain, updated),
        undefined
      ),
    applyCreatedLibraryEntry: (
      domain: "material" | "skill",
      libraryId: string,
      created: CatalogLibraryEntry,
      projectRevision: number | undefined
    ) =>
      trackOperation(
        () =>
          applyCreatedLibraryEntry(domain, libraryId, created, projectRevision),
        undefined
      ),
    isCatalogConflict,
    persistEditorDocument: (
      payload: CatalogDocumentPayload,
      announceSuccess: boolean
    ) =>
      trackOperation(
        () => persistEditorDocument(payload, announceSuccess),
        false
      ),
    persistEditorDocumentWithOutcome: (
      payload: CatalogDocumentPayload,
      announceSuccess: boolean
    ) =>
      trackOperation(
        () => persistEditorDocumentWithOutcome(payload, announceSuccess),
        "paused" as const
      ),
    keepSaveConflictDraft,
    reloadSaveConflictFromDisk: () =>
      trackOperation(reloadSaveConflictFromDisk, undefined),
    overwriteSaveConflictOnDisk: () =>
      trackOperation(overwriteSaveConflictOnDisk, undefined),
    drain,
    dispose
  };
}
