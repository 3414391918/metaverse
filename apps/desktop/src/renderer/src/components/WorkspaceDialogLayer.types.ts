import type {
  CreateLibraryEntryInput,
  CreateLibraryGroupInput,
  CreateLibraryInput,
  CreateLongBookInput,
  CatalogLibrary,
  ExternalLibrarySelectionResult,
  ExternalLibrarySourceKind,
  LinkedMaterialIdsByKind,
  LinkedSkillIdsByKind,
  LongLinkedResourceStageScopes,
  LongApplyLegacySyncResult,
  LongChooseContinuationImportSourceResult,
  LongChooseLegacySyncSourceResult,
  LongImportContinuationInput,
  LongLegacySyncModule,
  LongWorkspaceIndexSnapshot,
  LongWorkspaceOperationBatch,
  MaterialLibrary,
  MaterialLibraryGroup,
  MaterialLibraryKind,
  MaterialStageId,
  SkillLibrary,
  SkillLibraryGroup,
  UpdateLibraryGroupInput
} from "@deepwrite/contracts";
import type {
  BookTransferAction,
  BookTransferDialogMode
} from "./BookTransferDialog.vue";
import type { PopupSelectOption } from "./PopupSelect.vue";
import type {
  LongStructureMutationCompletion,
  LongWorldbuildingSyncCompletion,
  LongWorldbuildingSyncRequest
} from "../types/longWorkspace";
import type { LongWorldbuildingSyncBookOption } from "../utils/longWorldbuildingSync";
import type { LongManuscriptExportRequest } from "../utils/longManuscriptExport";

export interface DialogMutationCompletion {
  succeed(): void;
  fail(): void;
}

export type BookBindingPayload =
  | {
      bookId: string;
      domain: "skill";
      linksByKind: LinkedSkillIdsByKind;
    }
  | {
      bookId: string;
      domain: "material";
      linksByKind: LinkedMaterialIdsByKind;
    };

export type CreateCreativeBookPayload = CreateLongBookInput;

export type LibraryDomain = "material" | "skill";
export type LibraryProjectOperation =
  | "create-library"
  | "create-entry"
  | "rename-library"
  | "rename-entry"
  | "remove-entry";
export type CreateLibraryEntryDraft =
  | Omit<Extract<CreateLibraryEntryInput, { domain: "material" }>, "content">
  | Omit<Extract<CreateLibraryEntryInput, { domain: "skill" }>, "content">;

export interface ExportLongDialogModule {
  kind: "export-long";
  bookTitle: string;
  bookId: string;
  submitting: boolean;
}

export interface LibraryRemovalDialogModule {
  kind: "library-removal";
  action: "remove" | "delete";
  domain: LibraryDomain;
  label: string;
  submitting: boolean;
}

export interface CreateBookDialogModule {
  kind: "create-book";
  materials: readonly MaterialLibrary[];
  materialGroups: readonly MaterialLibraryGroup[];
  skills: readonly SkillLibrary[];
  skillGroups: readonly SkillLibraryGroup[];
  loading: boolean;
  submitting: boolean;
}

export interface BookTransferDialogModule {
  kind: "book-transfer";
  mode: BookTransferDialogMode;
  pending: boolean;
}

export interface ContinuationImportDialogModule {
  kind: "continuation-import";
  preview: LongChooseContinuationImportSourceResult;
  submitting: boolean;
}

export interface LegacySyncDialogModule {
  kind: "legacy-sync";
  preview: LongChooseLegacySyncSourceResult | null;
  result: LongApplyLegacySyncResult | null;
  pending: boolean;
}

export interface LongStructureDialogModule {
  kind: "long-structure";
  bookTitle: string;
  bookId: string | null;
  agentsMd: string | null;
  agentsMdPending: boolean;
  syncBookOptions: readonly LongWorldbuildingSyncBookOption[];
  snapshot: LongWorkspaceIndexSnapshot | null;
  pending: boolean;
}

export interface CreateLongCharacterDialogModule {
  kind: "create-long-character";
  groupLabel: string;
  pending: boolean;
}

export interface CreateLongWorldbuildingItemDialogModule {
  kind: "create-long-worldbuilding-item";
  categoryTitle: string;
  pending: boolean;
}

export interface CreateLongPlotPointDialogModule {
  kind: "create-long-plot-point";
  volumeTitle: string;
  pending: boolean;
}

