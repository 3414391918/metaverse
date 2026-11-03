<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import AppIcon from "./AppIcon.vue";

const props = defineProps<{
  path: string | null;
  loading: boolean;
  directories: string[];
}>();

const emit = defineEmits<{
  choose: [];
  add: [];
  remove: [path: string];
  switch: [path: string];
  migrateData: [paths: { sourcePath: string; targetPath: string }];
}>();

const menuOpenForPath = ref<string | null>(null);
const confirmSwitchPath = ref<string | null>(null);
const confirmRemovePath = ref<string | null>(null);
const removeCurrentBlocked = ref(false);
const migrationSourcePath = ref<string | null>(null);
const listRoot = ref<HTMLElement | null>(null);

interface DirectoryEntry {
  path: string;
  isCurrent: boolean;
}

const entries = computed<DirectoryEntry[]>(() => {
  const current = props.path;
  const paths = Array.from(
    new Set([...props.directories, ...(current ? [current] : [])])
  );
  return paths.map((path) => ({
    path,
    isCurrent: path === current
  }));
});

const migrationTargets = computed<DirectoryEntry[]>(() => {
  const source = migrationSourcePath.value;
  if (!source) return [];
  return entries.value.filter((entry) => entry.path !== source);
});

function handleDocumentPointerDown(event: PointerEvent): void {
  if (
    menuOpenForPath.value &&
    event.target instanceof Node &&
    !listRoot.value?.contains(event.target)
  ) {
    menuOpenForPath.value = null;
  }
}

onMounted(() =>
  document.addEventListener("pointerdown", handleDocumentPointerDown)
);
onBeforeUnmount(() =>
  document.removeEventListener("pointerdown", handleDocumentPointerDown)
);

function toggleMenu(path: string): void {
  menuOpenForPath.value = menuOpenForPath.value === path ? null : path;
}

function requestSwitch(entry: DirectoryEntry): void {
  menuOpenForPath.value = null;
  if (entry.isCurrent) return;
  confirmSwitchPath.value = entry.path;
}

function proceedSwitch(): void {
  const path = confirmSwitchPath.value;
  confirmSwitchPath.value = null;
  if (path) emit("switch", path);
}

function requestRemove(entry: DirectoryEntry): void {
  menuOpenForPath.value = null;
  if (entry.isCurrent) {
    removeCurrentBlocked.value = true;
    return;
  }
  confirmRemovePath.value = entry.path;
}

function proceedRemove(): void {
  const path = confirmRemovePath.value;
  confirmRemovePath.value = null;
  if (path) emit("remove", path);
}

function requestMigration(entry: DirectoryEntry): void {
  menuOpenForPath.value = null;
  migrationSourcePath.value = entry.path;
}

function proceedMigration(targetPath: string): void {
  const sourcePath = migrationSourcePath.value;
  migrationSourcePath.value = null;
  if (sourcePath) emit("migrateData", { sourcePath, targetPath });
}
</script>

<template>
  <section ref="listRoot" class="settings-group directory-settings">
    <div class="directory-settings-head">
      <div class="directory-settings-details">
        <strong>工作目录管理</strong>
        <span>
          {{
            path
              ? "管理已登记的工作目录，切换后应用数据随当前目录刷新。"
              : "尚未选择工作目录，先添加一个目录开始使用。"
          }}
        </span>
      </div>
      <button
        type="button"
        class="directory-add-button"
        :disabled="loading"
        @click="emit('add')"
      >
        <AppIcon name="directory" :size="16" />
        添加目录
      </button>
    </div>

    <ul v-if="entries.length" class="directory-list">
      <li
        v-for="entry in entries"
        :key="entry.path"
        class="directory-item"
        :class="{ 'is-current': entry.isCurrent }"
        :data-current="entry.isCurrent ? 'true' : 'false'"
      >
        <div class="directory-item-main">
          <div class="directory-item-label">
            <strong>{{
              entry.isCurrent ? "当前工作目录" : "已登记目录"
            }}</strong>
            <code>{{ entry.path }}</code>
          </div>
          <span v-if="entry.isCurrent" class="directory-current-badge">
            当前
          </span>
        </div>
        <div
          class="directory-item-actions"
          @keydown.esc="menuOpenForPath = null"
        >
          <div class="directory-item-menu-area">
            <button
              type="button"
              class="directory-more-button"
              aria-label="目录操作"
              :aria-expanded="menuOpenForPath === entry.path"
              :disabled="loading"
              @click="toggleMenu(entry.path)"
            >
              <AppIcon name="more" :size="18" />
            </button>
            <div
              v-if="menuOpenForPath === entry.path"
              class="directory-action-menu"
              role="menu"
            >
              <button
                v-if="!entry.isCurrent"
                type="button"
                role="menuitem"
                @click="requestSwitch(entry)"
              >
                设为当前目录
              </button>
              <button
                type="button"
                role="menuitem"
                @click="requestRemove(entry)"
              >
                移除登记
              </button>
              <button
                type="button"
                role="menuitem"
                @click="requestMigration(entry)"
              >
                迁移数据
              </button>
            </div>
          </div>
        </div>
      </li>
    </ul>
    <div v-else class="directory-empty">
      <p>还没有登记任何工作目录。</p>
      <button
        type="button"
        class="directory-add-button"
        :disabled="loading"
        @click="emit('choose')"
      >
        选择首个工作目录
      </button>
    </div>

    <div
      v-if="confirmSwitchPath"
      class="directory-confirm-backdrop"
      @click.self="confirmSwitchPath = null"
    >
      <div
        class="directory-confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="directory-confirm-title"
      >
        <h2 id="directory-confirm-title">切换工作目录</h2>
        <p>
          当前应用数据不会迁移到新目录中，切换工作目录后数据将被清空，可通过切回原目录或数据迁移找回。
        </p>
        <div class="directory-confirm-actions">
          <button type="button" @click="confirmSwitchPath = null">取消</button>
          <button type="button" @click="proceedSwitch">继续切换</button>
        </div>
      </div>
    </div>
    <div
      v-if="confirmRemovePath"
      class="directory-confirm-backdrop"
      @click.self="confirmRemovePath = null"
    >
      <div
        class="directory-confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="directory-remove-title"
      >
        <h2 id="directory-remove-title">移除目录登记</h2>
        <p>
          仅把该目录从管理列表中移除，磁盘上的文件不会被删除。之后如需继续使用，可重新添加。
        </p>
        <div class="directory-confirm-actions">
          <button type="button" @click="confirmRemovePath = null">取消</button>
          <button type="button" @click="proceedRemove">确认移除</button>
        </div>
      </div>
    </div>
    <div
      v-if="removeCurrentBlocked"
      class="directory-confirm-backdrop"
      @click.self="removeCurrentBlocked = false"
    >
      <div
        class="directory-confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="directory-remove-current-title"
      >
        <h2 id="directory-remove-current-title">需先切换工作目录</h2>
        <p>该目录是当前使用中的工作目录，需先切换到其它目录后才能移除登记。</p>
        <div class="directory-confirm-actions">
          <button type="button" @click="removeCurrentBlocked = false">
            知道了
          </button>
        </div>
      </div>
    </div>
    <div
      v-if="migrationSourcePath"
      class="directory-confirm-backdrop"
      @click.self="migrationSourcePath = null"
    >
      <div
        class="directory-confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="directory-migrate-title"
      >
        <h2 id="directory-migrate-title">迁移数据</h2>
        <p>
          选择一个已登记的工作目录作为迁移目标；目标必须是空目录，不为空时迁移将被中止且不会覆盖任何数据。
        </p>
        <div v-if="migrationTargets.length" class="directory-target-list">
          <button
            v-for="target in migrationTargets"
            :key="target.path"
            type="button"
            class="directory-target-option"
            :disabled="loading"
            @click="proceedMigration(target.path)"
          >
            <code>{{ target.path }}</code>
          </button>
        </div>
        <p v-else>暂无其它已登记的工作目录，请先添加一个空目录作为迁移目标。</p>
        <div class="directory-confirm-actions">
          <button type="button" @click="migrationSourcePath = null">
            取消
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

