<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { AppearanceCustomFont } from "@deepwrite/contracts/renderer";
import AppIcon from "./AppIcon.vue";

const props = defineProps<{
  font: AppearanceCustomFont | null;
  busy: boolean;
}>();

const emit = defineEmits<{
  close: [];
  confirm: [];
}>();

const confirmButton = ref<HTMLButtonElement | null>(null);

function close(): void {
  if (!props.busy) emit("close");
}

function handleKeydown(event: KeyboardEvent): void {
  if (props.font && event.key === "Escape") close();
}

watch(
  () => props.font,
  (font) => {
    if (font) void nextTick(() => confirmButton.value?.focus());
  }
);

onMounted(() => document.addEventListener("keydown", handleKeydown));
onBeforeUnmount(() => document.removeEventListener("keydown", handleKeydown));
</script>

<template>
  <Teleport to="body">
    <div v-if="font" class="font-delete-backdrop" @mousedown.self="close">
      <section
        class="font-delete-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="font-delete-title"
        aria-describedby="font-delete-description"
      >
        <header>
          <div class="font-delete-icon" aria-hidden="true">
            <AppIcon name="trash" :size="20" />
          </div>
          <div>
            <span>本地字体</span>
            <h2 id="font-delete-title">删除“{{ font.displayName }}”？</h2>
          </div>
        </header>
        <p id="font-delete-description">
          将删除 DeepWrite
          保存的字体副本，不会影响原始文件。若它正在使用，界面与正文会自动恢复默认字体。
        </p>
        <footer>
          <button type="button" :disabled="busy" @click="close">取消</button>
          <button
            ref="confirmButton"
            class="is-danger"
            type="button"
            :disabled="busy"
            @click="emit('confirm')"
          >
            {{ busy ? "正在删除…" : "确认删除" }}
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.font-delete-backdrop {
  position: fixed;
  z-index: 1600;
  inset: 0;
  display: grid;
  padding: 24px;
  place-items: center;
  background: rgb(0 0 0 / 34%);
  backdrop-filter: blur(3px);
}

.font-delete-dialog {
  width: min(460px, calc(100vw - 48px));
  padding: 24px;
  border: 1px solid var(--theme-line);
  border-radius: 16px;
  background: var(--surface-raised);
  color: var(--text-primary);
  box-shadow: 0 24px 72px rgb(0 0 0 / 24%);
  font-family: var(--ui-font);
}

.font-delete-dialog header {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

.font-delete-icon {
  display: grid;
  width: 42px;
  height: 42px;
  border-radius: 12px;
  flex: 0 0 auto;
  place-items: center;
  background: color-mix(in srgb, var(--danger) 13%, var(--surface-raised));
  color: var(--danger);
}

.font-delete-dialog header span {
  color: var(--text-tertiary);
  font-size: 0.75rem;
  font-weight: 650;
  letter-spacing: 0.06em;
}

.font-delete-dialog h2 {
  margin: 4px 0 0;
  font-size: 1.285714rem;
  font-weight: 650;
}

.font-delete-dialog p {
  margin: 20px 0 24px;
  color: var(--text-secondary);
  font-size: 0.928571rem;
  line-height: 1.65;
}

.font-delete-dialog footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.font-delete-dialog footer button {
  min-width: 86px;
  min-height: 36px;
  padding: 7px 14px;
  border: 1px solid var(--theme-line);
  border-radius: 9px;
  background: var(--surface-raised);
  color: var(--text-primary);
  font: inherit;
  cursor: pointer;
}

.font-delete-dialog footer button:hover:not(:disabled) {
  background: var(--surface-hover);
}

.font-delete-dialog footer .is-danger {
  border-color: var(--danger);
  background: var(--danger);
  color: #fff;
}

.font-delete-dialog footer .is-danger:hover:not(:disabled) {
  background: color-mix(in srgb, var(--danger) 86%, var(--text-primary));
}

.font-delete-dialog footer button:disabled {
  cursor: not-allowed;
  opacity: 0.52;
}
</style>
