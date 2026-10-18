<script setup lang="ts">
import { nextTick, onMounted } from "vue";
import type { EditorEntrySearchResult } from "../types/editorEntrySearch";
import AppIcon from "./AppIcon.vue";
import EditorEntrySearchRow from "./EditorEntrySearchRow.vue";

defineProps<{
  findPanelMode: "find" | "replace";
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
onMounted(async () => {
  await nextTick();
  findInput.value?.focus({ preventScroll: true });
  findInput.value?.select();
});
</script>

<template>
  <div
    ref="findPanelElement"
    class="editor-find-panel"
    role="dialog"
    :aria-label="findPanelMode === 'replace' ? '查找和替换' : '查找文字'"
    @keydown.esc.stop="emit('close')"
  >
    <div class="editor-find-row">
      <label class="editor-find-field">
        <AppIcon name="search" :size="14" />
        <input
          ref="findInput"
          :value="searchQuery"
          type="text"
          aria-label="查找文字"
          placeholder="查找"
          @input="
            emit(
              'update:searchQuery',
              ($event.target as HTMLInputElement).value
            );
            emit('findInput');
          "
          @keydown.enter.prevent="emit('findMatch', $event.shiftKey ? -1 : 1)"
        />
        <span class="editor-find-count" aria-live="polite">
          {{ searchResultLabel }}
        </span>
      </label>
      <button
        class="editor-find-icon-button is-previous"
        type="button"
        aria-label="查找上一个"
        title="查找上一个"
        @click="emit('findMatch', -1)"
      >
        <AppIcon name="chevron" :size="14" />
      </button>
      <button
        class="editor-find-icon-button"
        type="button"
        aria-label="查找下一个"
        title="查找下一个"
        @click="emit('findMatch', 1)"
      >
        <AppIcon name="chevron" :size="14" />
      </button>
      <button
        class="editor-find-icon-button"
        type="button"
        aria-label="关闭查找"
        title="关闭"
        @click="emit('close')"
      >
        <AppIcon name="close" :size="14" />
      </button>
    </div>
    <div v-if="findPanelMode === 'replace'" class="editor-replace-row">
      <label class="editor-find-field">
        <AppIcon name="replace" :size="14" />
        <input
          :value="replacementText"
          type="text"
          aria-label="替换为"
          placeholder="替换为"
          :disabled="currentReadOnly"
          @input="
            emit(
              'update:replacementText',
              ($event.target as HTMLInputElement).value
            )
          "
          @keydown.enter.prevent="emit('replaceCurrent')"
        />
      </label>
      <button
        class="editor-find-action"
        type="button"
        :disabled="currentReadOnly"
        @click="emit('replaceCurrent')"
      >
        替换
      </button>
      <button
        class="editor-find-action"
        type="button"
        :disabled="currentReadOnly"
        @click="emit('replaceAll')"
      >
        全部
      </button>
    </div>
    <EditorEntrySearchRow
      :query="entrySearchQuery"
      :results="entrySearchResults"
      :active-index="activeEntrySearchIndex"
      :pending="entrySearchPending"
      :result-label="entrySearchResultLabel"
      @update:query="emit('update:entrySearchQuery', $event)"
      @input="emit('entrySearchInput')"
      @move="emit('moveEntrySearch', $event)"
      @select="emit('selectEntrySearch', $event)"
    />
  </div>
</template>
