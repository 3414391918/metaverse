import {
  createShortWorkspaceContentRevision,
  type CatalogLibrary,
  type CatalogLibraryEntry
} from "@deepwrite/contracts";
import { type Ref } from "vue";
import type { WorkspaceDocument } from "../types/workspace";
import type {
  CatalogDocumentPayload,
  CatalogDocumentPersistenceOptions,
  CatalogDocumentSaveOptions
} from "./catalogDocumentPersistence.types";
import type { CatalogDraftOverlay } from "./catalogDraftOverlay";
export function createCatalogLibraryPersistence(
  options: CatalogDocumentPersistenceOptions,
  overlay: CatalogDraftOverlay,
  conflicts: {
    isCatalogConflict(error: unknown): boolean;
    openSaveConflict(
      document: WorkspaceDocument,
      payload: CatalogDocumentPayload
    ): Promise<void>;
  },
  savingDocumentIds: Ref<Set<string>>,
  setDocumentSaving: (id: string, saving: boolean) => void
) {
  const { applyDocumentLocally, restoreDraftAfterSaveFailure } = overlay;
  const { isCatalogConflict, openSaveConflict } = conflicts;
  const api = options.api;
  const {
    documents,
    drafts: editorDrafts,
    loader,
    catalog,
    notifications: uiMessage
  } = options;

  async function refreshCatalogAfterLibraryMutation(
    domain: "material" | "skill",
    libraryId: string,
    expectedProjectRevision: number | undefined,
    expectedEntryId?: string
  ): Promise<boolean> {
    const loaded = await catalog.refreshIndex();
    const library = catalog.findLibrary(domain, libraryId);
    const revisionMatches =
      expectedProjectRevision === undefined ||
      (library?.projectRevision !== undefined &&
        library.projectRevision >= expectedProjectRevision);
    const entryMatches =
      expectedEntryId === undefined ||
      library?.entries.some((entry) => entry.id === expectedEntryId) === true;
    if (loaded && library && revisionMatches && entryMatches) return true;
    uiMessage.warning(
      "资料库修改已写入磁盘，但最新目录暂未同步；窗口重新聚焦后会自动重试"
    );
    return false;
  }

  async function applySavedLibraryEntry(
    domain: "material" | "skill",
    libraryId: string,
    saved: CatalogLibraryEntry,
    projectRevision: number | undefined
  ): Promise<number | undefined> {
    const savedDocument = documents.value.find(
      (document) =>
        document.domain === domain &&
        document.libraryId === libraryId &&
        document.catalogEntryId === saved.id
    );
    if (savedDocument) {
      loader.preserveAuthoritativeBodyForNextProjection(
        savedDocument.id,
        saved.body,
        projectRevision
      );
    }
    const synchronized = await refreshCatalogAfterLibraryMutation(
      domain,
      libraryId,
      projectRevision,
      saved.id
    );
    const currentProjectRevision = catalog.findLibrary(
      domain,
      libraryId
    )?.projectRevision;
    if (synchronized) return currentProjectRevision;
    if (currentProjectRevision === undefined) return projectRevision;
    if (projectRevision === undefined) return currentProjectRevision;
    return Math.max(currentProjectRevision, projectRevision);
  }

  async function applyUpdatedCatalogLibrary(
    domain: "material" | "skill",
    updated: CatalogLibrary
  ): Promise<void> {
    const overviewDocument = documents.value.find(
      (document) =>
        document.domain === domain &&
        document.libraryId === updated.id &&
        document.catalogLibraryField === "overview"
    );
    if (overviewDocument) {
      loader.preserveAuthoritativeBodyForNextProjection(
        overviewDocument.id,
        updated.overview,
        updated.projectRevision
      );
    }
    await refreshCatalogAfterLibraryMutation(
      domain,
      updated.id,
      updated.projectRevision
    );
  }

  async function applyCreatedLibraryEntry(
    domain: "material" | "skill",
    libraryId: string,
    created: CatalogLibraryEntry,
    projectRevision: number | undefined
  ): Promise<void> {
    if (
      !(await refreshCatalogAfterLibraryMutation(
        domain,
        libraryId,
        projectRevision,
        created.id
      ))
    ) {
      return;
    }
    const createdDocument = documents.value.find(
      (document) =>
        document.domain === domain &&
        document.libraryId === libraryId &&
        document.catalogEntryId === created.id
    );
    if (!createdDocument) {
      uiMessage.warning(
        "资料条目已创建，但目录定位暂未同步；窗口重新聚焦后会自动重试"
      );
      return;
    }
    applyDocumentLocally(
      {
        id: createdDocument.id,
        title: created.title,
        content: created.body
      },
      projectRevision
    );
  }

  async function saveCatalogLibraryEntry(
    document: WorkspaceDocument,
    payload: CatalogDocumentPayload,
    saveOptions: CatalogDocumentSaveOptions = {}
  ): Promise<boolean> {
    const currentApi = api();
    const force = saveOptions.force ?? false;
    if (
      !currentApi ||
      !document.libraryId ||
      !document.catalogEntryId ||
      (document.domain !== "material" && document.domain !== "skill") ||
      savingDocumentIds.value.has(payload.id)
    ) {
      return false;
    }
    setDocumentSaving(payload.id, true);
    try {
      const projectRevision = force
        ? document.catalogProjectRevision
        : (editorDrafts.value[payload.id]?.baseProjectRevision ??
          document.catalogProjectRevision);
      const saved = await currentApi.saveLibraryEntry({
        domain: document.domain,
        libraryId: document.libraryId,
        entryId: document.catalogEntryId,
        title: payload.title,
        content: payload.content,
        baseRevision:
          editorDrafts.value[payload.id]?.baseRevision ??
          createShortWorkspaceContentRevision(document.content),
        ...(projectRevision === undefined
          ? {}
          : { baseProjectRevision: projectRevision }),
        ...(force ? { force: true } : {})
      });
      const savedProjectRevision =
        projectRevision === undefined ? undefined : projectRevision + 1;
      const synchronizedProjectRevision = await applySavedLibraryEntry(
        document.domain,
        document.libraryId,
        saved,
        savedProjectRevision
      );
      applyDocumentLocally(
        { id: payload.id, title: saved.title, content: saved.body },
        synchronizedProjectRevision,
        payload
      );
      if (saveOptions.announceSuccess !== false) {
        uiMessage.success(
          `${document.domain === "material" ? "素材" : "技能"}内容已保存到本机文件夹`
        );
      }
      return true;
    } catch (error: unknown) {
      restoreDraftAfterSaveFailure(document, payload);
      if (isCatalogConflict(error)) await openSaveConflict(document, payload);
      else {
        uiMessage.error(
          error instanceof Error ? error.message : "保存资料库内容失败。"
        );
      }
      return false;
    } finally {
      setDocumentSaving(payload.id, false);
    }
  }

  async function saveCatalogLibraryOverview(
    document: WorkspaceDocument,
    payload: CatalogDocumentPayload,
    saveOptions: CatalogDocumentSaveOptions = {}
  ): Promise<boolean> {
    const currentApi = api();
    const force = saveOptions.force ?? false;
    if (
      !currentApi ||
      !document.libraryId ||
      document.catalogLibraryField !== "overview" ||
      (document.domain !== "material" && document.domain !== "skill") ||
      savingDocumentIds.value.has(payload.id)
    ) {
      return false;
    }
    setDocumentSaving(payload.id, true);
    try {
      const projectRevision = force
        ? document.catalogProjectRevision
        : (editorDrafts.value[payload.id]?.baseProjectRevision ??
          document.catalogProjectRevision);
      const updated = await currentApi.updateLibrary({
        domain: document.domain,
        libraryId: document.libraryId,
        overview: payload.content,
        ...(projectRevision === undefined
          ? {}
          : { baseProjectRevision: projectRevision }),
        ...(force ? { force: true } : {})
      });
      await applyUpdatedCatalogLibrary(document.domain, updated);
      applyDocumentLocally(
        {
          id: payload.id,
          title: document.title,
          content: updated.overview
        },
        updated.projectRevision,
        payload
      );
      if (saveOptions.announceSuccess !== false) {
        uiMessage.success("资料库介绍已保存到本机文件夹");
      }
      return true;
    } catch (error: unknown) {
      restoreDraftAfterSaveFailure(document, payload);
      if (isCatalogConflict(error)) await openSaveConflict(document, payload);
      else {
        uiMessage.error(
          error instanceof Error ? error.message : "保存资料库介绍失败。"
        );
      }
      return false;
    } finally {
      setDocumentSaving(payload.id, false);
    }
  }
  return {
    refreshCatalogAfterLibraryMutation,
    applySavedLibraryEntry,
    applyUpdatedCatalogLibrary,
    applyCreatedLibraryEntry,
    saveCatalogLibraryEntry,
    saveCatalogLibraryOverview
  };
}
