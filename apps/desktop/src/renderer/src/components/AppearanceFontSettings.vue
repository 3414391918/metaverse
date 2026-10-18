<script setup lang="ts">
import { computed, ref } from "vue";
import {
  listAppearanceEditorFontFamilyOptions,
  listAppearanceUiFontFamilyOptions,
  type AppearanceCustomFont
} from "@deepwrite/contracts/renderer";
import { useAppearance } from "../composables/useAppearance";
import {
  appearanceFontFailureLabel,
  customFontOptionStyle,
  useAppearanceFonts
} from "../composables/useAppearanceFonts";
import { uiMessage } from "../ui-feedback";
import AppearanceFontDeleteDialog from "./AppearanceFontDeleteDialog.vue";
import PopupSelect, {
  type PopupSelectOption,
  type PopupSelectValue
} from "./PopupSelect.vue";

const appearance = useAppearance();
const localFonts = useAppearanceFonts();
const pendingDelete = ref<AppearanceCustomFont | null>(null);
const UI_FONT_LOADING_VALUE = "appearance-ui-font-loading";
const EDITOR_FONT_LOADING_VALUE = "appearance-editor-font-loading";
const uiFontPending = ref(false);
const editorFontPending = ref(false);
let uiFontSelectionIntent = 0;
let editorFontSelectionIntent = 0;

const builtinUiOptions: PopupSelectOption[] =
  listAppearanceUiFontFamilyOptions().map((option) => ({
    value: option.value,
    label: option.label,
    style: { fontFamily: option.stack }
  }));
const builtinEditorOptions: PopupSelectOption[] =
  listAppearanceEditorFontFamilyOptions().map((option) => ({
    value: option.value,
    label: option.label,
    style: { fontFamily: option.stack }
  }));

const customOptions = computed<PopupSelectOption[]>(() =>
  localFonts.fonts.value.map((font) => ({
    value: font.id,
    label: font.displayName,
    description: `本地字体 · ${font.format.toUpperCase()}`,
    style: customFontOptionStyle(font.id),
    actionIcon: "trash",
    actionLabel: `删除字体 ${font.displayName}`
  }))
);
const uiFontOptions = computed(() => [
  ...builtinUiOptions,
  ...customOptions.value
]);
const editorFontOptions = computed(() => [
  ...builtinEditorOptions,
  ...customOptions.value
]);
const uiFontModelValue = computed(() =>
  uiFontPending.value ? UI_FONT_LOADING_VALUE : appearance.state.uiFontFamily
);
const editorFontModelValue = computed(() =>
  editorFontPending.value
    ? EDITOR_FONT_LOADING_VALUE
    : appearance.state.editorFontFamily
);
const deleting = computed(
  () =>
    pendingDelete.value !== null &&
    localFonts.removingIds.includes(pendingDelete.value.id)
);

async function selectUiFontFamily(value: PopupSelectValue): Promise<void> {
  const intent = ++uiFontSelectionIntent;
  uiFontPending.value = true;
  try {
    await appearance.setUiFontFamily(String(value));
  } catch {
    if (intent === uiFontSelectionIntent) {
      uiMessage.error("无法加载这个界面字体，已保留原来的选择");
    }
  } finally {
    if (intent === uiFontSelectionIntent) uiFontPending.value = false;
  }
}

async function selectEditorFontFamily(value: PopupSelectValue): Promise<void> {
  const intent = ++editorFontSelectionIntent;
  editorFontPending.value = true;
  try {
    await appearance.setEditorFontFamily(String(value));
  } catch {
    if (intent === editorFontSelectionIntent) {
      uiMessage.error("无法加载这个正文字体，已保留原来的选择");
    }
  } finally {
    if (intent === editorFontSelectionIntent) editorFontPending.value = false;
  }
}

function requestDelete(value: PopupSelectValue): void {
  pendingDelete.value =
    localFonts.fonts.value.find((font) => font.id === String(value)) ?? null;
}

async function installFonts(): Promise<void> {
  try {
    const outcome = await localFonts.install();
    if (outcome.result.status === "canceled") return;

    if (outcome.loadedIds.length > 0) {
      uiMessage.success(`已导入 ${outcome.loadedIds.length} 个本地字体`);
    }
    if (outcome.result.duplicateIds.length > 0) {
      uiMessage.info(`已跳过 ${outcome.result.duplicateIds.length} 个重复字体`);
    }
    const failureCount =
      outcome.result.rejected.length + outcome.loadFailures.length;
    if (failureCount > 0) {
      const firstFailure = outcome.result.rejected[0];
      const detail = firstFailure
        ? appearanceFontFailureLabel(firstFailure)
        : `${outcome.loadFailures[0]?.displayName ?? "字体"}：加载失败`;
      uiMessage.warning(`${failureCount} 个字体未能导入。${detail}`, {
        duration: 5_000
      });
    }
    if (
      outcome.loadedIds.length === 0 &&
      outcome.result.duplicateIds.length === 0 &&
      failureCount === 0
    ) {
      uiMessage.info("没有选择字体文件");
    }
  } catch {
    uiMessage.error("无法导入字体，请稍后重试");
  }
}

