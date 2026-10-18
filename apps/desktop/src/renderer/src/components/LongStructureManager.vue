<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type {
  LongWorkspaceIndexSnapshot,
  LongWorkspaceOperationBatch,
  LongWorldbuildingItemLayout
} from "@deepwrite/contracts";
import { uiMessage } from "../ui-feedback";
import { useLongStructureDeleteConfirmation } from "../composables/useLongStructureDeleteConfirmation";
import {
  useLongStructureForm,
  type LongFoundationSection
} from "../composables/useLongStructureForm";
import {
  useLongStructureMutation,
  type LongStructureMutationSurface
} from "../composables/useLongStructureMutation";
import { useLongAgentsMdEditor } from "../composables/useLongAgentsMdEditor";
import { useLongWorldbuildingSync } from "../composables/useLongWorldbuildingSync";
import {
  createLongStructureMutationBuilder,
  type LongStructureMutationBuilder
} from "../types/longStructureMutations";
import type {
  LongStructureMutationCompletion,
  LongWorldbuildingSyncCompletion,
  LongWorldbuildingSyncRequest
} from "../types/longWorkspace";
import type { LongWorldbuildingSyncBookOption } from "../utils/longWorldbuildingSync";
import type { PopupSelectValue } from "./PopupSelect.vue";
import LongStructureFeatureSettings from "./LongStructureFeatureSettings.vue";
import LongAgentsMdEditor from "./LongAgentsMdEditor.vue";
import LongStructureFormDialog from "./LongStructureFormDialog.vue";
import LongStructureDeleteDialog from "./LongStructureDeleteDialog.vue";
import LongWorldbuildingSyncDialog from "./LongWorldbuildingSyncDialog.vue";

type StructurePanel = "foundation" | "features" | "agents";
const props = withDefaults(
  defineProps<{
    snapshot: LongWorkspaceIndexSnapshot;
    currentBookId?: string | null | undefined;
    agentsMd?: string | null | undefined;
    agentsMdPending?: boolean;
    syncBookOptions?: readonly LongWorldbuildingSyncBookOption[] | undefined;
    disabled?: boolean;
    previewError?: string | null;
  }>(),
  {
    currentBookId: null,
    agentsMd: null,
    agentsMdPending: false,
    syncBookOptions: () => [],
    disabled: false,
    previewError: null
  }
);
const emit = defineEmits<{
  mutation: [
    batch: LongWorkspaceOperationBatch,
    completion: LongStructureMutationCompletion
  ];
  syncWorldbuilding: [
    payload: LongWorldbuildingSyncRequest,
    completion: LongWorldbuildingSyncCompletion
  ];
  saveAgentsMd: [content: string, completion: LongStructureMutationCompletion];
  modalActiveChange: [active: boolean];
}>();
const panelOptions: ReadonlyArray<{
  value: StructurePanel;
  label: string;
  description: string;
}> = [
  { value: "agents", label: "主智能体上下文", description: "五阶段作用说明" },
  { value: "foundation", label: "基础结构", description: "世界观分类" },
  { value: "features", label: "功能配置", description: "世界观条目样式" }
];
const activePanel = ref<StructurePanel>("foundation");
const activeFoundationSection = ref<LongFoundationSection>("worldbuilding");
const mutations = useLongStructureMutation({
  locked: () => props.disabled || deleteSubmitting.value,
  onApplied(surface) {
    if (surface === "form") form.resetFormAfterApply();
    else if (surface === "sync") sync.resetSync();
  }
});
const { pendingMutation, mutationLocked } = mutations;
const {
  pendingDelete,
  moveCharactersToTypeId,
  characterTypeDeleteMode,
  submitting: deleteSubmitting,
  deletingCharacterCount,
  deletingLastCharacterType,
  characterTypeMoveOptions,
  pendingWorldbuildingDeleteDescription,
  openDelete,
  closeDelete,
  setMoveCharactersToTypeId,
  setCharacterTypeDeleteMode,
  confirmDelete
} = useLongStructureDeleteConfirmation({
  snapshot: computed(() => props.snapshot),
  locked: () => props.disabled || pendingMutation.value !== null,
  mutate: (batch, completion) => emit("mutation", batch, completion),
  notify: uiMessage
});
const form = useLongStructureForm({
  snapshot: () => props.snapshot,
  section: activeFoundationSection,
  mutations,
  emitMutation,
  applyMutationBatch,
  notify: uiMessage
});
const {
  formOpen,
  formMode,
  draft,
  rows,
  formTitle,
  pendingFormImpact,
  openCreate,
  openEdit,
  closeForm,
  submitForm,
  canMove,
  reorder
} = form;
const sync = useLongWorldbuildingSync({
  books: () => props.syncBookOptions,
  currentBookId: () => props.currentBookId,
  mutations,
  sync: (request, completion) => emit("syncWorldbuilding", request, completion),
  notify: uiMessage
});
const {
  syncOpen,
  selectedSyncBookId,
  syncPreparedChange,
  openSync,
  closeSync,
  setSyncBook,
  confirmSync
} = sync;
const {
  agentsMdDraft,
  agentsMdDirty,
  agentsMdCharacterCount,
  agentsMdOverLimit,
  saveAgentsMd,
  flushAgentsMdIfNeeded
} = useLongAgentsMdEditor({
  content: () => props.agentsMd,
  pending: () => props.agentsMdPending,
  active: () => activePanel.value === "agents",
  mutations,
  save: (content, completion) => emit("saveAgentsMd", content, completion),
  notify: uiMessage
});
const activeModal = computed<"form" | "sync" | "delete" | null>(() =>
  formOpen.value
    ? "form"
    : syncOpen.value
      ? "sync"
      : pendingDelete.value
        ? "delete"
        : null
);
watch(
  () => props.previewError,
  (message) => {
    if (message) uiMessage.warning(message);
  }
);
watch(
  () => activeModal.value !== null,
  (active) => emit("modalActiveChange", active),
  { immediate: true }
);

