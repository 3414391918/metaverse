<script setup lang="ts">
import RightEditorPane from "./RightEditorPane.vue";
import AppIcon from "./AppIcon.vue";
type EditorProps = InstanceType<typeof RightEditorPane>["$props"];
defineProps<{
  editor: Readonly<
    Pick<
      EditorProps,
      | "document"
      | "resourceId"
      | "draftState"
      | "locateReference"
      | "locked"
      | "lockedLabel"
      | "saving"
      | "manualSaving"
      | "autoSaveEnabled"
      | "defaultViewMode"
      | "boundToCurrentBook"
      | "entrySearchItems"
    >
  >;
  leftCollapsed: boolean;
}>();
const emit = defineEmits<{
  expandLeft: [];
  save: [payload: { id: string; title: string; content: string }];
  liveChange: [payload: { id: string; title: string; content: string }];
  selectEntrySearchResult: [documentId: string];
  prepareEntrySearch: [];
}>();
</script>
<template>
  <button
    v-if="leftCollapsed"
    class="icon-button manual-expand-sidebar"
    type="button"
    aria-label="展开左侧栏"
    @click="emit('expandLeft')"
  >
    <AppIcon name="panel-left" :size="18" />
  </button>
  <RightEditorPane
    v-bind="editor"
    :right-pane="false"
    :right-pane-collapsed="false"
    @save="emit('save', $event)"
    @live-change="emit('liveChange', $event)"
    @select-entry-search-result="emit('selectEntrySearchResult', $event)"
    @prepare-entry-search="emit('prepareEntrySearch')"
  />
</template>
