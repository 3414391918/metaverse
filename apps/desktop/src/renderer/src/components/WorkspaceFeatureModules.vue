<script setup lang="ts">
import type {
  AgentTeamProfileCreateInput,
  AgentTeamProfileRenameInput,
  AgentTeamProfileSaveInput,
  AgentTeamProfileSetEnabledInput,
  AgentTeamProfileTargetInput,
  AppLanguage,
  BodyTextFormatChange,
  GeneralPermissionMode,
  LibraryAgentDomain,
  LibraryAgentSettingsInput,
  LongAgentSettingsInput,
  TextViewMode,
  WorkspacePaneLayout
} from "@deepwrite/contracts";
import {
  SettingsPage,
  WorkspaceDirectoryFeature,
  PromptTemplateManager,
  ToolManager
} from "./lazyAppComponents";
import type { WorkspaceFeatureModule } from "./WorkspaceFeatureModules.types";
import WorkspaceFeatureFrame from "./WorkspaceFeatureFrame.vue";
import FishAudioManager from "./FishAudioManager.vue";

defineProps<{
  module: WorkspaceFeatureModule;
  leftCollapsed: boolean;
}>();

const emit = defineEmits<{
  expandLeft: [];
  back: [];
  updatePermissionMode: [mode: GeneralPermissionMode];
  updateAutoApproveCrossStageOperations: [enabled: boolean];
  updateAutoSave: [enabled: boolean];
  updateLanguage: [language: AppLanguage];
  updateShowContextUsage: [enabled: boolean];
  updateShowInMenuBar: [enabled: boolean];
  updateUseNetworkProxy: [enabled: boolean];
  updateWorkspacePaneLayout: [layout: WorkspacePaneLayout];
  updateDefaultTextViewMode: [mode: TextViewMode];
  updateBodyTextFormat: [change: BodyTextFormatChange];
  retryLongAgents: [];
  saveLongAgents: [settings: LongAgentSettingsInput];
  saveLibraryAgents: [settings: LibraryAgentSettingsInput];
  resetLibraryAgent: [domain: LibraryAgentDomain];
  retryAgentTeam: [];
  createAgentTeam: [input: AgentTeamProfileCreateInput];
  renameAgentTeam: [input: AgentTeamProfileRenameInput];
  deleteAgentTeam: [input: AgentTeamProfileTargetInput];
  downloadAgentTeam: [input: AgentTeamProfileTargetInput];
  installAgentTeam: [];
  setAgentTeamEnabled: [input: AgentTeamProfileSetEnabledInput];
  saveAgentTeam: [input: AgentTeamProfileSaveInput];
  chooseWorkspaceDirectory: [];
  refreshCatalog: [];
}>();
</script>

<template>
  <WorkspaceFeatureFrame
    v-if="module.kind === 'tools'"
    class="workspace-settings-main-view tool-manager-main-view"
    :left-collapsed="leftCollapsed"
    expand-button-class="workspace-settings-expand-sidebar"
    label="工具管理"
    @expand-left="emit('expandLeft')"
    ><ToolManager
  /></WorkspaceFeatureFrame>
  <WorkspaceFeatureFrame
    v-else-if="module.kind === 'prompt-templates'"
    class="workspace-settings-main-view"
    :left-collapsed="leftCollapsed"
    expand-button-class="workspace-settings-expand-sidebar"
    label="提示词模板"
    @expand-left="emit('expandLeft')"
    ><PromptTemplateManager
  /></WorkspaceFeatureFrame>
  <WorkspaceFeatureFrame
    v-else-if="module.kind === 'voice-manager'"
    :left-collapsed="leftCollapsed"
    expand-button-class="fish-manager-expand-sidebar"
    label="声音管理"
    @expand-left="emit('expandLeft')"
    ><FishAudioManager
  /></WorkspaceFeatureFrame>
  <SettingsPage
    v-else-if="module.kind === 'settings'"
    :initial-category="module.initialCategory"
    :permission-mode="module.permissionMode"
    :auto-approve-cross-stage-operations="
      module.autoApproveCrossStageOperations
    "
    :auto-save-enabled="module.autoSaveEnabled"
    :language="module.language"
    :show-context-usage="module.showContextUsage"
    :show-in-menu-bar="module.showInMenuBar"
    :use-network-proxy="module.useNetworkProxy"
    :workspace-pane-layout="module.workspacePaneLayout"
    :default-text-view-mode="module.defaultTextViewMode"
    :body-text-formats="module.bodyTextFormats"
    :long-agent-settings="module.longAgentSettings"
    :long-agent-loading="module.longAgentLoading"
    :long-agent-saving="module.longAgentSaving"
    :long-agent-error="module.longAgentError"
    :library-agent-settings="module.libraryAgentSettings"
    :library-agent-loading="module.libraryAgentLoading"
    :library-agent-saving="module.libraryAgentSaving"
    :runtime-available="module.runtimeAvailable"
    @back="emit('back')"
    @update-permission-mode="emit('updatePermissionMode', $event)"
    @update-auto-approve-cross-stage-operations="
      emit('updateAutoApproveCrossStageOperations', $event)
    "
    @update-auto-save="emit('updateAutoSave', $event)"
    @update-language="emit('updateLanguage', $event)"
    @update-show-context-usage="emit('updateShowContextUsage', $event)"
    @update-show-in-menu-bar="emit('updateShowInMenuBar', $event)"
    @update-use-network-proxy="emit('updateUseNetworkProxy', $event)"
    @update-workspace-pane-layout="emit('updateWorkspacePaneLayout', $event)"
    @update-default-text-view-mode="emit('updateDefaultTextViewMode', $event)"
    @update-body-text-format="emit('updateBodyTextFormat', $event)"
    @retry-long-agents="emit('retryLongAgents')"
    @save-long-agents="emit('saveLongAgents', $event)"
    @save-library-agents="emit('saveLibraryAgents', $event)"
    @reset-library-agent="emit('resetLibraryAgent', $event)"
  />

  <WorkspaceFeatureFrame
    v-else-if="module.kind === 'directory'"
    class="workspace-settings-main-view"
    :left-collapsed="leftCollapsed"
    expand-button-class="workspace-settings-expand-sidebar"
    label="工作目录"
    @expand-left="emit('expandLeft')"
  >
    <WorkspaceDirectoryFeature
      :path="module.path"
      :loading="module.loading"
      @choose="emit('chooseWorkspaceDirectory')"
    />
  </WorkspaceFeatureFrame>
</template>