function setPanel(panel: StructurePanel): void {
  if (panel === activePanel.value || mutationLocked.value) return;
  void (async () => {
    if (!(await flushAgentsMdIfNeeded())) return;
    closeForm();
    closeDelete();
    closeSync();
    activePanel.value = panel;
  })();
}
function setFoundationSection(section: LongFoundationSection): void {
  if (section === activeFoundationSection.value || mutationLocked.value) return;
  closeForm();
  closeDelete();
  closeSync();
  activeFoundationSection.value = section;
}
function setFormat(value: PopupSelectValue): void {
  if (value === "list" || value === "text") draft.format = value;
}
function setItemLayout(
  key:
    | "worldbuildingItemLayout"
    | "characterAndContinuityItemLayout"
    | "plotItemLayout",
  value: PopupSelectValue
): void {
  if (
    (value !== "top-tabs" && value !== "right-list" && value !== "left-tree") ||
    value === props.snapshot.featureSettings[key]
  )
    return;
  emitMutation((builder) =>
    builder.updateFeatureSettings({
      [key]: value as LongWorldbuildingItemLayout
    })
  );
}
function emitMutation(
  build: (builder: LongStructureMutationBuilder) => LongWorkspaceOperationBatch,
  surface: LongStructureMutationSurface = "background"
): boolean {
  if (mutationLocked.value) return false;
  try {
    return applyMutationBatch(
      build(createLongStructureMutationBuilder(props.snapshot)),
      surface
    );
  } catch (error) {
    uiMessage.warning(
      error instanceof Error ? error.message : "无法生成小说结构变更。"
    );
    return false;
  }
}
function applyMutationBatch(
  batch: LongWorkspaceOperationBatch,
  surface: LongStructureMutationSurface
): boolean {
  const id = mutations.begin(surface);
  if (id === null) return false;
  emit("mutation", batch, {
    succeed: () => {
      mutations.finish(id, "succeeded");
    },
    fail: (_message, changedImpact) => {
      if (mutations.finish(id, "failed") && surface === "form" && changedImpact)
        form.capturePendingFormImpact(batch, changedImpact);
    },
    appliedButRefreshFailed: () => {
      mutations.finish(id, "applied-refresh-failed");
    }
  });
  return true;
}
defineExpose({ flushAgentsMdIfNeeded });
</script>

