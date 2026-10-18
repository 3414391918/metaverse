<script setup lang="ts">
import type {
  AppLanguage,
  GeneralPermissionMode,
  WorkspacePaneLayout
} from "@deepwrite/contracts";
import PopupSelect from "./PopupSelect.vue";

defineProps<{
  permissionMode: GeneralPermissionMode;
  autoApproveCrossStageOperations: boolean;
  autoSaveEnabled: boolean;
  language: AppLanguage;
  showContextUsage: boolean;
  showInMenuBar: boolean;
  useNetworkProxy: boolean;
  workspacePaneLayout: WorkspacePaneLayout;
}>();

const emit = defineEmits<{
  updatePermissionMode: [mode: GeneralPermissionMode];
  updateAutoApproveCrossStageOperations: [enabled: boolean];
  updateAutoSave: [enabled: boolean];
  updateLanguage: [language: AppLanguage];
  updateShowContextUsage: [enabled: boolean];
  updateShowInMenuBar: [enabled: boolean];
  updateUseNetworkProxy: [enabled: boolean];
  updateWorkspacePaneLayout: [layout: WorkspacePaneLayout];
}>();

const languageOptions: Array<{ value: AppLanguage; label: string }> = [
  { value: "auto", label: "自动检测（简体中文）" },
  { value: "zh-CN", label: "简体中文" }
];
</script>

<template>
  <section class="settings-group">
    <h2 class="settings-group-title">常规</h2>
    <div class="settings-card">
      <label class="settings-item">
        <span class="settings-item-text"
          ><strong>自动保存</strong
          ><small>文稿发生变化并停止输入片刻后，自动保存到本机</small></span
        >
        <span class="settings-toggle"
          ><input
            type="checkbox"
            :checked="autoSaveEnabled"
            @change="
              emit(
                'updateAutoSave',
                ($event.target as HTMLInputElement).checked
              )
            "
        /></span>
      </label>
      <div class="settings-item settings-select-item">
        <span class="settings-item-text"
          ><strong>语言</strong
          ><small>应用 UI 语言；当前版本提供简体中文</small></span
        >
        <PopupSelect
          class="general-select-control"
          :model-value="language"
          :options="languageOptions"
          accessible-label="选择应用语言"
          align="end"
          :menu-min-width="210"
          @update:model-value="
            emit('updateLanguage', String($event) as AppLanguage)
          "
        />
      </div>
      <label class="settings-item"
        ><span class="settings-item-text"
          ><strong>在菜单栏中显示</strong
          ><small>关闭主窗口后，仍在菜单栏中保留应用图标</small></span
        ><span class="settings-toggle"
          ><input
            type="checkbox"
            :checked="showInMenuBar"
            @change="
              emit(
                'updateShowInMenuBar',
                ($event.target as HTMLInputElement).checked
              )
            " /></span
      ></label>
      <label class="settings-item">
        <span class="settings-item-text"
          ><strong>使用系统代理</strong
          ><small
            >开启后，Fish Audio 等网络请求使用电脑当前的系统代理设置</small
          ></span
        >
        <span class="settings-toggle"
          ><input
            type="checkbox"
            :checked="useNetworkProxy"
            aria-label="使用系统代理"
            @change="
              emit(
                'updateUseNetworkProxy',
                ($event.target as HTMLInputElement).checked
              )
            "
        /></span>
      </label>
    </div>
  </section>
</template>

<style scoped src="./settings-page.css"></style>
<style scoped>
.settings-select-item {
  flex-wrap: wrap;
}

.settings-select-item .settings-item-text {
  min-width: min(240px, 100%);
}

.general-select-control {
  width: 210px;
  min-width: 160px;
  max-width: 210px;
  flex: 0 1 210px;
}
</style>
