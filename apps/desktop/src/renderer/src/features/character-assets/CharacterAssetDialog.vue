<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick } from "vue";
defineProps<{ title: string; wide?: boolean; busy?: boolean }>();
const emit = defineEmits<{ close: [] }>();
const panel = ref<HTMLElement | null>(null);
const titleId = "asset-dialog-" + crypto.randomUUID();
let previous: HTMLElement | null = null;
onMounted(async () => {
  previous = document.activeElement as HTMLElement;
  await nextTick();
  panel.value
    ?.querySelector<HTMLElement>('input,textarea,button,[tabindex="0"]')
    ?.focus();
});
onBeforeUnmount(() => previous?.focus());
function trap(event: KeyboardEvent) {
  if (event.key !== "Tab") return;
  const elements = Array.from(
    panel.value?.querySelectorAll<HTMLElement>(
      'button:not(:disabled),input:not(:disabled),textarea:not(:disabled),[tabindex="0"]'
    ) ?? []
  );
  const first = elements[0],
    last = elements.at(-1);
  if (!first) {
    event.preventDefault();
    panel.value?.focus();
    return;
  }
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
</script>
<template>
  <Teleport to="body">
    <div
      class="dialog-backdrop character-dialog-backdrop"
      @mousedown.self="!busy && emit('close')"
      @keydown.esc.stop="!busy && emit('close')"
      @keydown="trap"
    >
      <section
        ref="panel"
        class="character-dialog"
        :class="{ 'is-wide': wide }"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        tabindex="-1"
      >
        <header>
          <h3 :id="titleId">{{ title }}</h3>
          <button
            type="button"
            :disabled="busy"
            aria-label="关闭弹窗"
            @click="emit('close')"
          >
            ×
          </button>
        </header>
        <slot />
        <footer v-if="$slots.actions"><slot name="actions" /></footer>
      </section>
    </div>
  </Teleport>
</template>
<style scoped>
.character-dialog-backdrop {
  z-index: 2400;
}
.character-dialog {
  width: min(500px, calc(100vw - 32px));
  max-height: calc(100vh - 32px);
  overflow: auto;
  padding: 22px;
  border: 1px solid var(--theme-line);
  border-radius: 16px;
  background: var(--surface-raised);
  color: var(--text-primary);
  box-shadow: 0 20px 80px #0005;
}
.character-dialog.is-wide {
  width: min(1200px, calc(100vw - 32px));
}
header,
footer {
  display: flex;
  align-items: center;
  gap: 12px;
}
header {
  justify-content: space-between;
  margin-bottom: 16px;
}
h3 {
  margin: 0;
  font-size: 1.1em;
  overflow-wrap: anywhere;
}
footer {
  justify-content: flex-end;
  margin-top: 18px;
}
button {
  font: inherit;
  padding: 5px 10px;
  border: 1px solid var(--theme-line);
  border-radius: 8px;
  background: var(--surface-muted);
  color: var(--text-primary);
  cursor: pointer;
}
</style>
