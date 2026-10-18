<script setup lang="ts">
import AppIcon from "./AppIcon.vue";
defineProps<{
  path: readonly string[];
  readOnly?: boolean | undefined;
  locked: boolean;
  lockedLabel: string;
  manualSaving?: boolean;
  autoSaveEnabled?: boolean;
  dirty: boolean;
  persistedDocument: boolean;
  visibleDirtySaveState: boolean;
  rightPane?: boolean;
  rightPaneCollapsed?: boolean;
}>();
const emit = defineEmits<{ collapse: []; toggleRight: [] }>();
</script>
<template>
  <header class="editor-header">
    <div class="editor-breadcrumbs" :title="path.join(' / ')">
      <span v-for="(part, index) in path" :key="`${part}-${index}`">
        {{ part }}<i v-if="index < path.length - 1">/</i>
      </span>
    </div>
    <div class="editor-header-actions">
      <span class="save-state" :class="{ 'is-dirty': visibleDirtySaveState }">
        <AppIcon :name="visibleDirtySaveState ? 'save' : 'check'" :size="13" />
        {{
          readOnly
            ? "只读"
            : locked
              ? lockedLabel
              : manualSaving
                ? "正在保存到本机"
                : autoSaveEnabled
                  ? "自动保存已开启"
                  : dirty
                    ? "有未应用修改"
                    : persistedDocument
                      ? "已保存到本机"
                      : "本次运行已应用"
        }}
      </span>
      <button
        v-if="rightPane !== false"
        class="icon-button"
        type="button"
        aria-label="收起文本内容栏"
        @click="emit('collapse')"
      >
        <AppIcon name="panel-right" :size="18" />
      </button>
      <button
        v-else-if="rightPaneCollapsed"
        class="icon-button"
        type="button"
        aria-label="展开智能体栏"
        @click="emit('toggleRight')"
      >
        <AppIcon name="panel-right" :size="18" />
      </button>
    </div>
  </header>
</template>