export interface CreateLongChapterCardDialogModule {
  kind: "create-long-chapter-card";
  volumeTitle: string;
  arcOptions: readonly PopupSelectOption[];
  source: "chapter-card" | "draft";
  pending: boolean;
}

export interface DeleteLongDraftDialogModule {
  kind: "delete-long-draft";
  sectionTitle: string;
  description: string;
  pending: boolean;
}

export interface DeleteLongTreeDialogModule {
  kind: "delete-long-tree";
  sectionTitle: string;
  itemLabel: string;
  description: string;
  pending: boolean;
}

export interface DeleteLongLedgerCommitDialogModule {
  kind: "delete-long-ledger-commit";
  title: string;
  chapterCount: number;
  pending: boolean;
}

export interface CreateLongVolumeDialogModule {
  kind: "create-long-volume";
  source: "book-line" | "draft";
  pending: boolean;
}

export interface LongBindingsDialogModule {
  kind: "long-bindings";
  mode: "skill" | "material";
  bookTitle: string;
  materials: readonly MaterialLibrary[];
  skills: readonly SkillLibrary[];
  linkedMaterialIdsByKind: LinkedMaterialIdsByKind;
  linkedSkillIdsByKind: LinkedSkillIdsByKind;
  linkedResourceStageScopes: LongLinkedResourceStageScopes;
  submitting: boolean;
}

export interface LongRenameDialogModule {
  kind: "long-rename";
  title: string;
  pending: boolean;
}

export interface LongRemovalDialogModule {
  kind: "long-removal";
  action: "unregister" | "delete";
  title: string;
  pending: boolean;
}

export interface LibraryProjectDialogModule {
  kind: "library-project";
  operation: LibraryProjectOperation;
  domain: LibraryDomain;
  libraryId?: string;
  libraryTitle?: string;
  materialKind?: MaterialLibraryKind;
  entryId?: string;
  entryTitle?: string;
  workspaceType?: "short" | "script" | "long";
  submitting: boolean;
}

export interface ExternalLibraryImportDialogModule {
  kind: "external-library-import";
  domain: LibraryDomain;
  libraries: readonly CatalogLibrary[];
  preselectedLibraryId?: string;
  selection?: ExternalLibrarySelectionResult;
  pending: boolean;
}

export interface LibraryEntryMoveDialogModule {
  kind: "library-entry-move";
  entryTitle: string;
  targetLibraryTitle: string;
  options: readonly { value: MaterialStageId; label: string }[];
  initialStageId: MaterialStageId;
  submitting: boolean;
}

export interface LibraryGroupDialogModule {
  kind: "library-group";
  domain: LibraryDomain;
  group: MaterialLibraryGroup | SkillLibraryGroup | null;
  materials: readonly MaterialLibrary[];
  materialGroups: readonly MaterialLibraryGroup[];
  skills: readonly SkillLibrary[];
  skillGroups: readonly SkillLibraryGroup[];
  submitting: boolean;
}

export interface SaveConflictDialogModule {
  kind: "save-conflict";
  title: string;
  draftContent: string;
  diskContent: string;
  submitting: boolean;
}

export interface StartupAlertDialogModule {
  kind: "startup-alert";
  messages: readonly string[];
}

export type WorkspaceDialogModule =
  | ExportLongDialogModule
  | LibraryRemovalDialogModule
  | CreateBookDialogModule
  | BookTransferDialogModule
  | ContinuationImportDialogModule
  | LegacySyncDialogModule
  | LongStructureDialogModule
  | CreateLongCharacterDialogModule
  | CreateLongWorldbuildingItemDialogModule
  | CreateLongPlotPointDialogModule
  | CreateLongChapterCardDialogModule
  | DeleteLongDraftDialogModule
  | DeleteLongTreeDialogModule
  | DeleteLongLedgerCommitDialogModule
  | CreateLongVolumeDialogModule
  | LongBindingsDialogModule
  | LongRenameDialogModule
  | LongRemovalDialogModule
  | LibraryProjectDialogModule
  | ExternalLibraryImportDialogModule
  | LibraryEntryMoveDialogModule
  | LibraryGroupDialogModule
  | SaveConflictDialogModule
  | StartupAlertDialogModule;

export type WorkspaceDialogKind = WorkspaceDialogModule["kind"];

