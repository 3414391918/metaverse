<script setup lang="ts">
import type { LongWorldbuildingFormat } from "@deepwrite/contracts";
import type { PendingLongStructureFormImpact } from "../composables/useLongStructureFormImpact";
import PopupSelect, {
  type PopupSelectValue,
  type PopupSelectOption
} from "./PopupSelect.vue";
import LongImpactConfirmationDetails from "./LongImpactConfirmationDetails.vue";
defineProps<{
  open: boolean;
  title: string;
  mode: "create" | "edit";
  draft: { title: string; format: LongWorldbuildingFormat };
  worldbuilding: boolean;
  locked: boolean;
  pending: boolean;
  impact: PendingLongStructureFormImpact | null;
}>();
const emit = defineEmits<{
  close: [];
  submit: [];
  updateFormat: [value: PopupSelectValue];
}>();
const formatOptions: readonly PopupSelectOption[] = [
  { value: "list", label: "条目列表" },
  { value: "text", label: "连续文本" }
];
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="dialog-backdrop structure-modal-overlay"
      @mousedown.self="emit('close')"
      @keydown.esc.stop="emit('close')"
    >
      <section
        class="structure-modal"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
      >
        <form @submit.prevent="emit('submit')">
          <header class="modal-header">
            <div>
              <span>{{ mode === "create" ? "CREATE" : "EDIT" }}</span>
              <h3>{{ title }}</h3>
            </div>
            <button
              class="close-button"
              type="button"
              aria-label="关闭"
              :disabled="locked"
              @click="emit('close')"
            >
              ×
            </button>
          </header>

          <fieldset class="modal-body" :disabled="locked">
            <label class="form-field">
              <span>标题</span>
              <input
                v-model="draft.title"
                maxlength="256"
                autocomplete="off"
                autofocus
                required
              />
            </label>

            <label v-if="worldbuilding" class="form-field">
              <span>内容格式</span>
              <PopupSelect
                :model-value="draft.format"
                :options="formatOptions"
                accessible-label="选择世界观内容格式"
                :menu-z-index="2300"
                @update:model-value="emit('updateFormat', $event)"
              />
            </label>
            <LongImpactConfirmationDetails
              v-if="impact"
              :confirmation="impact.confirmation"
              fallback="格式转换不会删除现有从属内容。"
            />
          </fieldset>

          <footer class="modal-actions">
            <button type="button" :disabled="locked" @click="emit('close')">
              取消
            </button>
            <button class="primary-button" type="submit" :disabled="locked">
              {{
                pending
                  ? "保存中…"
                  : impact
                    ? "确认按上述影响转换并保存"
                    : mode === "create"
                      ? "创建"
                      : "保存修改"
              }}
            </button>
          </footer>
        </form>
      </section>
    </div>
  </Teleport>
</template>
<style scoped src="./LongStructureControls.css"></style>
<style scoped src="./LongStructureFormDialog.css"></style>
