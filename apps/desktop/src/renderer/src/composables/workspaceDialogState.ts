import type {
  CatalogIndexSnapshot,
  LongBookSummary,
  LongWorkspaceIndexSnapshot
} from "@deepwrite/contracts";
import { type Ref } from "vue";
import type {
  WorkspaceDialogKind,
  WorkspaceDialogModule
} from "../components/WorkspaceDialogLayer.types";
import type { LongWorldbuildingSyncBookOption } from "../utils/longWorldbuildingSync";
import type {
  LibraryGroupDialogState,
  LibraryProjectDialogState,
  LibraryRemovalDialogState,
  PendingLibraryEntryMove
} from "./useCatalogLibraryTransactionsCoordinator";
import type { ExternalLibraryImportDialogState } from "./useExternalLibraryImportCoordinator";
import type { SaveConflictState } from "./useCatalogDocumentPersistence";
import type {
  LongBookRemovalTarget,
  LongBookRenameTarget,
  LongChapterCardCreateTarget,
  LongCharacterCreateTarget,
  LongDraftSectionDeleteTarget,
  LongLedgerCommitDeleteTarget,
  LongPlotPointCreateTarget,
  LongTreeItemDeleteTarget,
  LongVolumeCreateTarget,
  LongWorldbuildingItemCreateTarget
} from "../stores/longWorkspaceStore";
export type DialogModule<Kind extends WorkspaceDialogKind> = Extract<
  WorkspaceDialogModule,
  { kind: Kind }
>;
export interface WorkspaceDialogStartupState {
  messages: Readonly<Ref<readonly string[]>>;
}
export interface WorkspaceDialogSaveState {
  conflict: Readonly<Ref<SaveConflictState | null>>;
  submitting: Readonly<Ref<boolean>>;
}
export interface WorkspaceDialogLongStructureState {
  characterCreation: Readonly<Ref<LongCharacterCreateTarget | null>>;
  worldbuildingItemCreation: Readonly<
    Ref<LongWorldbuildingItemCreateTarget | null>
  >;
  plotPointCreation: Readonly<Ref<LongPlotPointCreateTarget | null>>;
  chapterCardCreation: Readonly<Ref<LongChapterCardCreateTarget | null>>;
  draftDeletion: Readonly<Ref<LongDraftSectionDeleteTarget | null>>;
  treeDeletion: Readonly<Ref<LongTreeItemDeleteTarget | null>>;
  ledgerCommitDeletion: Readonly<Ref<LongLedgerCommitDeleteTarget | null>>;
  volumeCreation: Readonly<Ref<LongVolumeCreateTarget | null>>;
  dialogOpen: Readonly<Ref<boolean>>;
  agentsMd: Readonly<Ref<string | null>>;
  agentsMdPending: Readonly<Ref<boolean>>;
  syncBookOptions: Readonly<Ref<readonly LongWorldbuildingSyncBookOption[]>>;
}
export interface WorkspaceDialogLongLifecycleState {
  continuationPreview: Readonly<
    Ref<DialogModule<"continuation-import">["preview"] | null>
  >;
  legacyPreview: Readonly<Ref<DialogModule<"legacy-sync">["preview"]>>;
  legacyResult: Readonly<Ref<DialogModule<"legacy-sync">["result"]>>;
  mutationPending: Readonly<Ref<boolean>>;
  activeBookSummary: Readonly<Ref<LongBookSummary | null>>;
  activeBookId: Readonly<Ref<string | null>>;
  workspaceIndex: Readonly<Ref<LongWorkspaceIndexSnapshot | null>>;
  bindingsMode: Readonly<Ref<"skill" | "material" | null>>;
  bookActionPending: Readonly<Ref<boolean>>;
  renameTarget: Readonly<Ref<LongBookRenameTarget | null>>;
  removalTarget: Readonly<Ref<LongBookRemovalTarget | null>>;
  exportTarget: Readonly<Ref<LongBookRenameTarget | null>>;
  manuscriptExportPending: Readonly<Ref<boolean>>;
}
export interface WorkspaceDialogLibraryState {
  removalDialog: Readonly<Ref<LibraryRemovalDialogState | null>>;
  projectDialog: Readonly<Ref<LibraryProjectDialogState | null>>;
  externalLibraryImportDialog: Readonly<
    Ref<ExternalLibraryImportDialogState | null>
  >;
  entryMove: Readonly<Ref<PendingLibraryEntryMove | null>>;
  groupDialog: Readonly<Ref<LibraryGroupDialogState | null>>;
  activeGroup: Readonly<Ref<DialogModule<"library-group">["group"]>>;
}
export interface WorkspaceDialogCatalogState {
  snapshot: Readonly<Ref<CatalogIndexSnapshot | null>>;
  loading: Readonly<Ref<boolean>>;
  mutationPending: Readonly<Ref<boolean>>;
  materialStageOptions(
    materialKind: PendingLibraryEntryMove["targetMaterialKind"]
  ): DialogModule<"library-entry-move">["options"];
}
export interface WorkspaceDialogModuleCoordinatorOptions {
  startup: WorkspaceDialogStartupState;
  save: WorkspaceDialogSaveState;
  longStructure: WorkspaceDialogLongStructureState;
  longLifecycle: WorkspaceDialogLongLifecycleState;
  creation: {
    createDialogOpen: Readonly<Ref<boolean>>;
    transferMode: Readonly<Ref<DialogModule<"book-transfer">["mode"] | null>>;
  };
  library: WorkspaceDialogLibraryState;
  catalog: WorkspaceDialogCatalogState;
}
