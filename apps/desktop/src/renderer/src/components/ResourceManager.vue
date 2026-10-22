<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import type {
  ResourceEntry,
  ResourceManagerRequest
} from "@deepwrite/contracts";
import { useResourceManager } from "../composables/useResourceManager";
import { uiMessage } from "../ui-feedback";
import AppIcon from "./AppIcon.vue";

const {
  snapshot,
  directory,
  query,
  selected,
  loading,
  pending,
  run,
  navigate,
  refresh
} = useResourceManager();
const entries = computed(() => snapshot.value?.entries ?? []);
const busy = computed(() => loading.value || pending.value);
const menu = ref<{ x: number; y: number } | null>(null);
const menuElement = ref<HTMLElement | null>(null);
const pane = ref<HTMLElement | null>(null);
const dialog = ref<"folder" | "rename" | "trash" | null>(null);
const name = ref("");
const nameInput = ref<HTMLInputElement | null>(null);
const dragDepth = ref(0);
let anchor: string | null = null;
const crumbs = computed(() =>
  directory.value
    .split("/")
    .filter(Boolean)
    .map((label, i, parts) => ({
      label,
      path: parts.slice(0, i + 1).join("/")
    }))
);
const single = computed(() =>
  selected.value.length === 1
    ? entries.value.find((item) => item.path === selected.value[0])
    : undefined
);
const parent = () => directory.value.split("/").slice(0, -1).join("/");