<template>
  <section class="long-structure-manager" aria-label="结构管理">
    <header class="manager-header">
      <div>
        <p class="manager-eyebrow">NOVEL STRUCTURE</p>
        <h2>结构管理</h2>
        <p>
          在这里管理世界观分类、人物类型、功能配置和主智能体上下文；具体内容请在对应创作空间编辑。
        </p>
      </div>
    </header>

    <div class="structure-panel-tabs" role="tablist" aria-label="结构管理分区">
      <button
        v-for="panel in panelOptions"
        :id="`long-structure-panel-${panel.value}`"
        :key="panel.value"
        class="structure-panel-tab"
        type="button"
        role="tab"
        :aria-selected="activePanel === panel.value"
        :aria-controls="`long-structure-panel-content-${panel.value}`"
        :disabled="mutationLocked"
        @click="setPanel(panel.value)"
      >
        <strong>{{ panel.label }}</strong>
        <span>{{ panel.description }}</span>
      </button>
    </div>

    <div
      v-if="activePanel === 'foundation'"
      id="long-structure-panel-content-foundation"
      class="structure-panel-content"
      role="tabpanel"
      aria-labelledby="long-structure-panel-foundation"
    >
      <header class="manager-toolbar">
        <div class="section-tabs" role="tablist" aria-label="基础结构类型">
          <button
            id="long-structure-section-worldbuilding"
            type="button"
            role="tab"
            :aria-selected="activeFoundationSection === 'worldbuilding'"
            :disabled="mutationLocked"
            @click="setFoundationSection('worldbuilding')"
          >
            世界观分类
          </button>
          <button
            id="long-structure-section-character-types"
            type="button"
            role="tab"
            :aria-selected="activeFoundationSection === 'characterTypes'"
            :disabled="mutationLocked"
            @click="setFoundationSection('characterTypes')"
          >
            人物类型
          </button>
        </div>
        <div class="toolbar-actions">
          <button
            v-if="activeFoundationSection === 'worldbuilding'"
            type="button"
            :disabled="mutationLocked"
            @click="openSync"
          >
            加载其他小说世界观
          </button>
          <button
            class="primary-button"
            type="button"
            :disabled="mutationLocked"
            @click="openCreate"
          >
            {{
              activeFoundationSection === "characterTypes"
                ? "新建人物类型"
                : "新建世界观分类"
            }}
          </button>
        </div>
      </header>

      <div v-if="rows.length === 0" class="manager-empty">
        <strong>
          {{
            activeFoundationSection === "characterTypes"
              ? "还没有人物类型，可先创建第一项。"
              : "还没有世界观分类，可先创建第一项。"
          }}
        </strong>
        <span>
          {{
            activeFoundationSection === "characterTypes"
              ? "人物类型只管理分类，人物内容始终使用连续文本。"
              : "创建后会生成完整稳定 ID，并带齐对应的空文件引用。"
          }}
        </span>
      </div>

      <ol v-else class="manager-list">
        <li v-for="row in rows" :key="row.id" class="manager-row">
          <div class="row-copy">
            <strong>{{ row.title }}</strong>
            <span>
              {{ row.detail }}{{ row.readOnly ? " · 迁移证据只读" : "" }}
            </span>
            <code>{{ row.id }}</code>
          </div>
          <div class="row-actions">
            <button
              type="button"
              :aria-label="`上移${row.title}`"
              title="上移"
              :disabled="mutationLocked || !canMove(row, 'up')"
              @click="reorder(row, 'up')"
            >
              ↑
            </button>
            <button
              type="button"
              :aria-label="`下移${row.title}`"
              title="下移"
              :disabled="mutationLocked || !canMove(row, 'down')"
              @click="reorder(row, 'down')"
            >
              ↓
            </button>
            <button
              type="button"
              :aria-label="`编辑${row.title}`"
              :disabled="mutationLocked || row.readOnly"
              @click="openEdit(row)"
            >
              编辑
            </button>
            <button
              class="delete-button"
              type="button"
              :aria-label="`删除${row.title}`"
              :disabled="mutationLocked || row.readOnly"
              @click="openDelete(row)"
            >
              删除
            </button>
          </div>
        </li>
      </ol>

      <p class="manager-footnote">
        {{
          activeFoundationSection === "characterTypes"
            ? "排序只调整人物类型的展示顺序；人物仍保留核心档案和人物关系两份文本文档。"
            : "排序只调整世界观分类的展示顺序，不会改动分类中的现有内容。"
        }}
      </p>
    </div>

    <LongStructureFeatureSettings
      v-else-if="activePanel === 'features'"
      :settings="snapshot.featureSettings"
      :disabled="mutationLocked"
      @update-layout="setItemLayout"
    />
    <LongAgentsMdEditor
      v-else
      v-model="agentsMdDraft"
      :character-count="agentsMdCharacterCount"
      :locked="mutationLocked"
      :pending="agentsMdPending"
      :dirty="agentsMdDirty"
      :over-limit="agentsMdOverLimit"
      :saving="pendingMutation?.surface === 'agents'"
      @save="saveAgentsMd"
    />
    <LongStructureFormDialog
      :open="activeModal === 'form'"
      :title="formTitle"
      :mode="formMode"
      :draft="draft"
      :worldbuilding="activeFoundationSection === 'worldbuilding'"
      :locked="mutationLocked"
      :pending="pendingMutation?.surface === 'form'"
      :impact="pendingFormImpact"
      @close="closeForm"
      @submit="submitForm"
      @update-format="setFormat"
    />
    <LongWorldbuildingSyncDialog
      :open="activeModal === 'sync'"
      :current-book-id="currentBookId"
      :selected-book-id="selectedSyncBookId"
      :book-options="syncBookOptions"
      :prepared="syncPreparedChange"
      :locked="mutationLocked"
      :pending="pendingMutation?.surface === 'sync'"
      @close="closeSync"
      @confirm="confirmSync"
      @update:selected-book-id="setSyncBook"
    />

    <LongStructureDeleteDialog
      :open="activeModal === 'delete'"
      :target="pendingDelete"
      :locked="mutationLocked"
      :pending="deleteSubmitting"
      :worldbuilding-fallback="pendingWorldbuildingDeleteDescription"
      :character-count="deletingCharacterCount"
      :last-character-type="deletingLastCharacterType"
      :character-delete-mode="characterTypeDeleteMode"
      :move-target-id="moveCharactersToTypeId"
      :move-options="characterTypeMoveOptions"
      @close="closeDelete"
      @confirm="confirmDelete"
      @update:character-delete-mode="setCharacterTypeDeleteMode"
      @update:move-target-id="setMoveCharactersToTypeId"
    />
  </section>
</template>
<style scoped src="./LongStructureControls.css"></style>
<style scoped src="./LongStructureManager.css"></style>
