<script setup lang="ts">
import { computed } from "vue";
import type { LongWorldbuildingSyncPreparedChange } from "../types/longWorkspace";
import type { LongWorldbuildingSyncBookOption } from "../utils/longWorldbuildingSync";
import LongImpactConfirmationDetails from "./LongImpactConfirmationDetails.vue";
import PopupSelect, {
  type PopupSelectOption,
  type PopupSelectValue
} from "./PopupSelect.vue";

const props = withDefaults(
  defineProps<{
    open: boolean;
    currentBookId?: string | null;
    selectedBookId: string;
    bookOptions: readonly LongWorldbuildingSyncBookOption[];
    prepared: LongWorldbuildingSyncPreparedChange | null;
    locked?: boolean;
    pending?: boolean;
  }>(),
  {
    currentBookId: null,
    locked: false,
    pending: false
  }
);

const emit = defineEmits<{
  close: [];
  confirm: [];
  "update:selectedBookId": [bookId: string];
}>();

const selectOptions = computed<PopupSelectOption[]>(() =>
  props.bookOptions
    .filter(({ id }) => id !== props.currentBookId)
    .map((book) => ({
      value: book.id,
      label:
        book.categoryCount > 0
          ? `${book.title}（${book.categoryCount} 个分类）`
          : book.title
    }))
);
const selectedBook = computed(
  () => props.bookOptions.find(({ id }) => id === props.selectedBookId) ?? null
);

function selectBook(value: PopupSelectValue): void {
  emit("update:selectedBookId", typeof value === "string" ? value : "");
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="dialog-backdrop sync-overlay"
      @mousedown.self="emit('close')"
      @keydown.esc.stop="emit('close')"
    >
      <section
        class="sync-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="long-structure-sync-title"
        aria-describedby="long-structure-sync-description"
      >
        <header>
          <div>
            <span>SYNC</span>
            <h3 id="long-structure-sync-title">加载其他书籍世界观</h3>
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
        <fieldset :disabled="locked">
          <p id="long-structure-sync-description">
            同步会用来源小说的全部可编辑世界观覆盖当前书籍；迁移证据只读分类会保留。请先核对精确影响，再决定是否覆盖。
          </p>
          <label>
            <span>选择来源小说</span>
            <PopupSelect
              :model-value="selectedBookId"
              :options="selectOptions"
              accessible-label="选择要同步世界观的小说书籍"
              :menu-z-index="2300"
              @update:model-value="selectBook"
            />
          </label>
          <p v-if="selectedBook" class="summary">
            将读取「{{ selectedBook.title }}」的
            {{ selectedBook.categoryCount }} 个世界观分类及其全部内容。
          </p>
          <template v-if="prepared">
            <p class="summary">
              将新增 {{ prepared.createdCategoryCount }} 个分类、删除
              {{ prepared.deletedCategoryCount }} 个现有分类，并写入
              {{ prepared.writtenFileCount }} 份正文。
            </p>
            <LongImpactConfirmationDetails
              :confirmation="prepared.confirmation"
              fallback="同步不会改变当前小说中的关联关系。"
            />
          </template>
        </fieldset>
        <footer>
          <button type="button" :disabled="locked" @click="emit('close')">
            取消
          </button>
          <button
            :class="{ 'danger-button': Boolean(prepared) }"
            type="button"
            :disabled="locked || !selectedBookId"
            @click="emit('confirm')"
          >
            {{
              pending
                ? prepared
                  ? "同步中…"
                  : "核对中…"
                : prepared
                  ? "确认按上述影响覆盖"
                  : "核对同步影响"
            }}
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.sync-overlay {
  z-index: 2200;
  overflow: auto;
  padding: 1rem;
}

.sync-modal {
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

.close-button {
  width: 2rem;
  padding: 0;
  border-color: transparent;
  background: transparent;
  font-size: 1.2rem;
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

label {
  display: grid;
  gap: 0.4rem;
  color: var(--text-secondary);
  font-weight: 600;
}

.summary {
  padding: 0.75rem;
  border: 1px solid var(--theme-line);
  border-radius: 0.65rem;
  background: var(--surface-muted);
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
