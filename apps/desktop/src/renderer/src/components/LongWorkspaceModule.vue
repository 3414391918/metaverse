<script setup lang="ts">
import type {
  LongArcId,
  LongBookSummary,
  LongChapterCardId,
  LongCharacterId,
  LongWorkspaceImpactConfirmation,
  LongWorkspaceIndexSnapshot,
  LongWorkspaceOperationBatch,
  LongWriteDocumentResult,
  TextViewMode
} from "@deepwrite/contracts";
import { useLongWorkspaceModuleEditorBridge } from "../composables/useLongWorkspaceModuleEditorBridge";
import type { LongWorkspaceEditorPort } from "../composables/useLongWorkspaceSessionCoordinator";
import type { LongWorkspaceFileContext } from "../stores/longWorkspaceStore";
import type {
  LongStructureMutationCompletion,
  LongWorkspaceSelection
} from "../types/longWorkspace";
import { uiMessage } from "../ui-feedback";
import AppIcon from "./AppIcon.vue";
import LongWorkspaceEditor from "./LongWorkspaceEditor.vue";

defineProps<{
  book: LongBookSummary | null;
  selection: LongWorkspaceSelection | null;
  workspaceIndex: LongWorkspaceIndexSnapshot | null;
  editorLocked: boolean;
  editorLockedReason: string | undefined;
  loading: boolean;
  leftCollapsed: boolean;
  defaultTextViewMode: TextViewMode;
}>();

const emit = defineEmits<{
  editorPortChange: [port: LongWorkspaceEditorPort | null];
  expandLeft: [];
  saved: [result: LongWriteDocumentResult];
  contextChange: [context: LongWorkspaceFileContext | null];
  selectCharacter: [
    characterId: LongCharacterId,
    done?: (accepted: boolean) => void
  ];
  selectPlotPoint: [plotPointId: LongArcId];
  selectChapterCard: [chapterCardId: LongChapterCardId];
  selectEntrySearchResult: [fileId: string];
  renameCharacter: [
    input: { characterId: LongCharacterId; name: string },
    completion: (succeeded: boolean) => void
  ];
  renameStructureTitle: [
    input: {
      kind: "worldbuilding" | "volume" | "plotPoint" | "chapterCard";
      id: string;
      title: string;
    },
    completion: (succeeded: boolean) => void
  ];
  createCharacter: [];
  createWorldbuildingItem: [];
  createPlotPoint: [];
  createChapterCard: [];
  createVolume: [];
  previewDeleteStructure: [
    input: {
      kind: "character" | "volume" | "plotPoint" | "chapterCard";
      id: string;
      title: string;
    },
    completion: (impact?: LongWorkspaceImpactConfirmation) => void
  ];
  deleteStructure: [
    input: {
      kind: "character" | "volume" | "plotPoint" | "chapterCard";
      id: string;
      title: string;
      expectedImpact: LongWorkspaceImpactConfirmation;
    },
    completion: (
      succeeded: boolean,
      changedImpact?: LongWorkspaceImpactConfirmation
    ) => void
  ];
  saveVolumeOutline: [
    input: { volumeId: string; outline: string },
    completion: (succeeded: boolean) => void
  ];
  savePlotPointContent: [
    input: {
      plotPointId: LongArcId;
      field: "summary";
      content: string;
    },
    completion: (succeeded: boolean) => void
  ];
  mutation: [
    batch: LongWorkspaceOperationBatch,
    completion: LongStructureMutationCompletion
  ];
  previewMutation: [
    batch: LongWorkspaceOperationBatch,
    completion: (impact?: LongWorkspaceImpactConfirmation) => void
  ];
}>();

const { captureEditorPort } = useLongWorkspaceModuleEditorBridge({
  publish: (port) => emit("editorPortChange", port),
  warn: (message) => uiMessage.warning(message)
});

function forwardSelectCharacter(
  characterId: LongCharacterId,
  done?: (accepted: boolean) => void
): void {
  emit("selectCharacter", characterId, done);
}

