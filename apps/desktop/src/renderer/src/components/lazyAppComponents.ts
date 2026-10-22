import { defineAsyncComponent, type Component } from "vue";
import LongWorkspaceLoading from "./LongWorkspaceLoading.vue";
type FeatureImports = typeof import("./lazyFeatureImports");
/** Share the import boundary without repeating dependency manifests in startup code. */
function lazyFeature<T extends Component>(
  load: (features: FeatureImports) => Promise<{ default: T }>,
  loadingComponent?: Component
): T {
  return defineAsyncComponent<T>({
    loader: async () =>
      (await load(await import("./lazyFeatureImports"))).default,
    ...(loadingComponent ? { loadingComponent, delay: 0 } : {})
  });
}
// The default writing surface remains eager; optional pages and dialogs load on demand.
export const AuthorSupportDialog = lazyFeature((features) =>
  features.loadAuthorSupportDialog()
);

export const LongWorkspaceModule = lazyFeature(
  (features) => features.loadLongWorkspaceModule(),
  LongWorkspaceLoading
);
export const SettingsPage = lazyFeature((features) =>
  features.loadSettingsPage()
);
export const PromptTemplateManager = lazyFeature((features) =>
  features.loadPromptTemplateManager()
);
export const ToolManager = lazyFeature((features) =>
  features.loadToolManager()
);
export const ResourceManager = lazyFeature((features) =>
  features.loadResourceManager()
);
export const WorkspaceFeatureModules = lazyFeature((features) =>
  features.loadWorkspaceFeatureModules()
);
export const WorkspaceDialogLayer = lazyFeature((features) =>
  features.loadWorkspaceDialogLayer()
);

export const BookTransferDialog = lazyFeature((features) =>
  features.loadBookTransferDialog()
);
export const CreateBookDialog = lazyFeature((features) =>
  features.loadCreateBookDialog()
);
export const CreateLongChapterCardDialog = lazyFeature((features) =>
  features.loadCreateLongChapterCardDialog()
);
export const CreateLongCharacterDialog = lazyFeature((features) =>
  features.loadCreateLongCharacterDialog()
);
export const CreateLongPlotPointDialog = lazyFeature((features) =>
  features.loadCreateLongPlotPointDialog()
);
export const CreateLongVolumeDialog = lazyFeature((features) =>
  features.loadCreateLongVolumeDialog()
);
export const CreateLongWorldbuildingItemDialog = lazyFeature((features) =>
  features.loadCreateLongWorldbuildingItemDialog()
);
export const DeleteLongDraftSectionDialog = lazyFeature((features) =>
  features.loadDeleteLongDraftSectionDialog()
);
export const ExportLongManuscriptDialog = lazyFeature((features) =>
  features.loadExportLongManuscriptDialog()
);
export const ExternalSkillImportDialog = lazyFeature((features) =>
  features.loadExternalSkillImportDialog()
);
export const LibraryEntryMoveDialog = lazyFeature((features) =>
  features.loadLibraryEntryMoveDialog()
);
export const LibraryGroupDialog = lazyFeature((features) =>
  features.loadLibraryGroupDialog()
);
export const LibraryProjectDialog = lazyFeature((features) =>
  features.loadLibraryProjectDialog()
);
export const LibraryRemovalDialog = lazyFeature((features) =>
  features.loadLibraryRemovalDialog()
);
export const LongBookBindingsDialog = lazyFeature((features) =>
  features.loadLongBookBindingsDialog()
);
export const LongBookRemovalDialog = lazyFeature((features) =>
  features.loadLongBookRemovalDialog()
);
export const LongBookRenameDialog = lazyFeature((features) =>
  features.loadLongBookRenameDialog()
);
export const LongContinuationImportDialog = lazyFeature((features) =>
  features.loadLongContinuationImportDialog()
);
export const LongLegacySyncDialog = lazyFeature((features) =>
  features.loadLongLegacySyncDialog()
);
export const LongStructureDialog = lazyFeature((features) =>
  features.loadLongStructureDialog()
);
export const SaveConflictDialog = lazyFeature((features) =>
  features.loadSaveConflictDialog()
);
export const StartupAlertDialog = lazyFeature((features) =>
  features.loadStartupAlertDialog()
);

export const WindowMenuBar = lazyFeature((features) =>
  features.loadWindowMenuBar()
);
