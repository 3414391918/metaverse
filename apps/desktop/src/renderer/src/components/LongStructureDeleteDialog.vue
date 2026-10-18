<script setup lang="ts">
import type { LongWorkspaceImpactConfirmation } from "@deepwrite/contracts";
import LongImpactConfirmationDetails from "./LongImpactConfirmationDetails.vue";
import PopupSelect, {
  type PopupSelectOption,
  type PopupSelectValue
} from "./PopupSelect.vue";

interface DeleteTarget {
  kind: "worldbuilding" | "characterType";
  title: string;
  previewPending: boolean;
  expectedImpact?: LongWorkspaceImpactConfirmation;
}

withDefaults(
  defineProps<{
    open: boolean;
    target: DeleteTarget | null;
    locked?: boolean;
    pending?: boolean;
    worldbuildingFallback?: string;
    characterCount?: number;
    lastCharacterType?: boolean;
    characterDeleteMode?: "move" | "cascade";
    moveTargetId?: string;
    moveOptions?: readonly PopupSelectOption[];
  }>(),
  {
    locked: false,
    pending: false,
    worldbuildingFallback: "",
    characterCount: 0,
    lastCharacterType: false,
    characterDeleteMode: "move",
    moveTargetId: "",
    moveOptions: () => []
  }
);

const emit = defineEmits<{
  close: [];
  confirm: [];
  "update:characterDeleteMode": [mode: "move" | "cascade"];
  "update:moveTargetId": [value: PopupSelectValue];
}>();
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open && target"
      class="dialog-backdrop delete-overlay"
      @mousedown.self="emit('close')"
      @keydown.esc.stop="emit('close')"
    >
      <section
        class="delete-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="long-structure-delete-title"
        aria-describedby="long-structure-delete-description"
      >
        <header>
          <div>
            <span>DELETE</span>
            <h3 id="long-structure-delete-title">删除“{{ target.title }}”</h3>
          </div>
        </header>
        <fieldset :disabled="locked">
          <template v-if="target.kind === 'worldbuilding'">
            <p
              v-if="target.previewPending || !target.expectedImpact"
              id="long-structure-delete-description"
            >
              {{ worldbuildingFallback }}
            </p>
            <LongImpactConfirmationDetails
              v-else
              :confirmation="target.expectedImpact"
              fallback="该分类没有从属条目；确认后将直接删除分类及其内容文件。"
            />
          </template>
          <template v-else>
            <div
              v-if="characterCount > 0 && !lastCharacterType"
              class="delete-mode-options"
            >
              <label>
                <input
                  :checked="characterDeleteMode === 'move'"
                  type="radio"
                  name="character-type-delete-mode"
                  @change="emit('update:characterDeleteMode', 'move')"
                />
                <span>
                  <strong>迁移人物后删除类型（推荐）</strong>
                  <small>人物、档案和连续性记录都会保留。</small>
                </span>
              </label>
              <label>
                <input
                  :checked="characterDeleteMode === 'cascade'"
                  type="radio"
                  name="character-type-delete-mode"
                  @change="emit('update:characterDeleteMode', 'cascade')"
                />
                <span>
                  <strong>删除类型及关联人物</strong>
                  <small>会删除人物从属文件并清理连续性关联。</small>
                </span>
              </label>
            </div>
            <label
              v-if="
                characterCount > 0 &&
                !lastCharacterType &&
                characterDeleteMode === 'move'
              "
              class="form-field"
            >
              <span>迁移到</span>
              <PopupSelect
                :model-value="moveTargetId"
                :options="moveOptions"
                accessible-label="选择人物迁移目标类型"
                :menu-z-index="2300"
                @update:model-value="emit('update:moveTargetId', $event)"
              />
            </label>
            <p
              v-if="target.previewPending || !target.expectedImpact"
              id="long-structure-delete-description"
            >
              {{
                target.previewPending &&
                (characterDeleteMode === "cascade" || moveTargetId)
                  ? "正在核对人物迁移与删除影响…"
                  : characterDeleteMode === "move" && characterCount > 0
                    ? "请选择迁移目标；随后会展示精确影响。"
                    : "正在核对删除类型及关联人物的精确影响…"
              }}
            </p>
            <LongImpactConfirmationDetails
              v-else
              :confirmation="target.expectedImpact"
              :fallback="
                characterDeleteMode === 'move'
                  ? '人物将迁移到所选类型，人物文档保持不变。'
                  : '确认后将删除该类型。'
              "
            />
          </template>
        </fieldset>
        <footer>
          <button
            type="button"
            :disabled="locked"
            autofocus
            @click="emit('close')"
          >
            取消
          </button>
          <button
            class="danger-button"
            type="button"
            :disabled="
              locked ||
              target.previewPending ||
              !target.expectedImpact ||
              (target.kind === 'characterType' &&
                characterCount > 0 &&
                !lastCharacterType &&
                characterDeleteMode === 'move' &&
                !moveTargetId)
            "
            @click="emit('confirm')"
          >
            {{
              target.kind === "characterType"
                ? pending
                  ? "删除中…"
                  : characterCount > 0 &&
                      !lastCharacterType &&
                      characterDeleteMode === "move"
                    ? "迁移人物并删除"
                    : characterCount > 0
                      ? "确认删除类型及关联人物"
                      : "确认删除"
                : pending
                  ? "删除中…"
                  : "确认删除分类及从属内容"
            }}
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.delete-overlay {
  z-index: 2200;
  overflow: auto;
  padding: 1rem;
}
.delete-modal {
  width: min(31rem, 100%);
  max-height: min(88vh, 48rem);
  overflow: auto;
  border: 1px solid var(--theme-line);
  border-radius: 0.9rem;
  color: var(--text-primary);
  background: var(--surface-main);
  box-shadow: 0 1.2rem 3.5rem
    color-mix(in srgb, var(--theme-foreground) 24%, transparent);
  font-size: 0.875rem;
}
header,
footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.9rem 1rem;
}
header {
  border-bottom: 1px solid var(--theme-line-soft);
}
header h3 {
  margin: 0.15rem 0 0;
}
header span {
  color: var(--accent);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.1em;
}
fieldset {
  display: grid;
  min-inline-size: 0;
  gap: 0.85rem;
  margin: 0;
  padding: 1rem;
  border: 0;
}
fieldset > p {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.55;
}
.form-field {
  display: grid;
  gap: 0.4rem;
  color: var(--text-secondary);
  font-weight: 600;
}
.delete-mode-options {
  display: grid;
  gap: 0.5rem;
}
.delete-mode-options label {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: 0.55rem;
  padding: 0.65rem;
  border: 1px solid var(--theme-line);
  border-radius: 0.65rem;
  background: var(--surface-raised);
  cursor: pointer;
}
.delete-mode-options input {
  margin-top: 0.2rem;
  accent-color: var(--accent);
}
.delete-mode-options span {
  display: grid;
  gap: 0.2rem;
}
.delete-mode-options small {
  color: var(--text-tertiary);
  font-weight: 400;
  line-height: 1.45;
}
footer {
  justify-content: flex-end;
  border-top: 1px solid var(--theme-line-soft);
  background: var(--surface-muted);
}
.danger-button {
  border-color: var(--danger);
  color: #fff;
  background: var(--danger);
  font-weight: 650;
}
</style>
