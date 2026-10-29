<script setup lang="ts">
import { computed, ref } from "vue";
import {
  type AppLanguage,
  type BodyTextFormats,
  type BodyTextFormatChange,
  type GeneralPermissionMode,
  type LibraryAgentDomain,
  type LibraryAgentSettings,
  type LibraryAgentSettingsInput,
  type LongAgentSettings,
  type LongAgentSettingsInput,
  type WorkspacePaneLayout
} from "@deepwrite/contracts";
import { AssistantSurface } from "./lazyAppComponents";
import AppIcon from "./AppIcon.vue";
import AppearanceSettingsPanel from "./AppearanceSettingsPanel.vue";
import GeneralSettingsPanel from "./GeneralSettingsPanel.vue";
import FishAudioSettingsPanel from "./FishAudioSettingsPanel.vue";
import WorkspaceDirectoryFeature from "./WorkspaceDirectoryFeature.vue";

interface SettingsCategory {
  id: string;
  label: string;
  icon?:
    | "user"
    | "sparkles"
    | "keyboard"
    | "globe"
    | "model"
    | "ledger"
    | "brain"
    | "settings"
    | "wand"
    | "archive"
    | "directory";
}

interface SettingsSection {
  id: string;
  label: string;
  categories: SettingsCategory[];
}

const props = defineProps<{
  initialCategory?: string;
  permissionMode: GeneralPermissionMode;
  autoApproveCrossStageOperations: boolean;
  autoSaveEnabled: boolean;
  language: AppLanguage;
  showContextUsage: boolean;
  showInMenuBar: boolean;
  workspacePaneLayout: WorkspacePaneLayout;
  bodyTextFormats: BodyTextFormats;
  longAgentSettings: LongAgentSettings | null;
  longAgentLoading: boolean;
  longAgentSaving: boolean;
  longAgentError: string | null;
  libraryAgentSettings: LibraryAgentSettings | null;
  libraryAgentLoading: boolean;
  libraryAgentSaving: boolean;
  runtimeAvailable: boolean;
  workspaceDirectoryPath: string | null;
  workspaceDirectoryLoading: boolean;
  workspaceDirectoryPreviousPath: string | null;
  workspaceDirectoryMigrationSourcePath: string | null;
}>();

const emit = defineEmits<{
  back: [];
  updatePermissionMode: [mode: GeneralPermissionMode];
  updateAutoApproveCrossStageOperations: [enabled: boolean];
  updateAutoSave: [enabled: boolean];
  updateLanguage: [language: AppLanguage];
  updateShowContextUsage: [enabled: boolean];
  updateShowInMenuBar: [enabled: boolean];
  updateWorkspacePaneLayout: [layout: WorkspacePaneLayout];
  updateBodyTextFormat: [change: BodyTextFormatChange];
  retryLongAgents: [];
  saveLongAgents: [settings: LongAgentSettingsInput];
  saveLibraryAgents: [settings: LibraryAgentSettingsInput];
  resetLibraryAgent: [domain: LibraryAgentDomain];
  chooseWorkspaceDirectory: [];
  restoreWorkspaceDirectory: [];
  migrateWorkspaceDirectory: [];
}>();
const searchQuery = ref("");

const sections: SettingsSection[] = [
  {
    id: "personal",
    label: "个人",
    categories: [
      { id: "general", label: "常规", icon: "settings" },
      { id: "directory", label: "工作目录", icon: "directory" },
      { id: "appearance", label: "外观", icon: "sparkles" }
    ]
  },
  {
    id: "agent",
    label: "智能体",
    categories: [
      { id: "agent-models", label: "模型", icon: "model" },
      { id: "agent-plugins", label: "插件", icon: "archive" },
      { id: "agent-presets", label: "预设", icon: "brain" }
    ]
  },
  {
    id: "third-party",
    label: "第三方平台",
    categories: [{ id: "fish-audio", label: "FishAudio", icon: "model" }]
  }
];

const activeCategory = ref(
  sections.some((section) =>
    section.categories.some((category) => category.id === props.initialCategory)
  )
    ? props.initialCategory!
    : "general"
);

const visibleSections = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase();
  if (!query) return sections;
  return sections
    .map((section) => ({
      ...section,
      categories: section.categories.filter((category) =>
        category.label.toLocaleLowerCase().includes(query)
      )
    }))
    .filter((section) => section.categories.length);
});