async function confirmDelete(): Promise<void> {
  const font = pendingDelete.value;
  if (!font || deleting.value) return;
  try {
    const result = await localFonts.remove(font.id);
    await appearance.applyDesktopSettings(result.appearance.settings);
    pendingDelete.value = null;
    if (result.removed) uiMessage.success(`已删除字体“${font.displayName}”`);
    else uiMessage.info("这个字体已经不存在");
  } catch {
    uiMessage.error("无法删除字体，请稍后重试");
  }
}
</script>

<template>
  <section class="appearance-font-settings" aria-labelledby="font-heading">
    <h2 id="font-heading">字体</h2>
    <div class="font-settings-card">
      <div class="font-setting-row">
        <span class="font-setting-copy">
          <strong>界面字体</strong>
          <small>侧栏、设置和对话等界面文字</small>
        </span>
        <PopupSelect
          class="font-select-control"
          :model-value="uiFontModelValue"
          :options="uiFontOptions"
          accessible-label="选择界面字体"
          :placeholder="uiFontPending ? '正在加载字体…' : '请选择'"
          align="end"
          :menu-min-width="240"
          :disabled="!localFonts.ready.value || localFonts.installing.value"
          @update:model-value="selectUiFontFamily"
          @option-action="requestDelete"
        />
      </div>
      <div class="font-setting-row">
        <span class="font-setting-copy">
          <strong>正文字体</strong>
          <small>文稿标题、正文与预览</small>
        </span>
        <PopupSelect
          class="font-select-control"
          :model-value="editorFontModelValue"
          :options="editorFontOptions"
          accessible-label="选择正文字体"
          :placeholder="editorFontPending ? '正在加载字体…' : '请选择'"
          align="end"
          :menu-min-width="240"
          :disabled="!localFonts.ready.value || localFonts.installing.value"
          @update:model-value="selectEditorFontFamily"
          @option-action="requestDelete"
        />
      </div>
      <div class="font-setting-row">
        <span class="font-setting-copy">
          <strong>本地字体</strong>
          <small>上传 TTF 或 OTF 文件，字体会保存到 DeepWrite 本机目录</small>
        </span>
        <button
          class="font-upload-button"
          type="button"
          :disabled="!localFonts.ready.value || localFonts.installing.value"
          @click="installFonts"
        >
          {{ localFonts.installing.value ? "正在导入…" : "上传字体" }}
        </button>
      </div>
    </div>
  </section>

  <AppearanceFontDeleteDialog
    :font="pendingDelete"
    :busy="deleting"
    @close="pendingDelete = null"
    @confirm="confirmDelete"
  />
</template>

<style scoped>
.appearance-font-settings {
  margin-top: 40px;
}

.appearance-font-settings h2 {
  margin: 0 0 14px;
  color: var(--text-primary);
  font-size: 1.07143rem;
  font-weight: 640;
}

.font-settings-card {
  display: flex;
  flex-direction: column;
  padding: 6px 0;
  border: 1px solid var(--theme-line-soft);
  border-radius: 13px;
  background: var(--surface-raised);
}

.font-setting-row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 18px;
}

.font-setting-row:not(:last-child) {
  border-bottom: 1px solid var(--theme-line-soft);
}

.font-setting-copy {
  display: flex;
  min-width: min(240px, 100%);
  flex: 1;
  flex-direction: column;
  gap: 3px;
}

.font-setting-copy strong {
  color: var(--text-primary);
  font-size: 1rem;
  font-weight: 590;
}

.font-setting-copy small {
  color: var(--text-secondary);
  font-size: 0.892857rem;
  line-height: 1.45;
}

.font-select-control {
  width: 240px;
  min-width: 170px;
  max-width: 240px;
  flex: 0 1 240px;
}

.font-upload-button {
  min-width: 112px;
  min-height: 36px;
  padding: 7px 14px;
  border: 1px solid color-mix(in srgb, var(--neutral-solid) 88%, transparent);
  border-radius: 9px;
  background: var(--neutral-solid);
  color: var(--accent-contrast, #fff);
  font: inherit;
  font-size: 0.892857rem;
  font-weight: 570;
  cursor: pointer;
}

.font-upload-button:hover:not(:disabled) {
  background: color-mix(
    in srgb,
    var(--neutral-solid) 88%,
    var(--theme-foreground)
  );
}

.font-upload-button:disabled {
  cursor: not-allowed;
  opacity: 0.52;
}

@media (max-width: 760px) {
  .font-setting-row {
    align-items: stretch;
    flex-direction: column;
  }

  .font-select-control {
    width: 100%;
    max-width: none;
    flex-basis: auto;
  }

  .font-upload-button {
    align-self: flex-end;
  }
}
</style>
