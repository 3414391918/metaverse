<script setup lang="ts">
import EditorTextTools from "./EditorTextTools.vue";
import LongEditorFindReplaceBar from "./LongEditorFindReplaceBar.vue";
import type { EditorEntrySearchResult } from "../types/editorEntrySearch";

defineProps<{
  canUndo: boolean;
  canRedo: boolean;
  canUseTextTools: boolean;
  findPanelOpen: boolean;
  findPanelMode: "find" | "replace";
  formatVisible: boolean;
  formatDisabled: boolean;
  searchQuery: string;
  replacementText: string;
  searchResultLabel: string;
  currentReadOnly: boolean;
  entrySearchQuery: string;
  entrySearchResults: readonly EditorEntrySearchResult[];
  activeEntrySearchIndex: number;
  entrySearchPending: boolean;
  entrySearchResultLabel: string;
}>();

const emit = defineEmits<{
  undo: [];
  redo: [];
  toggleFind: [mode: "find" | "replace"];
  format: [];
  "update:searchQuery": [value: string];
  "update:replacementText": [value: string];
  "update:entrySearchQuery": [value: string];
  findInput: [];
  findMatch: [direction: 1 | -1];
  close: [];
  replaceCurrent: [];
  replaceAll: [];
  entrySearchInput: [];
  moveEntrySearch: [direction: 1 | -1];
  selectEntrySearch: [index?: number];
}>();

const findPanelElement = defineModel<HTMLElement | null>("findPanelElement", {
  default: null
});
const findInput = defineModel<HTMLInputElement | null>("findInput", {
  default: null
});
</script>

<template>
  <EditorTextTools
    :can-undo="canUndo"
    :can-redo="canRedo"
    :disabled="!canUseTextTools"
    :find-panel-open="findPanelOpen"
    :find-panel-mode="findPanelMode"
    :format-visible="formatVisible"
    :format-disabled="formatDisabled"
    @undo="emit('undo')"
    @redo="emit('redo')"
    @toggle-find="emit('toggleFind', $event)"
    @format="emit('format')"
  />

  <LongEditorFindReplaceBar
    v-if="findPanelOpen"
    v-model:find-panel-element="findPanelElement"
    v-model:find-input="findInput"
    :find-panel-mode="findPanelMode"
    :search-query="searchQuery"
    :replacement-text="replacementText"
    :search-result-label="searchResultLabel"
    :current-read-only="currentReadOnly"
    :entry-search-query="entrySearchQuery"
    :entry-search-results="entrySearchResults"
    :active-entry-search-index="activeEntrySearchIndex"
    :entry-search-pending="entrySearchPending"
    :entry-search-result-label="entrySearchResultLabel"
    @update:search-query="emit('update:searchQuery', $event)"
    @update:replacement-text="emit('update:replacementText', $event)"
    @update:entry-search-query="emit('update:entrySearchQuery', $event)"
    @find-input="emit('findInput')"
    @find-match="emit('findMatch', $event)"
    @close="emit('close')"
    @replace-current="emit('replaceCurrent')"
    @replace-all="emit('replaceAll')"
    @entry-search-input="emit('entrySearchInput')"
    @move-entry-search="emit('moveEntrySearch', $event)"
    @select-entry-search="emit('selectEntrySearch', $event)"
  />
</template>