const activeLabel = computed(() => {
  for (const section of sections) {
    const found = section.categories.find(
      (category) => category.id === activeCategory.value
    );
    if (found) return found.label;
  }
  return "常规";
});

function selectCategory(id: string): void {
  activeCategory.value = id;
}
</script>

<template>
  <div class="settings-page">
    <aside class="settings-sidebar">
      <button class="settings-back" type="button" @click="emit('back')">
        <AppIcon name="chevron" :size="14" />
        <span>返回应用</span>
      </button>

      <div class="settings-search">
        <AppIcon name="search" :size="14" />
        <input v-model="searchQuery" type="search" placeholder="搜索设置..." />
      </div>

      <nav class="settings-nav" aria-label="设置分类">
        <div
          v-for="section in visibleSections"
          :key="section.id"
          class="settings-section"
        >
          <strong class="settings-section-label">{{ section.label }}</strong>
          <button
            v-for="category in section.categories"
            :key="category.id"
            class="settings-category"
            :class="{ 'is-active': activeCategory === category.id }"
            type="button"
            @click="selectCategory(category.id)"
          >
            <AppIcon v-if="category.icon" :name="category.icon" :size="15" />
            <span v-else class="settings-category-spacer" />
            <span>{{ category.label }}</span>
          </button>
        </div>
        <p v-if="!visibleSections.length" class="settings-search-empty">
          没有匹配的设置
        </p>
      </nav>
    </aside>

    <main
      class="settings-content"
      :class="{ 'agent-settings-content': activeCategory.startsWith('agent-') }"
    >
      <div class="settings-content-inner">
        <h1 v-if="!activeCategory.startsWith('agent-')" class="settings-title">
          {{ activeLabel }}
        </h1>

        <AssistantSurface
          v-if="activeCategory.startsWith('agent-')"
          :screen="
            activeCategory === 'agent-models'
              ? 'models'
              : activeCategory === 'agent-plugins'
                ? 'plugins'
                : 'presets'
          "
        />
        <GeneralSettingsPanel
          v-else-if="activeCategory === 'general'"
          :permission-mode="permissionMode"
          :auto-approve-cross-stage-operations="autoApproveCrossStageOperations"
          :auto-save-enabled="autoSaveEnabled"
          :language="language"
          :show-context-usage="showContextUsage"
          :show-in-menu-bar="showInMenuBar"
          :workspace-pane-layout="workspacePaneLayout"
          :body-text-formats="bodyTextFormats"
          @update-permission-mode="emit('updatePermissionMode', $event)"
          @update-auto-approve-cross-stage-operations="
            emit('updateAutoApproveCrossStageOperations', $event)
          "
          @update-auto-save="emit('updateAutoSave', $event)"
          @update-language="emit('updateLanguage', $event)"
          @update-show-context-usage="emit('updateShowContextUsage', $event)"
          @update-show-in-menu-bar="emit('updateShowInMenuBar', $event)"
          @update-workspace-pane-layout="
            emit('updateWorkspacePaneLayout', $event)
          "
          @update-body-text-format="emit('updateBodyTextFormat', $event)"
        />

        <WorkspaceDirectoryFeature
          v-else-if="activeCategory === 'directory'"
          :path="workspaceDirectoryPath"
          :loading="workspaceDirectoryLoading"
          :previous-path="workspaceDirectoryPreviousPath"
          :migration-source-path="workspaceDirectoryMigrationSourcePath"
          @choose="emit('chooseWorkspaceDirectory')"
          @restore="emit('restoreWorkspaceDirectory')"
          @migrate="emit('migrateWorkspaceDirectory')"
        />

        <AppearanceSettingsPanel v-else-if="activeCategory === 'appearance'" />

        <FishAudioSettingsPanel v-else-if="activeCategory === 'fish-audio'" />

        <section v-else class="settings-group">
          <div class="settings-card">
            <p class="settings-placeholder">
              「{{ activeLabel }}」设置项待配置。
            </p>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>

<style scoped src="./settings-page.css"></style>

<style scoped>
.agent-settings-content {
  padding: 0;
  overflow: hidden;
}
.agent-settings-content .settings-content-inner {
  max-width: none;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 24px 20px 0;
  box-sizing: border-box;
}
.agent-settings-content .settings-title {
  flex: none;
  margin-bottom: 14px;
}
.agent-settings-content .assistant-surface {
  flex: 1;
  min-height: 0;
}
</style>