.directory-settings-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 14px;
}

.directory-settings-details {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}

.directory-settings-details strong {
  font-size: 1.05rem;
  font-weight: 590;
}

.directory-settings-details span {
  color: var(--text-secondary);
  line-height: 1.6;
}

.directory-add-button {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: 1px solid var(--theme-line);
  border-radius: 8px;
  background: var(--surface-main);
  color: var(--text-primary);
  cursor: pointer;
}

.directory-add-button:hover:not(:disabled) {
  background: var(--surface-hover);
}

.directory-add-button:disabled {
  opacity: 0.55;
  cursor: wait;
}

.directory-list {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.directory-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  min-width: 0;
  padding: 16px;
  border: 1px solid var(--theme-line-soft);
  border-radius: 13px;
  background: var(--surface-raised);
}

.directory-item.is-current {
  border-color: var(--accent, var(--theme-line));
  box-shadow: 0 0 0 1px var(--accent, transparent);
}

.directory-item-main {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.directory-item-label {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}

.directory-item-label strong {
  font-size: 0.95rem;
  font-weight: 590;
}

.directory-item-label code {
  overflow-wrap: anywhere;
  color: var(--text-secondary);
  font-family: var(--code-font);
  font-size: var(--code-font-size);
}

.directory-current-badge {
  flex: 0 0 auto;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--accent, var(--surface-hover));
  color: var(--accent-contrast, var(--text-primary));
  font-size: 0.78rem;
  font-weight: 590;
}

.directory-item-actions {
  position: relative;
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
}

.directory-item-actions button {
  flex: 0 0 auto;
  padding: 8px 12px;
  border: 1px solid var(--theme-line);
  border-radius: 8px;
  background: var(--surface-main);
  color: var(--text-primary);
  cursor: pointer;
}

.directory-item-actions button:hover:not(:disabled) {
  background: var(--surface-hover);
}

.directory-item-actions button:disabled {
  opacity: 0.55;
  cursor: wait;
}

.directory-item-actions .directory-more-button {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  padding: 0;
}

.directory-item-menu-area {
  position: relative;
  flex: 0 0 auto;
}

.directory-action-menu {
  position: absolute;
  z-index: 10;
  top: calc(100% + 8px);
  right: 0;
  display: grid;
  gap: 2px;
  min-width: 168px;
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

.directory-empty {
  display: grid;
  gap: 12px;
  padding: 22px;
  border: 1px dashed var(--theme-line);
  border-radius: 13px;
  color: var(--text-secondary);
}

.directory-empty p {
  margin: 0;
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
  overflow-wrap: anywhere;
}

.directory-target-list {
  display: grid;
  gap: 8px;
  margin-top: 16px;
  max-height: 260px;
  overflow-y: auto;
}

.directory-target-option {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--theme-line);
  border-radius: 8px;
  background: var(--surface-main);
  color: var(--text-primary);
  cursor: pointer;
  text-align: left;
}

.directory-target-option:hover:not(:disabled) {
  background: var(--surface-hover);
}

.directory-target-option:disabled {
  opacity: 0.55;
  cursor: wait;
}

.directory-target-option code {
  overflow-wrap: anywhere;
  font-family: var(--code-font);
  font-size: var(--code-font-size);
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
  .directory-item {
    flex-wrap: wrap;
  }

  .directory-settings-head {
    flex-wrap: wrap;
  }
}
</style>
