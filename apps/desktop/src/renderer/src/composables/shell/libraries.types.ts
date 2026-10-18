import { useCatalogLibraryTransactionsCoordinator } from "../../composables/useCatalogLibraryTransactionsCoordinator";
export interface LibrariesRuntime {
  libraryProjectDialog: ReturnType<
    typeof useCatalogLibraryTransactionsCoordinator
  >["libraryProjectDialog"];
  externalLibraryImport: ReturnType<
    typeof useCatalogLibraryTransactionsCoordinator
  >["externalLibraryImport"];
  libraryGroupDialog: ReturnType<
    typeof useCatalogLibraryTransactionsCoordinator
  >["libraryGroupDialog"];
  libraryRemovalDialog: ReturnType<
    typeof useCatalogLibraryTransactionsCoordinator
  >["libraryRemovalDialog"];
  libraryEntryClipboardDomain: ReturnType<
    typeof useCatalogLibraryTransactionsCoordinator
  >["libraryEntryClipboardDomain"];
  pendingLibraryEntryMove: ReturnType<
    typeof useCatalogLibraryTransactionsCoordinator
  >["pendingLibraryEntryMove"];
  activeLibraryGroup: ReturnType<
    typeof useCatalogLibraryTransactionsCoordinator
  >["activeLibraryGroup"];
  createCatalogLibrary: ReturnType<
    typeof useCatalogLibraryTransactionsCoordinator
  >["createCatalogLibrary"];
  saveCatalogLibraryGroup: ReturnType<
    typeof useCatalogLibraryTransactionsCoordinator
  >["saveCatalogLibraryGroup"];
  createCatalogLibraryEntry: ReturnType<
    typeof useCatalogLibraryTransactionsCoordinator
  >["createCatalogLibraryEntry"];
  renameCatalogLibrary: ReturnType<
    typeof useCatalogLibraryTransactionsCoordinator
  >["renameCatalogLibrary"];
  renameCatalogLibraryEntry: ReturnType<
    typeof useCatalogLibraryTransactionsCoordinator
  >["renameCatalogLibraryEntry"];
  removeCatalogLibraryEntry: ReturnType<
    typeof useCatalogLibraryTransactionsCoordinator
  >["removeCatalogLibraryEntry"];
  requestCatalogLibraryEntryMove: ReturnType<
    typeof useCatalogLibraryTransactionsCoordinator
  >["requestCatalogLibraryEntryMove"];
  confirmCatalogLibraryEntryMove: ReturnType<
    typeof useCatalogLibraryTransactionsCoordinator
  >["confirmCatalogLibraryEntryMove"];
  confirmLibraryRemoval: ReturnType<
    typeof useCatalogLibraryTransactionsCoordinator
  >["confirmLibraryRemoval"];
  handleResourceNodeAction: ReturnType<
    typeof useCatalogLibraryTransactionsCoordinator
  >["handleResourceNodeAction"];
  findCatalogLibrary: (
    domain: "material" | "skill",
    libraryId: string
  ) =>
    | import("@deepwrite/contracts").CatalogIndexSnapshot["materials"][number]
    | import("@deepwrite/contracts").CatalogIndexSnapshot["skills"][number]
    | undefined;
}
