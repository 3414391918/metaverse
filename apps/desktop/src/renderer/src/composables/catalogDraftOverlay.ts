import { createShortWorkspaceContentRevision } from "@deepwrite/contracts";
import type { EditorDraftState, WorkspaceDocument } from "../types/workspace";
import { catalogDocumentReadDescriptor } from "../utils/catalogDocumentContent";
import { normalizeFixedWorkspaceDocumentDraft } from "../utils/fixedWorkspaceDocumentTitle";
import type {
  CatalogDocumentPayload,
  CatalogDocumentPersistenceOptions
} from "./catalogDocumentPersistence.types";
export function createCatalogDraftOverlay(
  options: CatalogDocumentPersistenceOptions
) {
  const {
    documents,
    drafts: editorDrafts,
    loader,
    nextRecoveryTimestamp
  } = options;

  function applyDocumentLocally(
    payload: CatalogDocumentPayload,
    savedProjectRevision?: number,
    submittedPayload = payload
  ): void {
    const index = documents.value.findIndex(
      (document) => document.id === payload.id
    );
    if (index < 0) return;

    const current = documents.value[index]!;
    loader.invalidate(current);
    const projectDocumentIds = new Set(
      documents.value.flatMap((document) => {
        const belongsToProject = current.libraryId
          ? document.libraryId === current.libraryId &&
            document.domain === current.domain
          : document.id === current.id;
        return belongsToProject ? [document.id] : [];
      })
    );
    documents.value = documents.value.map((document) => {
      if (!projectDocumentIds.has(document.id)) return document;
      const withProjectRevision =
        savedProjectRevision === undefined
          ? document
          : { ...document, catalogProjectRevision: savedProjectRevision };
      if (document.id === payload.id) {
        if (current.catalogLibraryField === "overview") {
          return {
            ...withProjectRevision,
            content: payload.content,
            catalogContentLoaded: true
          };
        }
        const path = [...withProjectRevision.path];
        if (path.length) {
          path[path.length - 1] = payload.title;
        }
        return {
          ...withProjectRevision,
          title: payload.title,
          content: payload.content,
          catalogContentLoaded: true,
          path
        };
      }
      return withProjectRevision;
    });

    const currentDraft = editorDrafts.value[payload.id];
    const normalizedCurrentDraft = currentDraft
      ? normalizeFixedWorkspaceDocumentDraft(current, currentDraft)
      : undefined;
    const nextDrafts = { ...editorDrafts.value };
    if (savedProjectRevision !== undefined) {
      for (const documentId of projectDocumentIds) {
        const draft = nextDrafts[documentId];
        if (draft?.dirty) {
          nextDrafts[documentId] = {
            ...draft,
            recoveryUpdatedAt: nextRecoveryTimestamp(),
            baseProjectRevision: savedProjectRevision
          };
        }
      }
    }
    if (
      normalizedCurrentDraft &&
      (normalizedCurrentDraft.title !== submittedPayload.title ||
        normalizedCurrentDraft.content !== submittedPayload.content)
    ) {
      nextDrafts[payload.id] = {
        ...normalizedCurrentDraft,
        dirty: true,
        recoveryUpdatedAt: nextRecoveryTimestamp(),
        baseRevision: createShortWorkspaceContentRevision(payload.content),
        ...(savedProjectRevision === undefined
          ? {}
          : { baseProjectRevision: savedProjectRevision })
      };
    } else {
      delete nextDrafts[payload.id];
    }
    editorDrafts.value = nextDrafts;
  }

  function applyAcceptedAgentDocumentLocally(
    payload: CatalogDocumentPayload,
    savedProjectRevision: number | undefined,
    draftAtAccept: EditorDraftState | undefined
  ): void {
    const persistedDocument = documents.value.find(
      (document) => document.id === payload.id
    );
    if (persistedDocument && catalogDocumentReadDescriptor(persistedDocument)) {
      loader.preserveAuthoritativeBodyForNextProjection(
        payload.id,
        payload.content,
        savedProjectRevision
      );
    }
    const currentDraft = editorDrafts.value[payload.id];
    if (currentDraft && currentDraft === draftAtAccept) {
      editorDrafts.value = {
        ...editorDrafts.value,
        [payload.id]: {
          ...currentDraft,
          title: payload.title,
          content: payload.content
        }
      };
    }
    applyDocumentLocally(payload, savedProjectRevision);
  }

  function restoreDraftAfterSaveFailure(
    document: WorkspaceDocument,
    payload: CatalogDocumentPayload
  ): void {
    const currentDraft = editorDrafts.value[payload.id];
    const normalizedCurrentDraft = currentDraft
      ? normalizeFixedWorkspaceDocumentDraft(document, currentDraft)
      : undefined;
    const newerDraft =
      normalizedCurrentDraft &&
      (normalizedCurrentDraft.title !== payload.title ||
        normalizedCurrentDraft.content !== payload.content)
        ? normalizedCurrentDraft
        : { title: payload.title, content: payload.content };
    editorDrafts.value = {
      ...editorDrafts.value,
      [payload.id]: {
        ...newerDraft,
        dirty: true,
        recoveryUpdatedAt: nextRecoveryTimestamp(),
        baseRevision:
          currentDraft?.baseRevision ??
          createShortWorkspaceContentRevision(document.content),
        ...(currentDraft?.baseProjectRevision !== undefined
          ? { baseProjectRevision: currentDraft.baseProjectRevision }
          : document.catalogProjectRevision === undefined
            ? {}
            : { baseProjectRevision: document.catalogProjectRevision })
      }
    };
  }
  return {
    applyDocumentLocally,
    applyAcceptedAgentDocumentLocally,
    restoreDraftAfterSaveFailure
  };
}

export type CatalogDraftOverlay = ReturnType<typeof createCatalogDraftOverlay>;
