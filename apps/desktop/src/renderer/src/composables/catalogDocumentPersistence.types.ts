import { type CatalogLibrary, type DeepWriteApi } from "@deepwrite/contracts";
import { type ShallowRef } from "vue";
import type {
  CatalogDocumentLoadResult,
  CatalogDocumentTarget,
  CatalogDocumentsLoadResult,
  EnsureCatalogDocumentsOptions,
  InvalidateCatalogDocumentOptions
} from "./useCatalogDocumentLoader";
import type { EditorDraftState, WorkspaceDocument } from "../types/workspace";
export interface CatalogDocumentPersistenceNotifications {
  error(message: string): void;
  info(message: string): void;
  success(message: string): void;
  warning(message: string): void;
}

export interface CatalogDocumentPersistenceLoaderPort {
  preserveAuthoritativeBodyForNextProjection(
    documentId: string,
    content: string,
    expectedProjectRevision?: number
  ): void;
  ensureLoaded(
    targets?: readonly CatalogDocumentTarget[],
    options?: EnsureCatalogDocumentsOptions
  ): Promise<CatalogDocumentsLoadResult>;
  ensureOne(
    target: CatalogDocumentTarget,
    options?: EnsureCatalogDocumentsOptions
  ): Promise<CatalogDocumentLoadResult>;
  invalidate(
    target: CatalogDocumentTarget,
    options?: InvalidateCatalogDocumentOptions
  ): boolean;
}

export interface CatalogDocumentPersistenceCatalogPort {
  refreshIndex(): Promise<boolean>;
  findLibrary(
    domain: "material" | "skill",
    libraryId: string
  ): CatalogLibrary | undefined;
}

export interface CatalogDocumentPersistenceOptions {
  api(): DeepWriteApi["catalog"] | undefined;
  documents: ShallowRef<WorkspaceDocument[]>;
  drafts: ShallowRef<Record<string, EditorDraftState>>;
  loader: CatalogDocumentPersistenceLoaderPort;
  catalog: CatalogDocumentPersistenceCatalogPort;
  nextRecoveryTimestamp(): string;
  scheduleAutoSave(documentId: string): void;
  notifications: CatalogDocumentPersistenceNotifications;
}

export interface CatalogDocumentPayload {
  id: string;
  title: string;
  content: string;
}

export interface SaveConflictState {
  documentId: string;
  payload: CatalogDocumentPayload;
  diskTitle: string;
  diskContent: string;
}

export interface CatalogDocumentSaveOptions {
  force?: boolean;
  announceSuccess?: boolean;
}

export type CatalogDocumentPersistOutcome = "saved" | "retry" | "paused";
