<script setup lang="ts">
import { onBeforeUnmount } from "vue";
import type {
  BookResourceDialogMode,
  CatalogResourceNodeActionPayload,
  CatalogLibraryEntryDragPayload,
  DialogMode,
  LongBookResourceNodeActionPayload,
  LongTreeItemAction,
  ResourceSectionActionPayload,
  ResourceTreeNode,
  ResourceTreeSection
} from "../types/workspace";
import AppIcon from "./AppIcon.vue";
import SidebarResourceList from "./SidebarResourceList.vue";
import SidebarProfileMenu from "./SidebarProfileMenu.vue";
import { createTransientScrollbarController } from "../utils/transientScrollbar";

const props = defineProps<{
  sections: ResourceTreeSection[];
  selectedId: string;
  libraryEntryClipboardDomain?: "skill" | "material" | undefined;
  activePrimaryFeature: PrimaryFeatureId | undefined;
  longTreeActionsDisabled?: boolean;
}>();

const emit = defineEmits<{
  collapse: [];
  createBook: [];
  openDialog: [mode: DialogMode];
  openSettings: [];
  selectResource: [node: ResourceTreeNode];
  bookAction: [mode: BookResourceDialogMode, node: ResourceTreeNode];
  exportBook: [node: ResourceTreeNode];
  longBookAction: [payload: LongBookResourceNodeActionPayload];
  resourceAction: [payload: ResourceSectionActionPayload];
  resourceNodeAction: [payload: CatalogResourceNodeActionPayload];
  moveLibraryEntry: [payload: CatalogLibraryEntryDragPayload];
  createExpertSection: [node: ResourceTreeNode];
  createLongDraftSection: [node: ResourceTreeNode];
  longDraftSectionAction: [
    action: "move-up" | "move-down" | "delete",
    node: ResourceTreeNode
  ];
  createLongTreeItem: [node: ResourceTreeNode];
  longTreeItemAction: [action: LongTreeItemAction, node: ResourceTreeNode];
  deleteLongLedgerCommit: [node: ResourceTreeNode];
  removeExpertSection: [node: ResourceTreeNode];
  expertSectionAction: [
    action: "move-up" | "move-down",
    node: ResourceTreeNode
  ];
  createCharacterItem: [node: ResourceTreeNode];
  characterItemAction: [
    action: "rename" | "move-up" | "move-down" | "delete",
    node: ResourceTreeNode
  ];
}>();

const sidebarScrollbar = createTransientScrollbarController();
function handleSidebarScroll(event: Event): void {
  const element = event.currentTarget;
  if (element instanceof HTMLElement) sidebarScrollbar.reveal(element);
}
onBeforeUnmount(() => sidebarScrollbar.dispose());
const newBookItem = {
  id: "create-book",
  label: "新建书籍",
  icon: "plus",
  shortcut: "Ctrl N"
} as const;

type PrimaryFeatureId = DialogMode | "agent-teams";

const navItems: Array<{
  id: PrimaryFeatureId;
  label: string;
  icon: "wand" | "file" | "mic" | "folder";
}> = [
  { id: "assistant", label: "万能助手", icon: "wand" },
  { id: "resources", label: "资源管理", icon: "folder" },
  { id: "prompt-templates", label: "提示词模板", icon: "file" },
  { id: "tools", label: "工具管理", icon: "wand" },
  { id: "voice-manager", label: "声音管理", icon: "mic" }
];
function activateNav(id: "create-book" | PrimaryFeatureId): void {
  if (id === "create-book") {
    emit("createBook");
    return;
  }
  if (id === "agent-teams") return;
  emit("openDialog", id);
}
</script>

<template>
  <aside class="left-sidebar" aria-label="元宇宙导航与资源树">
    <header class="sidebar-brand-row">
      <button class="brand-button" type="button">
        <span class="brand-mark"><AppIcon name="logo" :size="19" /></span>
        <span class="brand-name">元宇宙</span>
      </button>
      <button
        class="icon-button"
        type="button"
        aria-label="收起左侧栏"
        @click="emit('collapse')"
      >
        <AppIcon name="panel-left" :size="18" />
      </button>
    </header>

    <nav class="primary-nav new-book-nav" aria-label="新建书籍">
      <button
        class="nav-row"
        type="button"
        :data-nav-id="newBookItem.id"
        @click="activateNav(newBookItem.id)"
      >
        <AppIcon :name="newBookItem.icon" :size="17" />
        <span>{{ newBookItem.label }}</span>
        <kbd>{{ newBookItem.shortcut }}</kbd>
      </button>
    </nav>

    <div
      class="sidebar-scroll transient-scrollbar"
      @scroll.passive="handleSidebarScroll"
    >
      <nav class="primary-nav scrollable-primary-nav" aria-label="主要功能">
        <button
          v-for="item in navItems"
          :key="item.id"
          class="nav-row"
          :class="{ 'is-active': item.id === props.activePrimaryFeature }"
          type="button"
          :data-nav-id="item.id"
          :aria-current="
            item.id === props.activePrimaryFeature ? 'page' : undefined
          "
          @click="activateNav(item.id)"
        >
          <AppIcon :name="item.icon" :size="17" />
          <span>{{ item.label }}</span>
        </button>
      </nav>

      <SidebarResourceList
        :sections="sections"
        :selected-id="selectedId"
        :long-tree-actions-disabled="longTreeActionsDisabled"
        :library-entry-clipboard-domain="libraryEntryClipboardDomain"
        @select-resource="emit('selectResource', $event)"
        @book-action="(mode, book) => emit('bookAction', mode, book)"
        @export-book="emit('exportBook', $event)"
        @long-book-action="emit('longBookAction', $event)"
        @resource-action="emit('resourceAction', $event)"
        @resource-node-action="emit('resourceNodeAction', $event)"
        @move-library-entry="emit('moveLibraryEntry', $event)"
        @create-expert-section="emit('createExpertSection', $event)"
        @create-long-draft-section="emit('createLongDraftSection', $event)"
        @long-draft-section-action="
          (action, sectionNode) =>
            emit('longDraftSectionAction', action, sectionNode)
        "
        @create-long-tree-item="emit('createLongTreeItem', $event)"
        @long-tree-item-action="
          (action, itemNode) => emit('longTreeItemAction', action, itemNode)
        "
        @delete-long-ledger-commit="emit('deleteLongLedgerCommit', $event)"
        @remove-expert-section="emit('removeExpertSection', $event)"
        @expert-section-action="
          (action, sectionNode) =>
            emit('expertSectionAction', action, sectionNode)
        "
        @create-character-item="emit('createCharacterItem', $event)"
        @character-item-action="
          (action, itemNode) => emit('characterItemAction', action, itemNode)
        "
      />
    </div>

    <SidebarProfileMenu @open-settings="emit('openSettings')" />
  </aside>
</template>
