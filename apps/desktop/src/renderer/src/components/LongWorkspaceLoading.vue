<script setup lang="ts">
import AppIcon from "./AppIcon.vue";
defineProps<{ leftCollapsed?: boolean; pending?: boolean }>();
const emit = defineEmits<{ expandLeft: [] }>();
</script>
<template>
  <main
    class="long-workspace-editor-loading-state manual-workspace-empty"
    aria-label="正在读取创作空间"
  >
    <button
      v-if="leftCollapsed"
      class="icon-button manual-expand-sidebar"
      type="button"
      aria-label="展开左侧栏"
      @click="emit('expandLeft')"
    >
      <AppIcon name="panel-left" :size="18" />
    </button>
    <span>正在读取创作空间…</span>
  </main>
</template>
