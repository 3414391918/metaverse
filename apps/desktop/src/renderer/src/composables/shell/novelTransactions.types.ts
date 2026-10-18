import { useLazyLongBookLifecycleCoordinator } from "../../composables/useLazyLongBookLifecycleCoordinator";
import { useLazyLongStructureTransactionsCoordinator } from "../../composables/useLazyLongStructureTransactionsCoordinator";
export interface NovelTransactionsRuntime {
  createLongBook: ReturnType<
    typeof useLazyLongBookLifecycleCoordinator
  >["createLongBook"];
  openExistingLongBook: ReturnType<
    typeof useLazyLongBookLifecycleCoordinator
  >["openExistingLongBook"];
  chooseContinuationImportSource: ReturnType<
    typeof useLazyLongBookLifecycleCoordinator
  >["chooseContinuationImportSource"];
  importPortableLongBook: ReturnType<
    typeof useLazyLongBookLifecycleCoordinator
  >["importPortableLongBook"];
  confirmContinuationImport: ReturnType<
    typeof useLazyLongBookLifecycleCoordinator
  >["confirmContinuationImport"];
  closeContinuationImportDialog: ReturnType<
    typeof useLazyLongBookLifecycleCoordinator
  >["closeContinuationImportDialog"];
  handleLongBookAction: ReturnType<
    typeof useLazyLongBookLifecycleCoordinator
  >["handleLongBookAction"];
  closeLegacySyncDialog: ReturnType<
    typeof useLazyLongBookLifecycleCoordinator
  >["closeLegacySyncDialog"];
  confirmLegacySync: ReturnType<
    typeof useLazyLongBookLifecycleCoordinator
  >["confirmLegacySync"];
  closeLongExportDialog: ReturnType<
    typeof useLazyLongBookLifecycleCoordinator
  >["closeLongExportDialog"];
  exportLongBookManuscript: ReturnType<
    typeof useLazyLongBookLifecycleCoordinator
  >["exportLongBookManuscript"];
  closeLongBookRenameDialog: ReturnType<
    typeof useLazyLongBookLifecycleCoordinator
  >["closeLongBookRenameDialog"];
  renameLongBook: ReturnType<
    typeof useLazyLongBookLifecycleCoordinator
  >["renameLongBook"];
  closeLongBookBindingsDialog: ReturnType<
    typeof useLazyLongBookLifecycleCoordinator
  >["closeLongBookBindingsDialog"];
  updateLongBookBindings: ReturnType<
    typeof useLazyLongBookLifecycleCoordinator
  >["updateLongBookBindings"];
  closeLongBookRemovalDialog: ReturnType<
    typeof useLazyLongBookLifecycleCoordinator
  >["closeLongBookRemovalDialog"];
  confirmLongBookRemoval: ReturnType<
    typeof useLazyLongBookLifecycleCoordinator
  >["confirmLongBookRemoval"];
  saveLongAgentsMd: ReturnType<
    typeof useLazyLongBookLifecycleCoordinator
  >["saveLongAgentsMd"];
  disposeLongBookLifecycle: ReturnType<
    typeof useLazyLongBookLifecycleCoordinator
  >["dispose"];
  longWorldbuildingSyncBookOptions: ReturnType<
    typeof useLazyLongStructureTransactionsCoordinator
  >["longWorldbuildingSyncBookOptions"];
  openLongChapterCardCreate: ReturnType<
    typeof useLazyLongStructureTransactionsCoordinator
  >["openLongChapterCardCreate"];
  requestCreateLongDraftSection: ReturnType<
    typeof useLazyLongStructureTransactionsCoordinator
  >["requestCreateLongDraftSection"];
  handleLongDraftSectionAction: ReturnType<
    typeof useLazyLongStructureTransactionsCoordinator
  >["handleLongDraftSectionAction"];
  handleCreateLongTreeItem: ReturnType<
    typeof useLazyLongStructureTransactionsCoordinator
  >["handleCreateLongTreeItem"];
  handleLongTreeItemAction: ReturnType<
    typeof useLazyLongStructureTransactionsCoordinator
  >["handleLongTreeItemAction"];
  confirmDeleteLongTreeItem: ReturnType<
    typeof useLazyLongStructureTransactionsCoordinator
  >["confirmDeleteLongTreeItem"];
  confirmDeleteLongDraftSection: ReturnType<
    typeof useLazyLongStructureTransactionsCoordinator
  >["confirmDeleteLongDraftSection"];
  renameLongCharacter: ReturnType<
    typeof useLazyLongStructureTransactionsCoordinator
  >["renameLongCharacter"];
  renameLongStructureTitle: ReturnType<
    typeof useLazyLongStructureTransactionsCoordinator
  >["renameLongStructureTitle"];
  openLongCharacterCreate: ReturnType<
    typeof useLazyLongStructureTransactionsCoordinator
  >["openLongCharacterCreate"];
  openLongWorldbuildingItemCreate: ReturnType<
    typeof useLazyLongStructureTransactionsCoordinator
  >["openLongWorldbuildingItemCreate"];
  openLongVolumeCreate: ReturnType<
    typeof useLazyLongStructureTransactionsCoordinator
  >["openLongVolumeCreate"];
  openLongPlotPointCreate: ReturnType<
    typeof useLazyLongStructureTransactionsCoordinator
  >["openLongPlotPointCreate"];
  saveLongVolumeOutline: ReturnType<
    typeof useLazyLongStructureTransactionsCoordinator
  >["saveLongVolumeOutline"];
  saveLongPlotPointContent: ReturnType<
    typeof useLazyLongStructureTransactionsCoordinator
  >["saveLongPlotPointContent"];
  createLongVolume: ReturnType<
    typeof useLazyLongStructureTransactionsCoordinator
  >["createLongVolume"];
  createLongWorldbuildingItem: ReturnType<
    typeof useLazyLongStructureTransactionsCoordinator
  >["createLongWorldbuildingItem"];
  createLongPlotPoint: ReturnType<
    typeof useLazyLongStructureTransactionsCoordinator
  >["createLongPlotPoint"];
  createLongChapterCard: ReturnType<
    typeof useLazyLongStructureTransactionsCoordinator
  >["createLongChapterCard"];
  handleActiveLongStructureMutation: ReturnType<
    typeof useLazyLongStructureTransactionsCoordinator
  >["handleActiveLongStructureMutation"];
  previewActiveLongStructureMutation: ReturnType<
    typeof useLazyLongStructureTransactionsCoordinator
  >["previewActiveLongStructureMutation"];
  handleLongWorldbuildingSync: ReturnType<
    typeof useLazyLongStructureTransactionsCoordinator
  >["handleLongWorldbuildingSync"];
  previewActiveLongNavigationStructure: ReturnType<
    typeof useLazyLongStructureTransactionsCoordinator
  >["previewActiveLongNavigationStructure"];
  deleteActiveLongNavigationStructure: ReturnType<
    typeof useLazyLongStructureTransactionsCoordinator
  >["deleteActiveLongNavigationStructure"];
  createLongCharacter: ReturnType<
    typeof useLazyLongStructureTransactionsCoordinator
  >["createLongCharacter"];
  closeLongStructureDialog: ReturnType<
    typeof useLazyLongStructureTransactionsCoordinator
  >["closeLongStructureDialog"];
  closeLongCharacterCreate: ReturnType<
    typeof useLazyLongStructureTransactionsCoordinator
  >["closeLongCharacterCreate"];
  closeLongWorldbuildingItemCreate: ReturnType<
    typeof useLazyLongStructureTransactionsCoordinator
  >["closeLongWorldbuildingItemCreate"];
  closeLongPlotPointCreate: ReturnType<
    typeof useLazyLongStructureTransactionsCoordinator
  >["closeLongPlotPointCreate"];
  closeLongChapterCardCreate: ReturnType<
    typeof useLazyLongStructureTransactionsCoordinator
  >["closeLongChapterCardCreate"];
  closeLongDraftSectionDelete: ReturnType<
    typeof useLazyLongStructureTransactionsCoordinator
  >["closeLongDraftSectionDelete"];
  closeLongTreeItemDelete: ReturnType<
    typeof useLazyLongStructureTransactionsCoordinator
  >["closeLongTreeItemDelete"];
  closeLongVolumeCreate: ReturnType<
    typeof useLazyLongStructureTransactionsCoordinator
  >["closeLongVolumeCreate"];
  disposeLongStructureTransactions: ReturnType<
    typeof useLazyLongStructureTransactionsCoordinator
  >["dispose"];
}
