<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import AppIcon from "./AppIcon.vue";

defineProps<{
  path: string | null;
  loading: boolean;
  previousPath: string | null;
  migrationSourcePath: string | null;
}>();

const emit = defineEmits<{
  choose: [];
  restore: [];
  migrate: [];
}>();
const menuOpen = ref(false);
const confirmSwitch = ref(false);
const noPreviousDirectory = ref(false);
const actionArea = ref<HTMLElement | null>(null);

function handleDocumentPointerDown(event: PointerEvent): void {
  if (
    menuOpen.value &&
    event.target instanceof Node &&
    !actionArea.value?.contains(event.target)
  ) {
    menuOpen.value = false;
  }
}

onMounted(() =>
  document.addEventListener("pointerdown", handleDocumentPointerDown)
);
onBeforeUnmount(() =>
  document.removeEventListener("pointerdown", handleDocumentPointerDown)
);

function requestSwitch(path: string | null): void {
  menuOpen.value = false;
  if (path) confirmSwitch.value = true;
  else emit("choose");
}

function proceedSwitch(): void {
  confirmSwitch.value = false;
  emit("choose");
}

function requestRestore(previousPath: string | null): void {
  menuOpen.value = false;
  if (previousPath) emit("restore");
  else noPreviousDirectory.value = true;
}

function requestMigration(migrationSourcePath: string | null): void {
  menuOpen.value = false;
  if (migrationSourcePath) emit("migrate");
  else noPreviousDirectory.value = true;
}
</script>

<template>
  <section class="settings-group directory-settings">
    <div class="directory-settings-card">
      <AppIcon name="directory" :size="20" />
      <div class="directory-settings-details">
        <strong>{{ path ? "当前工作目录" : "尚未选择工作目录" }}</strong>
        <code>{{ path ?? "首次创建或导入时也会提示选择" }}</code>
      </div>
      <div
        ref="actionArea"
        class="directory-settings-actions"
        @keydown.esc="menuOpen = false"
      >
        <button
          type="button"
          class="directory-more-button"
          aria-label="工作目录操作"
          :aria-expanded="menuOpen"
          :disabled="loading"
          @click="menuOpen = !menuOpen"
        >
          <AppIcon name="more" :size="18" />
        </button>
        <div v-if="menuOpen" class="directory-action-menu" role="menu">
          <button type="button" role="menuitem" @click="requestSwitch(path)">
            {{ path ? "切换目录" : "选择目录" }}
          </button>
          <button
            type="button"
            role="menuitem"
            @click="requestRestore(previousPath)"
          >
            恢复目录
          </button>
          <button
            type="button"
            role="menuitem"
            @click="requestMigration(migrationSourcePath)"
          >
            数据迁移
          </button>
        </div>
      </div>
    </div>
    <div
      v-if="confirmSwitch"
      class="directory-confirm-backdrop"
      @click.self="confirmSwitch = false"
    >
      <div
        class="directory-confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="directory-confirm-title"
      >
        <h2 id="directory-confirm-title">切换工作目录</h2>
        <p>
          当前应用数据不会迁移到新目录中，切换工作目录后数据将被清空，可通过恢复原目录进行恢复或者进行数据迁移
        </p>
        <div class="directory-confirm-actions">
          <button type="button" @click="confirmSwitch = false">取消</button>
          <button type="button" @click="proceedSwitch">继续切换</button>
        </div>
      </div>
    </div>
    <div
      v-if="noPreviousDirectory"
      class="directory-confirm-backdrop"
      @click.self="noPreviousDirectory = false"
    >
      <div
        class="directory-confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="directory-no-previous-title"
      >
        <h2 id="directory-no-previous-title">当前没有切换过工作目录</h2>
        <div class="directory-confirm-actions">
          <button type="button" @click="noPreviousDirectory = false">
            知道了
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.directory-settings {
  max-width: 760px;
}

.directory-settings-card {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
  padding: 18px;
  border: 1px solid var(--theme-line-soft);
  border-radius: 13px;
  background: var(--surface-raised);
}

.directory-settings-details {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}

.directory-settings-details strong {
  font-size: 1rem;
  font-weight: 590;
}

.directory-settings-details code {
  overflow-wrap: anywhere;
  color: var(--text-secondary);
  font-family: var(--code-font);
  font-size: var(--code-font-size);
}

.directory-settings-actions {
  position: relative;
  flex: 0 0 auto;
}

.directory-settings-card button {
  flex: 0 0 auto;
  padding: 8px 12px;
  border: 1px solid var(--theme-line);
  border-radius: 8px;
  background: var(--surface-main);
  color: var(--text-primary);
  cursor: pointer;
}

.directory-settings-card button:hover:not(:disabled) {
  background: var(--surface-hover);
}

.directory-settings-card button:disabled {
  opacity: 0.55;
  cursor: wait;
}

.directory-settings-card .directory-more-button {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  padding: 0;
}

.directory-action-menu {
  position: absolute;
  z-index: 10;
  top: calc(100% + 8px);
  right: 0;
  display: grid;
  gap: 2px;
  min-width: 148px;
  padding: 6px;
  border: 1px solid var(--theme-line);
  border-radius: 10px;
  background: var(--surface-raised);
  box-shadow: 0 12px 30px rgb(0 0 0 / 18%);
}

.directory-action-menu button {
  width: 100%;
  border: 0;
  text-align: left;
}

.directory-confirm-backdrop {
  position: fixed;
  z-index: 1000;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgb(0 0 0 / 55%);
}

.directory-confirm-dialog {
  width: min(100%, 440px);
  padding: 24px;
  border: 1px solid var(--theme-line);
  border-radius: 14px;
  background: var(--surface-raised);
  box-shadow: 0 24px 64px rgb(0 0 0 / 25%);
}

.directory-confirm-dialog h2 {
  margin: 0 0 14px;
  font-size: 1.25rem;
}

.directory-confirm-dialog p {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.6;
}

.directory-confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 24px;
}

.directory-confirm-actions button {
  padding: 8px 14px;
  border: 1px solid var(--theme-line);
  border-radius: 8px;
  background: var(--surface-main);
  color: var(--text-primary);
  cursor: pointer;
}

.directory-confirm-actions button:hover {
  background: var(--surface-hover);
}

@media (max-width: 760px) {
  .directory-settings-card {
    flex-wrap: wrap;
  }
}
</style>