function forwardRenameCharacter(
  input: { characterId: LongCharacterId; name: string },
  completion: (succeeded: boolean) => void
): void {
  emit("renameCharacter", input, completion);
}

function forwardRenameStructureTitle(
  input: {
    kind: "worldbuilding" | "volume" | "plotPoint" | "chapterCard";
    id: string;
    title: string;
  },
  completion: (succeeded: boolean) => void
): void {
  emit("renameStructureTitle", input, completion);
}

function forwardDeleteStructure(
  input: {
    kind: "character" | "volume" | "plotPoint" | "chapterCard";
    id: string;
    title: string;
    expectedImpact: LongWorkspaceImpactConfirmation;
  },
  completion: (
    succeeded: boolean,
    changedImpact?: LongWorkspaceImpactConfirmation
  ) => void
): void {
  emit("deleteStructure", input, completion);
}

function forwardPreviewDeleteStructure(
  input: {
    kind: "character" | "volume" | "plotPoint" | "chapterCard";
    id: string;
    title: string;
  },
  completion: (impact?: LongWorkspaceImpactConfirmation) => void
): void {
  emit("previewDeleteStructure", input, completion);
}

function forwardSaveVolumeOutline(
  input: { volumeId: string; outline: string },
  completion: (succeeded: boolean) => void
): void {
  emit("saveVolumeOutline", input, completion);
}

function forwardSavePlotPointContent(
  input: {
    plotPointId: LongArcId;
    field: "summary";
    content: string;
  },
  completion: (succeeded: boolean) => void
): void {
  emit("savePlotPointContent", input, completion);
}

function forwardMutation(
  batch: LongWorkspaceOperationBatch,
  completion: LongStructureMutationCompletion
): void {
  emit("mutation", batch, completion);
}

function forwardPreviewMutation(
  batch: LongWorkspaceOperationBatch,
  completion: (impact?: LongWorkspaceImpactConfirmation) => void
): void {
  emit("previewMutation", batch, completion);
}
</script>

<template>
  <template v-if="book">
    <button
      v-if="leftCollapsed"
      class="icon-button manual-expand-sidebar"
      type="button"
      aria-label="展开左侧栏"
      @click="emit('expandLeft')"
    >
      <AppIcon name="panel-left" :size="18" />
    </button>
    <template v-if="workspaceIndex">
      <LongWorkspaceEditor
        :ref="captureEditorPort"
        :book-id="book.id"
        :selection="selection"
        :workspace-index="workspaceIndex"
        :locked="editorLocked"
        :locked-reason="editorLockedReason"
        :right-pane="false"
        :right-pane-collapsed="false"
        :default-view-mode="defaultTextViewMode"
        @saved="emit('saved', $event)"
        @context-change="emit('contextChange', $event)"
        @select-character="forwardSelectCharacter"
        @select-plot-point="emit('selectPlotPoint', $event)"
        @select-chapter-card="emit('selectChapterCard', $event)"
        @select-entry-search-result="emit('selectEntrySearchResult', $event)"
        @rename-character="forwardRenameCharacter"
        @rename-structure-title="forwardRenameStructureTitle"
        @create-character="emit('createCharacter')"
        @create-worldbuilding-item="emit('createWorldbuildingItem')"
        @create-plot-point="emit('createPlotPoint')"
        @create-chapter-card="emit('createChapterCard')"
        @create-volume="emit('createVolume')"
        @preview-delete-structure="forwardPreviewDeleteStructure"
        @delete-structure="forwardDeleteStructure"
        @save-volume-outline="forwardSaveVolumeOutline"
        @save-plot-point-content="forwardSavePlotPointContent"
        @preview-mutation="forwardPreviewMutation"
        @mutation="forwardMutation"
      />
    </template>
    <div v-else class="manual-workspace-empty">
      {{ loading ? "正在读取小说…" : "请选择创作空间中的内容。" }}
    </div>
  </template>
  <div v-else class="manual-workspace-empty">
    {{ loading ? "正在读取小说…" : "请从左侧打开一本小说。" }}
  </div>
</template>
