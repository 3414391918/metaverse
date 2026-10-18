<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useId } from "vue";
import type { ComposerContextOption } from "../composables/composerContextNavigationContext";
import { useComposerContextPopover } from "../composables/useComposerContextPopover";
import AppIcon from "./AppIcon.vue";
const props = defineProps<{
  anchor: HTMLElement;
  kind: "book" | "stage";
  bookTitle: string;
  library: boolean;
  options: readonly ComposerContextOption[];
  busy: boolean;
}>();
const emit = defineEmits<{ close: []; select: [id: string] }>();
const titleId = useId();
const query = ref("");
const search = ref<HTMLInputElement>();
const panel = ref<HTMLElement>();
const filtered = computed(() => {
  const term = query.value.trim().toLocaleLowerCase();
  return props.options.filter((option) =>
    `${option.label} ${option.detail}`.toLocaleLowerCase().includes(term)
  );
});
const title = computed(() =>
  props.kind === "book"
    ? "选择书籍或资料库"
    : props.library
      ? "选择资料库内容"
      : "选择书籍阶段"
);
const { style, close, tab } = useComposerContextPopover(
  () => props.anchor,
  panel,
  () => emit("close")
);
function keydown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    event.stopPropagation();
    close();
  }
  const buttons = Array.from(
    panel.value?.querySelectorAll<HTMLButtonElement>(
      ".context-option:not(:disabled)"
    ) ?? []
  );
  if (["ArrowDown", "ArrowUp"].includes(event.key)) {
    event.preventDefault();
    const index = buttons.findIndex(
      (button) => button === document.activeElement
    );
    const next =
      index < 0
        ? event.key === "ArrowDown"
          ? 0
          : buttons.length - 1
        : (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) %
          buttons.length;
    buttons[next]?.focus();
  }
  if (event.key === "Enter" && event.target === search.value) {
    event.preventDefault();
    buttons[0]?.click();
  }
  tab(event);
}

onMounted(async () => {
  await nextTick();
  search.value?.focus();
  panel.value
    ?.querySelector(".is-current")
    ?.scrollIntoView({ block: "nearest" });
});
</script>
<template>
  <Teleport to="body">
    <section
      ref="panel"
      class="composer-context-menu"
      :style="style"
      role="dialog"
      :aria-labelledby="titleId"
      :aria-busy="busy"
      @keydown="keydown"
    >
      <header class="context-picker-heading">
        <strong :id="titleId">{{ title }}</strong>
        <button
          class="context-picker-close"
          type="button"
          aria-label="关闭选择浮层"
          @click="close"
        >
          <AppIcon name="close" :size="15" />
        </button>
      </header>
      <div class="context-picker-body">
        <label class="context-search">
          <AppIcon name="search" :size="17" />
          <input
            ref="search"
            v-model="query"
            type="search"
            :placeholder="
              kind === 'book' ? '搜索书籍或资料库' : '搜索名称或分类'
            "
            :aria-label="
              kind === 'book' ? '搜索书籍或资料库' : '搜索阶段或内容'
            "
          />
        </label>
        <div class="context-picker-list">
          <button
            v-for="option in filtered"
            :key="option.id"
            class="context-option"
            type="button"
            :class="{ 'is-current': option.current }"
            :aria-current="option.current ? 'true' : undefined"
            :disabled="busy || option.disabled"
            @click="emit('select', option.id)"
          >
            <span class="context-option-icon"
              ><AppIcon :name="option.icon" :size="17"
            /></span>
            <span class="context-option-copy"
              ><strong :title="option.label">{{ option.label }}</strong
              ><small
                v-if="option.detail || option.disabled"
                :title="option.detail"
                >{{ option.disabled ? "暂不可用" : option.detail }}</small
              ></span
            >
            <span v-if="option.current" class="context-current"
              ><AppIcon name="check" :size="15"
            /></span>
            <AppIcon v-else name="chevron" :size="14" />
          </button>
          <div v-if="!filtered.length" class="context-picker-empty">
            <AppIcon name="search" :size="26" /><strong>{{
              query.trim() ? "没有找到匹配项" : "暂无可选内容"
            }}</strong
            ><span>{{
              query.trim()
                ? "试试其他关键词"
                : kind === "book"
                  ? "可在左侧栏创建或打开作品"
                  : "可在左侧栏添加内容"
            }}</span>
          </div>
        </div>
      </div>
    </section>
  </Teleport>
</template>
<style scoped src="./composer-context-menu.css"></style>