function select(entry: ResourceEntry, event: MouseEvent) {
  pane.value?.focus({ preventScroll: true });
  if (event.shiftKey && anchor) {
    const start = entries.value.findIndex((item) => item.path === anchor);
    const end = entries.value.indexOf(entry);
    selected.value =
      start < 0
        ? [entry.path]
        : entries.value
            .slice(Math.min(start, end), Math.max(start, end) + 1)
            .map((item) => item.path);
  } else if (event.metaKey || event.ctrlKey) {
    selected.value = selected.value.includes(entry.path)
      ? selected.value.filter((path) => path !== entry.path)
      : [...selected.value, entry.path];
    anchor = entry.path;
  } else {
    selected.value = [entry.path];
    anchor = entry.path;
  }
}
function open(entry: ResourceEntry) {
  menu.value = null;
  if (entry.kind === "directory") navigate(entry.path);
  else void run({ action: "open", path: entry.path });
}
function context(event: MouseEvent, entry?: ResourceEntry) {
  if (entry && !selected.value.includes(entry.path))
    selected.value = [entry.path];
  if (!entry) selected.value = [];
  menu.value = {
    x: Math.max(8, Math.min(event.clientX, window.innerWidth - 230)),
    y: Math.max(8, Math.min(event.clientY, window.innerHeight - 385))
  };
}
function outside(event: PointerEvent) {
  if (
    menu.value &&
    event.target instanceof Node &&
    !menuElement.value?.contains(event.target)
  )
    menu.value = null;
}
async function showDialog(kind: "folder" | "rename" | "trash") {
  menu.value = null;
  dialog.value = kind;
  name.value = kind === "rename" ? (single.value?.name ?? "") : "";
  await nextTick();
  nameInput.value?.focus();
  nameInput.value?.select();
}
async function submit() {
  let request: ResourceManagerRequest;
  if (dialog.value === "folder")
    request = {
      action: "createFolder",
      directory: directory.value,
      name: name.value
    };
  else if (dialog.value === "rename" && single.value)
    request = { action: "rename", path: single.value.path, name: name.value };
  else if (dialog.value === "trash" && selected.value.length)
    request = { action: "trash", paths: [...selected.value] };
  else return;
  if (await run(request)) dialog.value = null;
}
function action(input: ResourceManagerRequest) {
  menu.value = null;
  void run(input);
}
function clipboard(mode: "copy" | "cut") {
  if (selected.value.length)
    action({ action: "clipboard", mode, paths: [...selected.value] });
}
function keyboard(event: KeyboardEvent) {
  if ((event.target as HTMLElement)?.closest("input, textarea") || dialog.value)
    return;
  const mod = event.metaKey || event.ctrlKey;
  const key = event.key.toLowerCase();
  if (event.key === "Escape") {
    menu.value = null;
    selected.value = [];
    return;
  }
  if (busy.value) return;
  if (mod && key === "a") {
    event.preventDefault();
    selected.value = entries.value.map((entry) => entry.path);
  } else if (mod && key === "c") {
    event.preventDefault();
    clipboard("copy");
  } else if (mod && key === "x") {
    event.preventDefault();
    clipboard("cut");
  } else if (mod && key === "v") {
    event.preventDefault();
    action({ action: "paste", directory: directory.value });
  } else if (mod && event.shiftKey && key === "n") {
    event.preventDefault();
    void showDialog("folder");
  } else if (event.key === "F2" && single.value) {
    event.preventDefault();
    void showDialog("rename");
  } else if (event.key === "Enter" && single.value) {
    event.preventDefault();
    open(single.value);
  } else if (event.key === "Delete" && selected.value.length) {
    event.preventDefault();
    void showDialog("trash");
  } else if (event.key === "Backspace" && directory.value) {
    event.preventDefault();
    navigate(parent());
  }
}
function dragEnter(event: DragEvent) {
  if (event.dataTransfer?.types.includes("Files")) dragDepth.value++;
}
function dragOver(event: DragEvent) {
  if (event.dataTransfer?.types.includes("Files")) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }
}
async function drop(event: DragEvent) {
  dragDepth.value = 0;
  const api = window.deepwrite?.resourceManager;
  const files = Array.from(event.dataTransfer?.files ?? []);
  if (!api || !files.length) return;
  try {
    const paths = files.map((file) => api.droppedFilePath(file));
    if (paths.some((path) => !path))
      throw new Error("无法读取拖入文件的本地路径，请使用导入按钮。");
    await run({
      action: "import",
      directory: directory.value,
      sourcePaths: paths
    });
  } catch (error) {
    uiMessage.error(error instanceof Error ? error.message : "导入失败。");
  }
}
function size(bytes: number) {
  return bytes < 1024
    ? `${bytes} B`
    : bytes < 1024 ** 2
      ? `${(bytes / 1024).toFixed(1)} KB`
      : bytes < 1024 ** 3
        ? `${(bytes / 1024 ** 2).toFixed(1)} MB`
        : `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}
onMounted(() => document.addEventListener("pointerdown", outside));
onBeforeUnmount(() => document.removeEventListener("pointerdown", outside));
</script>

<template>
  <section
    ref="pane"
    class="resource-manager"
    aria-label="资源管理"
    tabindex="0"
    @keydown="keyboard"
    @dragenter.prevent="dragEnter"
    @dragover="dragOver"
    @dragleave.prevent="dragDepth = Math.max(0, dragDepth - 1)"
    @drop.prevent="drop"
  >
    <header class="resource-heading">
      <div>
        <h1>资源管理</h1>
        <p>{{ snapshot?.root ?? "正在读取工作目录…" }}</p>
      </div>
      <div class="resource-toolbar">
        <button type="button" :disabled="busy" @click="showDialog('folder')">
          <AppIcon name="plus" :size="16" />新建文件夹
        </button>
        <button
          type="button"
          :disabled="busy"
          @click="action({ action: 'import', directory, sourcePaths: [] })"
        >
          <AppIcon name="download" :size="16" />导入文件
        </button>
        <button type="button" :disabled="busy" @click="refresh">刷新</button>
      </div>
    </header>
    <div class="resource-navigation">
      <button
        type="button"
        aria-label="上一级"
        :disabled="!directory || busy"
        @click="navigate(parent())"
      >
        <AppIcon name="arrow-left" :size="17" />
      </button>
      <nav aria-label="文件夹路径">
        <button type="button" @click="navigate('')">全部资源</button
        ><template v-for="crumb in crumbs" :key="crumb.path"
          ><span>/</span
          ><button type="button" @click="navigate(crumb.path)">
            {{ crumb.label }}
          </button></template
        >
      </nav>
      <label class="resource-search"
        ><AppIcon name="search" :size="16" /><input
          v-model="query"
          type="search"
          placeholder="搜索当前文件夹及子文件夹"
          aria-label="搜索资源"
      /></label>
    </div>
    <div class="resource-selection-bar">
      <span>{{
        selected.length
          ? `已选择 ${selected.length} 项`
          : `${entries.length} 项`
      }}</span>
      <button
        type="button"
        :disabled="!selected.length || busy"
        @click="clipboard('copy')"
      >
        复制
      </button>
      <button
        type="button"
        :disabled="!selected.length || busy"
        @click="clipboard('cut')"
      >
        剪切
      </button>
      <button
        type="button"
        :disabled="!snapshot?.canPaste || busy"
        @click="action({ action: 'paste', directory })"
      >
        粘贴
      </button>
      <button
        type="button"
        :disabled="!selected.length || busy"
        @click="action({ action: 'copyPath', paths: [...selected] })"
      >
        复制绝对路径
      </button>
    </div>
    <div
      class="resource-list"
      @contextmenu.prevent="context($event)"
      @click.self="selected = []"
    >
      <div class="resource-columns">
        <span>名称</span><span>大小</span><span>修改时间</span>
      </div>
      <div
        v-for="entry in entries"
        :key="entry.path"
        class="resource-row"
        :class="{ selected: selected.includes(entry.path) }"
        role="option"
        :aria-selected="selected.includes(entry.path)"
        @click.stop="select(entry, $event)"
        @dblclick.stop="open(entry)"
        @contextmenu.stop.prevent="context($event, entry)"
      >
        <div class="resource-name">
          <AppIcon
            :name="entry.kind === 'directory' ? 'folder' : 'file'"
            :size="21"
          />
          <div>
            <strong>{{ entry.name }}</strong
            ><small v-if="query">{{ entry.path }}</small>
          </div>
        </div>
        <span>{{
          entry.kind === "directory" ? "文件夹" : size(entry.size)
        }}</span>
        <time>{{ new Date(entry.modifiedAt).toLocaleString() }}</time>
      </div>
      <div
        v-if="!entries.length"
        class="resource-empty"
        @click.self="selected = []"
      >
        <AppIcon :name="query ? 'search' : 'folder'" :size="38" />
        <p>
          {{
            loading
              ? "正在读取…"
              : query
                ? "未找到匹配的资源"
                : "拖入文件或文件夹，开始整理资源"
          }}
        </p>
      </div>
      <p v-if="snapshot?.truncated" class="resource-limit">
        结果较多，请缩小搜索范围。
      </p>
    </div>
    <div v-if="dragDepth" class="resource-drop-overlay">
      松开以导入到当前文件夹
    </div>
    <div
      v-if="menu"
      ref="menuElement"
      class="resource-menu"
      role="menu"
      :style="{ left: `${menu.x}px`, top: `${menu.y}px` }"
    >
      <button v-if="single" type="button" role="menuitem" @click="open(single)">
        打开
      </button>
      <button
        v-if="selected.length"
        type="button"
        role="menuitem"
        @click="clipboard('copy')"
      >
        复制
      </button>
      <button
        v-if="selected.length"
        type="button"
        role="menuitem"
        @click="clipboard('cut')"
      >
        剪切
      </button>
      <button
        type="button"
        role="menuitem"
        :disabled="!snapshot?.canPaste"
        @click="action({ action: 'paste', directory })"
      >
        粘贴
      </button>
      <button
        v-if="single"
        type="button"
        role="menuitem"
        @click="showDialog('rename')"
      >
        重命名
      </button>
      <button
        v-if="selected.length"
        type="button"
        role="menuitem"
        @click="action({ action: 'copyPath', paths: [...selected] })"
      >
        复制绝对路径
      </button>
      <button
        type="button"
        role="menuitem"
        @click="action({ action: 'reveal', path: single?.path ?? directory })"
      >
        在系统文件管理器中显示
      </button>
      <button type="button" role="menuitem" @click="showDialog('folder')">
        新建文件夹
      </button>
      <button
        v-if="selected.length"
        type="button"
        role="menuitem"
        class="danger"
        @click="showDialog('trash')"
      >
        移到废纸篓／回收站
      </button>
    </div>
    <div
      v-if="dialog"
      class="resource-dialog-backdrop"
      @click.self="!pending && (dialog = null)"
      @keydown.esc="!pending && (dialog = null)"
    >
      <form
        class="resource-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="resource-dialog-title"
        @submit.prevent="submit"
      >
        <h2 id="resource-dialog-title">
          {{
            dialog === "folder"
              ? "新建文件夹"
              : dialog === "rename"
                ? "重命名"
                : "移到废纸篓／回收站"
          }}
        </h2>
        <p v-if="dialog === 'trash'">
          将选中的 {{ selected.length }} 项移到系统废纸篓／回收站？
        </p>
        <input
          v-else
          ref="nameInput"
          v-model="name"
          aria-label="名称"
          placeholder="请输入名称"
          :disabled="pending"
          required
        />
        <div>
          <button type="button" :disabled="pending" @click="dialog = null">
            取消</button
          ><button
            type="submit"
            :disabled="pending || (dialog !== 'trash' && !name.trim())"
          >
            {{ pending ? "处理中…" : "确定" }}
          </button>
        </div>
      </form>
    </div>
  </section>
</template>

<style scoped>
.resource-manager {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  height: 100%;
  padding: 28px 32px;
  outline: none;
  position: relative;
  overflow: auto;
  color: var(--text-primary);
}
.resource-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 24px;
}
h1 {
  margin: 0 0 9px;
  font-size: 1.6rem;
}
.resource-heading p {
  margin: 0;
  font-size: 0.82rem;
  color: var(--text-secondary);
  overflow-wrap: anywhere;
}
.resource-toolbar,
.resource-navigation,
.resource-selection-bar,
.resource-search {
  display: flex;
  align-items: center;
  gap: 8px;
}
button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 11px;
  border: 1px solid var(--theme-line);
  border-radius: 8px;
  background: var(--surface-raised);
  color: var(--text-primary);
  font: inherit;
  font-size: 0.85rem;
  cursor: pointer;
  white-space: nowrap;
}
button:hover:not(:disabled) {
  background: var(--surface-hover);
}
button:disabled {
  opacity: 0.4;
  cursor: default;
}
.resource-navigation {
  padding: 10px 0;
  border-bottom: 1px solid var(--theme-line-soft);
}
.resource-navigation nav {
  display: flex;
  align-items: center;
  flex: 1;
  flex-wrap: wrap;
  gap: 3px;
  min-width: 0;
}
.resource-navigation nav button {
  border: 0;
  background: transparent;
  white-space: normal;
  overflow-wrap: anywhere;
}
.resource-navigation nav span {
  color: var(--text-secondary);
}
.resource-search {
  padding: 8px 10px;
  min-width: 220px;
  border: 1px solid var(--theme-line);
  border-radius: 8px;
  color: var(--text-secondary);
}
.resource-search input {
  width: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text-primary);
  font: inherit;
  font-size: 0.85rem;
}
.resource-selection-bar {
  min-height: 49px;
  flex-wrap: wrap;
  padding: 6px 0;
}
.resource-selection-bar > span {
  color: var(--text-secondary);
  font-size: 0.8rem;
  margin-right: auto;
}
.resource-selection-bar button {
  border: 0;
  background: transparent;
  font-size: 0.8rem;
}
.resource-list {
  flex: 1;
  min-height: 260px;
  border: 1px solid var(--theme-line-soft);
  border-radius: 12px;
  overflow: auto;
}
.resource-columns,
.resource-row {
  display: grid;
  grid-template-columns: minmax(160px, 1fr) 100px 190px;
  align-items: center;
  gap: 18px;
  padding: 12px 16px;
}
.resource-columns {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--surface-raised);
  color: var(--text-secondary);
  font-size: 0.78rem;
  border-bottom: 1px solid var(--theme-line-soft);
}
.resource-row {
  border-bottom: 1px solid var(--theme-line-soft);
  cursor: default;
  user-select: none;
  font-size: 0.85rem;
}
.resource-row:hover {
  background: var(--surface-hover);
}
.resource-row.selected {
  background: var(--surface-hover);
  box-shadow: inset 3px 0 var(--accent-color, #69a8f4);
}
.resource-row > span,
.resource-row time {
  color: var(--text-secondary);
  font-size: 0.78rem;
}
.resource-name {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.resource-name > div {
  min-width: 0;
}
.resource-name svg {
  flex: 0 0 auto;
  color: var(--text-secondary);
}
.resource-name strong {
  font-weight: 500;
  overflow-wrap: anywhere;
}
.resource-name small {
  display: block;
  margin-top: 5px;
  color: var(--text-secondary);
  overflow-wrap: anywhere;
}
.resource-empty {
  display: grid;
  place-content: center;
  justify-items: center;
  min-height: 260px;
  color: var(--text-secondary);
  font-size: 0.9rem;
}
.resource-limit {
  padding: 12px;
  color: var(--text-secondary);
}
.resource-drop-overlay {
  position: absolute;
  z-index: 20;
  inset: 12px;
  display: grid;
  place-items: center;
  border: 2px dashed #69a8f4;
  border-radius: 12px;
  background: var(--surface-raised);
  opacity: 0.95;
  pointer-events: none;
}
.resource-menu {
  position: fixed;
  z-index: 100;
  display: grid;
  gap: 3px;
  width: 226px;
  padding: 7px;
  border: 1px solid var(--theme-line);
  border-radius: 12px;
  background: var(--surface-raised);
  box-shadow: 0 12px 32px #0005;
}
.resource-menu button {
  justify-content: flex-start;
  border: 0;
  padding: 9px 12px;
}
.danger {
  color: #e68585;
}
.resource-dialog-backdrop {
  position: fixed;
  z-index: 1000;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 24px;
  background: #0008;
}
.resource-dialog {
  width: min(440px, 100%);
  padding: 24px;
  border: 1px solid var(--theme-line);
  border-radius: 14px;
  background: var(--surface-raised);
}
.resource-dialog h2 {
  margin: 0 0 20px;
  font-size: 1.2rem;
}
.resource-dialog p {
  line-height: 1.6;
}
.resource-dialog input {
  box-sizing: border-box;
  width: 100%;
  padding: 10px;
  border: 1px solid var(--theme-line);
  border-radius: 8px;
  background: var(--surface-main);
  color: var(--text-primary);
  font: inherit;
}
.resource-dialog > div {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 24px;
}
@media (max-width: 1000px) {
  .resource-heading {
    align-items: flex-start;
    flex-direction: column;
  }
  .resource-manager {
    padding: 20px;
  }
  .resource-navigation {
    flex-wrap: wrap;
  }
  .resource-search {
    flex: 1;
  }
  .resource-columns,
  .resource-row {
    grid-template-columns: minmax(100px, 1fr) 80px;
  }
  .resource-columns > :last-child,
  .resource-row time {
    display: none;
  }
}
</style>
