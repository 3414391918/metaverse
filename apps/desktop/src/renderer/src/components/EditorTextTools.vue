<script setup lang="ts">
import AppIcon from "./AppIcon.vue";

defineProps<{
  canUndo: boolean;
  canRedo: boolean;
  disabled?: boolean;
  findPanelOpen: boolean;
  findPanelMode: "find" | "replace";
  formatVisible?: boolean;
  formatDisabled?: boolean;
}>();
const emit = defineEmits<{
  undo: [];
  redo: [];
  toggleFind: [mode: "find" | "replace"];
  format: [];
}>();
</script>

<template>
  <button
    class="text-tool-button"
    type="button"
    aria-label="撤销"
    title="撤销（⌘/Ctrl+Z）"
    :disabled="!canUndo"
    @mousedown.prevent
    @click="emit('undo')"
  >
    <AppIcon name="undo" :size="16" />
  </button>
  <button
    class="text-tool-button"
    type="button"
    aria-label="还原"
    title="还原（⌘/Ctrl+Shift+Z）"
    :disabled="!canRedo"
    @mousedown.prevent
    @click="emit('redo')"
  >
    <AppIcon name="redo" :size="16" />
  </button>
  <button
    class="text-tool-button"
    :class="{ 'is-active': findPanelOpen && findPanelMode === 'find' }"
    type="button"
    aria-label="查找"
    title="查找（⌘/Ctrl+F）"
    :disabled="disabled"
    :aria-pressed="findPanelOpen && findPanelMode === 'find'"
    @mousedown.prevent
    @click="emit('toggleFind', 'find')"
  >
    <AppIcon name="search" :size="16" />
  </button>
  <button
    class="text-tool-button"
    :class="{ 'is-active': findPanelOpen && findPanelMode === 'replace' }"
    type="button"
    aria-label="替换"
    title="替换（⌘⌥F / Ctrl+H）"
    :disabled="disabled"
    :aria-pressed="findPanelOpen && findPanelMode === 'replace'"
    @mousedown.prevent
    @click="emit('toggleFind', 'replace')"
  >
    <AppIcon name="replace" :size="16" />
  </button>
  <button
    v-if="formatVisible"
    class="text-tool-button"
    type="button"
    aria-label="一键规范格式"
    title="一键规范格式"
    :disabled="formatDisabled"
    @mousedown.prevent
    @click="emit('format')"
  >
    <AppIcon name="wand" :size="16" />
  </button>
</template>

<style scoped>
.text-tool-button {
  display: grid;
  place-items: center;
  width: 27px;
  height: 27px;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  flex-shrink: 0;
}
.text-tool-button:hover {
  background: var(--surface-hover);
  color: var(--neutral-solid);
}
.text-tool-button.is-active {
  background: var(--surface-selected);
  color: var(--accent);
}
.text-tool-button:disabled {
  color: var(--text-tertiary);
  cursor: default;
  opacity: 0.42;
}
.text-tool-button:disabled:hover {
  background: transparent;
  color: var(--text-tertiary);
}
.text-tool-button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
</style>
