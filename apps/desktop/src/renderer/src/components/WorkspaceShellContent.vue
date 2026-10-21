<script setup lang="ts">
import type { ComponentPublicInstance } from "vue";
import { useWorkspaceShellContext } from "../composables/shell/shellContext";
import LeftSidebar from "./LeftSidebar.vue";
import ToastHost from "./ToastHost.vue";
import WritingWorkspaceModule from "./WritingWorkspaceModule.vue";
import {
  LongWorkspaceModule,
  WorkspaceDialogLayer,
  WorkspaceFeatureModules
} from "./lazyAppComponents";
import { LEFT_PANE_MIN, LEFT_PANE_MAX } from "../stores/layoutStore";
const shell = useWorkspaceShellContext();
function bindDesktopShell(element: Element | ComponentPublicInstance | null) {
  shell.desktopShell = element instanceof HTMLElement ? element : null;
}
</script>

<template>
  <ToastHost />
  <WorkspaceFeatureModules
    v-if="shell.workspaceFeatureModule?.kind === 'settings'"
    :module="shell.workspaceFeatureModule"
    :left-collapsed="shell.leftCollapsed"
    @back="shell.featureHost.closeSettings"
    @update-permission-mode="shell.updatePermissionMode"
    @update-auto-approve-cross-stage-operations="
      shell.updateAutoApproveCrossStageOperations
    "
    @update-auto-save="shell.updateEditorAutoSave"
    @update-language="shell.updateAppLanguage"
    @update-show-context-usage="shell.updateShowContextUsage"
    @update-show-in-menu-bar="shell.updateShowInMenuBar"
    @update-use-network-proxy="shell.updateUseNetworkProxy"
    @update-workspace-pane-layout="shell.updateWorkspacePaneLayout"
    @update-default-text-view-mode="shell.updateDefaultTextViewMode"
    @update-body-text-format="shell.updateBodyTextFormat"
    @retry-long-agents="shell.loadLongAgentSettings"
    @save-long-agents="shell.saveLongAgentSettings"
    @save-library-agents="shell.saveLibraryAgentSettings"
    @reset-library-agent="shell.resetLibraryAgentSettings"
    @choose-workspace-directory="shell.featureHost.chooseWorkspaceDirectory"
    @restore-workspace-directory="shell.featureHost.restoreWorkspaceDirectory"
    @migrate-workspace-directory="shell.featureHost.migrateWorkspaceDirectory"
  />
  <div
    v-else
    :ref="bindDesktopShell"
    class="desktop-shell manual-workspace-shell"
    :class="[
      shell.shellClasses,
      {
        'is-editor-agent-layout':
          shell.generalSettings.workspacePaneLayout === 'editor-agent'
      }
    ]"
    :style="shell.shellStyle"
    data-testid="desktop-shell"
  >
    <LeftSidebar
      v-if="!shell.leftCollapsed"
      :sections="shell.resourceTreeSections"
      :selected-id="shell.selectedResourceId"
      :library-entry-clipboard-domain="shell.libraryEntryClipboardDomain"
      :active-primary-feature="shell.activePrimaryFeature"
      :long-tree-actions-disabled="shell.longBookActionPending"
      @collapse="shell.leftCollapsed = true"
      @create-book="shell.openCreateBookDialog"
      @open-dialog="shell.featureHost.openWorkspaceDialog"
      @open-settings="shell.featureHost.openSettings"
      @select-resource="shell.selectResource"
      @resource-action="shell.handleResourceAction"
      @resource-node-action="shell.handleResourceNodeAction"
      @move-library-entry="shell.requestCatalogLibraryEntryMove"
      @long-book-action="shell.handleLongBookAction"
      @create-long-draft-section="shell.requestCreateLongDraftSection"
      @long-draft-section-action="shell.handleLongDraftSectionAction"
      @create-long-tree-item="shell.handleCreateLongTreeItem"
      @long-tree-item-action="shell.handleLongTreeItemAction"
      @delete-long-ledger-commit="shell.requestDeleteLongLedgerCommit"
    />
    <WorkspaceFeatureModules
      v-if="shell.workspaceFeatureModule"
      :module="shell.workspaceFeatureModule"
      :left-collapsed="shell.leftCollapsed"
      @expand-left="shell.leftCollapsed = false"
      @retry-agent-team="shell.loadAgentTeamSettings"
      @create-agent-team="shell.createAgentTeam"
      @rename-agent-team="shell.renameAgentTeam"
      @delete-agent-team="shell.deleteAgentTeam"
      @download-agent-team="shell.downloadAgentTeam"
      @install-agent-team="shell.installAgentTeam"
      @set-agent-team-enabled="shell.setAgentTeamEnabled"
      @save-agent-team="shell.saveAgentTeamSettings"
      @refresh-catalog="shell.loadCatalogSnapshot"
    />

    <LongWorkspaceModule
      v-if="shell.activeFeature === 'long-workspace'"
      :book="shell.activeLongBookSummary"
      :selection="shell.activeLongSelection"
      :workspace-index="shell.activeLongWorkspaceIndex"
      :editor-locked="shell.longEditorLocked"
      :editor-locked-reason="shell.longEditorLockedReason"
      :loading="shell.longWorkspaceLoading"
      :left-collapsed="shell.leftCollapsed"
      :default-text-view-mode="shell.generalSettings.defaultTextViewMode"
      @editor-port-change="shell.updateLongWorkspaceEditorPort"
      @expand-left="shell.leftCollapsed = false"
      @saved="shell.handleLongDocumentSaved"
      @context-change="shell.handleLongFileContextChange"
      @select-character="shell.selectLongCharacterTab"
      @select-plot-point="shell.selectLongPlotPointTab"
      @select-chapter-card="shell.selectLongChapterCardTab"
      @select-entry-search-result="shell.selectLongEntrySearchResult"
      @rename-character="shell.renameLongCharacter"
      @rename-structure-title="shell.renameLongStructureTitle"
      @create-character="shell.openLongCharacterCreate"
      @create-worldbuilding-item="shell.openLongWorldbuildingItemCreate"
      @create-plot-point="shell.openLongPlotPointCreate"
      @create-chapter-card="shell.openLongChapterCardCreate"
      @create-volume="shell.openLongVolumeCreate"
      @preview-delete-structure="shell.previewActiveLongNavigationStructure"
      @delete-structure="shell.deleteActiveLongNavigationStructure"
      @save-volume-outline="shell.saveLongVolumeOutline"
      @save-plot-point-content="shell.saveLongPlotPointContent"
      @preview-mutation="shell.previewActiveLongStructureMutation"
      @mutation="shell.handleActiveLongStructureMutation"
    />

    <WritingWorkspaceModule
      v-if="shell.activeFeature === 'conversation'"
      :editor="shell.writingEditorViewModel"
      :left-collapsed="shell.leftCollapsed"
      @expand-left="shell.leftCollapsed = false"
      @save="shell.applyDocument"
      @live-change="shell.handleLiveDocumentChange"
      @select-entry-search-result="shell.selectEditorEntrySearchResult"
      @prepare-entry-search="shell.prepareEditorEntrySearch"
    />

    <div
      v-if="!shell.leftCollapsed"
      class="pane-resizer pane-resizer-left"
      role="separator"
      aria-label="调整左侧栏宽度"
      aria-orientation="vertical"
      :aria-valuemin="LEFT_PANE_MIN"
      :aria-valuemax="LEFT_PANE_MAX"
      :aria-valuenow="shell.leftPaneWidth"
      tabindex="0"
      @pointerdown="shell.startPaneResize('left', $event)"
      @keydown="shell.handleResizeKeydown('left', $event)"
    />
  </div>

  <WorkspaceDialogLayer
    v-if="shell.workspaceDialogModule"
    :module="shell.workspaceDialogModule"
    @close-export-long="shell.closeLongExportDialog"
    @export-long="shell.exportLongBookManuscript"
    @close-library-removal="shell.libraryRemovalDialog = null"
    @confirm-library-removal="shell.confirmLibraryRemoval"
    @close-create-book="shell.closeCreateBookDialog"
    @submit-create-book="shell.createCreativeBook"
    @close-book-transfer="shell.bookTransferDialogMode = null"
    @select-book-transfer="shell.handleBookTransferSelect"
    @close-continuation-import="shell.closeContinuationImportDialog"
    @confirm-continuation-import="shell.confirmContinuationImport"
    @close-legacy-sync="shell.closeLegacySyncDialog"
    @confirm-legacy-sync="shell.confirmLegacySync"
    @close-long-structure="shell.closeLongStructureDialog"
    @long-structure-mutation="shell.handleActiveLongStructureMutation"
    @save-long-agents-md="shell.saveLongAgentsMd"
    @sync-long-worldbuilding="shell.handleLongWorldbuildingSync"
    @close-create-long-character="shell.closeLongCharacterCreate"
    @submit-create-long-character="shell.createLongCharacter"
    @close-create-long-worldbuilding-item="
      shell.closeLongWorldbuildingItemCreate
    "
    @submit-create-long-worldbuilding-item="shell.createLongWorldbuildingItem"
    @close-create-long-plot-point="shell.closeLongPlotPointCreate"
    @submit-create-long-plot-point="shell.createLongPlotPoint"
    @close-create-long-chapter-card="shell.closeLongChapterCardCreate"
    @submit-create-long-chapter-card="shell.createLongChapterCard"
    @close-delete-long-draft="shell.closeLongDraftSectionDelete"
    @confirm-delete-long-draft="shell.confirmDeleteLongDraftSection"
    @close-delete-long-tree="shell.closeLongTreeItemDelete"
    @confirm-delete-long-tree="shell.confirmDeleteLongTreeItem"
    @close-delete-long-ledger-commit="shell.closeDeleteLongLedgerCommit"
    @confirm-delete-long-ledger-commit="shell.confirmDeleteLongLedgerCommit"
    @close-create-long-volume="shell.closeLongVolumeCreate"
    @submit-create-long-volume="shell.createLongVolume"
    @close-long-bindings="shell.closeLongBookBindingsDialog"
    @submit-long-bindings="shell.updateLongBookBindings"
    @close-long-rename="shell.closeLongBookRenameDialog"
    @submit-long-rename="shell.renameLongBook"
    @close-long-removal="shell.closeLongBookRemovalDialog"
    @confirm-long-removal="shell.confirmLongBookRemoval"
    @close-library-project="shell.libraryProjectDialog = null"
    @create-library="shell.createCatalogLibrary"
    @create-library-entry="shell.createCatalogLibraryEntry"
    @rename-library="shell.renameCatalogLibrary"
    @rename-library-entry="shell.renameCatalogLibraryEntry"
    @remove-library-entry="shell.removeCatalogLibraryEntry"
    @close-external-library-import="shell.externalLibraryImport.close"
    @choose-external-library-import="shell.externalLibraryImport.chooseSource"
    @submit-external-library-import="shell.externalLibraryImport.submit"
    @close-library-entry-move="shell.pendingLibraryEntryMove = null"
    @submit-library-entry-move="shell.confirmCatalogLibraryEntryMove"
    @close-library-group="shell.libraryGroupDialog = null"
    @submit-library-group="shell.saveCatalogLibraryGroup"
    @keep-save-conflict="shell.keepSaveConflictDraft"
    @reload-save-conflict="shell.reloadSaveConflictFromDisk"
    @overwrite-save-conflict="shell.overwriteSaveConflictOnDisk"
    @close-startup-alert="shell.closeStartupAlert"
  />
</template>
