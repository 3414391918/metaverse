// Dependency preload manifests are loaded with optional features, never during workspace startup.
export const loadAuthorSupportDialog = () =>
  import("./AuthorSupportDialog.vue");

export const loadLongWorkspaceModule = () =>
  import("./LongWorkspaceModule.vue");
export const loadSettingsPage = () => import("./SettingsPage.vue");
export const loadWorkspaceDirectoryFeature = () =>
  import("./WorkspaceDirectoryFeature.vue");
export const loadPromptTemplateManager = () =>
  import("./PromptTemplateManager.vue");
export const loadToolManager = () => import("./ToolManager.vue");
export const loadWorkspaceFeatureModules = () =>
  import("./WorkspaceFeatureModules.vue");
export const loadWorkspaceDialogLayer = () =>
  import("./WorkspaceDialogLayer.vue");

export const loadBookTransferDialog = () => import("./BookTransferDialog.vue");
export const loadCreateBookDialog = () => import("./CreateBookDialog.vue");
export const loadCreateLongChapterCardDialog = () =>
  import("./CreateLongChapterCardDialog.vue");
export const loadCreateLongCharacterDialog = () =>
  import("./CreateLongCharacterDialog.vue");
export const loadCreateLongPlotPointDialog = () =>
  import("./CreateLongPlotPointDialog.vue");
export const loadCreateLongVolumeDialog = () =>
  import("./CreateLongVolumeDialog.vue");
export const loadCreateLongWorldbuildingItemDialog = () =>
  import("./CreateLongWorldbuildingItemDialog.vue");
export const loadDeleteLongDraftSectionDialog = () =>
  import("./DeleteLongDraftSectionDialog.vue");
export const loadExportLongManuscriptDialog = () =>
  import("./ExportLongManuscriptDialog.vue");
export const loadExternalSkillImportDialog = () =>
  import("./ExternalSkillImportDialog.vue");
export const loadLibraryEntryMoveDialog = () =>
  import("./LibraryEntryMoveDialog.vue");
export const loadLibraryGroupDialog = () => import("./LibraryGroupDialog.vue");
export const loadLibraryProjectDialog = () =>
  import("./LibraryProjectDialog.vue");
export const loadLibraryRemovalDialog = () =>
  import("./LibraryRemovalDialog.vue");
export const loadLongBookBindingsDialog = () =>
  import("./LongBookBindingsDialog.vue");
export const loadLongBookRemovalDialog = () =>
  import("./LongBookRemovalDialog.vue");
export const loadLongBookRenameDialog = () =>
  import("./LongBookRenameDialog.vue");
export const loadLongContinuationImportDialog = () =>
  import("./LongContinuationImportDialog.vue");
export const loadLongLegacySyncDialog = () =>
  import("./LongLegacySyncDialog.vue");
export const loadLongStructureDialog = () =>
  import("./LongStructureDialog.vue");
export const loadSaveConflictDialog = () => import("./SaveConflictDialog.vue");
export const loadStartupAlertDialog = () => import("./StartupAlertDialog.vue");

export const loadWindowMenuBar = () => import("./WindowMenuBar.vue");