export const WORKSPACE_DIALOG_KINDS = [
  "export-long",
  "library-removal",
  "create-book",
  "book-transfer",
  "continuation-import",
  "legacy-sync",
  "long-structure",
  "create-long-character",
  "create-long-worldbuilding-item",
  "create-long-plot-point",
  "create-long-chapter-card",
  "delete-long-draft",
  "delete-long-tree",
  "delete-long-ledger-commit",
  "create-long-volume",
  "long-bindings",
  "long-rename",
  "long-removal",
  "library-project",
  "external-library-import",
  "library-entry-move",
  "library-group",
  "save-conflict",
  "startup-alert"
] as const satisfies readonly WorkspaceDialogKind[];

export interface WorkspaceDialogLayerEmits {
  closeExportLong: [];
  exportLong: [request: LongManuscriptExportRequest];
  closeLibraryRemoval: [];
  confirmLibraryRemoval: [];
  closeCreateBook: [];
  submitCreateBook: [payload: CreateCreativeBookPayload];
  closeBookTransfer: [];
  selectBookTransfer: [action: BookTransferAction];
  closeContinuationImport: [];
  confirmContinuationImport: [input: LongImportContinuationInput];
  closeLegacySync: [];
  confirmLegacySync: [modules: LongLegacySyncModule[]];
  closeLongStructure: [];
  longStructureMutation: [
    batch: LongWorkspaceOperationBatch,
    completion: LongStructureMutationCompletion
  ];
  saveLongAgentsMd: [
    content: string,
    completion: LongStructureMutationCompletion
  ];
  syncLongWorldbuilding: [
    payload: LongWorldbuildingSyncRequest,
    completion: LongWorldbuildingSyncCompletion
  ];
  closeCreateLongCharacter: [];
  submitCreateLongCharacter: [input: { name: string; aliases: string[] }];
  closeCreateLongWorldbuildingItem: [];
  submitCreateLongWorldbuildingItem: [input: { title: string }];
  closeCreateLongPlotPoint: [];
  submitCreateLongPlotPoint: [input: { title: string; summary: string }];
  closeCreateLongChapterCard: [];
  submitCreateLongChapterCard: [
    input: {
      title: string;
      primaryArcId: string | null;
    }
  ];
  closeDeleteLongDraft: [];
  confirmDeleteLongDraft: [];
  closeDeleteLongTree: [];
  confirmDeleteLongTree: [];
  closeDeleteLongLedgerCommit: [];
  confirmDeleteLongLedgerCommit: [];
  closeCreateLongVolume: [];
  submitCreateLongVolume: [input: { title: string; summary: string }];
  closeLongBindings: [];
  submitLongBindings: [
    payload: {
      linkedMaterialIdsByKind: LinkedMaterialIdsByKind;
      linkedSkillIdsByKind: LinkedSkillIdsByKind;
      linkedResourceStageScopes: LongLinkedResourceStageScopes;
    }
  ];
  closeLongRename: [];
  submitLongRename: [title: string];
  closeLongRemoval: [];
  confirmLongRemoval: [];
  closeLibraryProject: [];
  createLibrary: [payload: CreateLibraryInput];
  createLibraryEntry: [payload: CreateLibraryEntryDraft];
  renameLibrary: [
    payload: {
      domain: LibraryDomain;
      libraryId: string;
      title: string;
    }
  ];
  renameLibraryEntry: [
    payload: {
      domain: LibraryDomain;
      libraryId: string;
      entryId: string;
      title: string;
    }
  ];
  removeLibraryEntry: [
    payload: {
      domain: LibraryDomain;
      libraryId: string;
      entryId: string;
    }
  ];
  closeExternalLibraryImport: [];
  chooseExternalLibraryImport: [sourceKind: ExternalLibrarySourceKind];
  submitExternalLibraryImport: [
    payload: { libraryId: string; candidateIds: string[] }
  ];
  closeLibraryEntryMove: [];
  submitLibraryEntryMove: [stageId: MaterialStageId];
  closeLibraryGroup: [];
  submitLibraryGroup: [
    payload: CreateLibraryGroupInput | UpdateLibraryGroupInput
  ];
  keepSaveConflict: [];
  reloadSaveConflict: [];
  overwriteSaveConflict: [];
  closeStartupAlert: [];
}
