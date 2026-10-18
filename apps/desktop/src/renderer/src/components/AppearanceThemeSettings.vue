<script setup lang="ts">
import { computed, ref } from "vue";
import {
  FONT_SIZE_LIMITS,
  parseThemeFile,
  serializeTheme,
  themePresets,
  useAppearance,
  type AppearanceMode,
  type ColorScheme,
  type ThemeConfig
} from "../composables/useAppearance";
import { uiMessage } from "../ui-feedback";
import PopupSelect from "./PopupSelect.vue";

const appearance = useAppearance();
const importInput = ref<HTMLInputElement | null>(null);
const accentColorInput = ref<HTMLInputElement | null>(null);
const backgroundColorInput = ref<HTMLInputElement | null>(null);
const foregroundColorInput = ref<HTMLInputElement | null>(null);

const editingScheme = computed<ColorScheme>(() =>
  appearance.state.mode === "system"
    ? appearance.resolvedScheme.value
    : appearance.state.mode
);
const editingTheme = computed(() => appearance.state[editingScheme.value]);
const themeSectionTitle = computed(() =>
  editingScheme.value === "light" ? "浅色主题" : "深色主题"
);
const themePresetOptions = computed(() => [
  ...(editingTheme.value.preset === "custom"
    ? [{ value: "custom", label: "自定义", disabled: true }]
    : []),
  ...themePresets.map((preset) => ({ value: preset.id, label: preset.label }))
]);

const appearanceModes: Array<{ id: AppearanceMode; label: string }> = [
  { id: "system", label: "系统" },
  { id: "light", label: "浅色" },
  { id: "dark", label: "深色" }
];

function updateTheme<K extends keyof ThemeConfig>(
  key: K,
  value: ThemeConfig[K]
): void {
  appearance.updateTheme(editingScheme.value, { [key]: value });
}

type ThemeColorKey = "accent" | "background" | "foreground";
type ThemeFontSizeKey = "uiFontSize" | "codeFontSize";

function applyColor(key: ThemeColorKey, value: string): void {
  appearance.updateTheme(editingScheme.value, {
    [key]: value.trim().toUpperCase(),
    preset: "custom"
  });
}

function openColorPicker(key: ThemeColorKey): void {
  const input =
    key === "accent"
      ? accentColorInput.value
      : key === "background"
        ? backgroundColorInput.value
        : foregroundColorInput.value;
  input?.click();
}

function previewColor(key: ThemeColorKey, event: Event): void {
  const value = (event.target as HTMLInputElement).value;
  if (/^#[\da-f]{6}$/i.test(value.trim())) applyColor(key, value);
}

function commitColor(key: ThemeColorKey, event: Event): void {
  const input = event.target as HTMLInputElement;
  if (!/^#[\da-f]{6}$/i.test(input.value.trim())) {
    input.value = editingTheme.value[key];
    uiMessage.warning("请输入 6 位十六进制颜色，例如 #339CFF");
    return;
  }
  applyColor(key, input.value);
}

function parseFontSize(
  key: ThemeFontSizeKey,
  input: HTMLInputElement
): number | null {
  if (input.value.trim() === "") return null;
  const value = Number(input.value);
  const limits = FONT_SIZE_LIMITS[key];
  return Number.isFinite(value) && value >= limits.min && value <= limits.max
    ? Math.round(value * 2) / 2
    : null;
}

function previewFontSize(key: ThemeFontSizeKey, event: Event): void {
  const value = parseFontSize(key, event.target as HTMLInputElement);
  if (value !== null) updateTheme(key, value);
}

function commitFontSize(key: ThemeFontSizeKey, event: Event): void {
  const input = event.target as HTMLInputElement;
  const value = parseFontSize(key, input);
  const limits = FONT_SIZE_LIMITS[key];
  if (value === null) {
    input.value = String(editingTheme.value[key]);
    uiMessage.warning(`字号请输入 ${limits.min}–${limits.max} px 之间的数值`);
    return;
  }
  updateTheme(key, value);
  input.value = String(value);
}

async function writeClipboard(value: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value);
    return;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    textarea.style.pointerEvents = "none";
    document.body.append(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    if (!copied) throw new Error("Clipboard unavailable");
  }
}

async function copyTheme(): Promise<void> {
  try {
    await writeClipboard(serializeTheme(editingScheme.value));
    uiMessage.success(`${themeSectionTitle.value}配置已复制`);
  } catch {
    uiMessage.error("复制失败，请稍后重试");
  }
}

function openImport(): void {
  importInput.value?.click();
}

async function importThemeFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  try {
    const parsed = parseThemeFile(await file.text());
    const target = parsed.scheme ?? editingScheme.value;
    appearance.importTheme(target, parsed.theme);
    uiMessage.success(`已导入${target === "light" ? "浅色" : "深色"}主题`);
  } catch (error: unknown) {
    uiMessage.error(
      error instanceof Error ? error.message : "无法读取主题文件"
    );
  }
}
</script>

<template>
  <section class="appearance-theme-settings" aria-labelledby="theme-heading">
    <h2 id="theme-heading" class="appearance-heading">主题</h2>
    <div class="theme-mode-grid" role="radiogroup" aria-label="外观主题">
      <button
        v-for="mode in appearanceModes"
        :key="mode.id"
        class="theme-mode-option"
        :class="{ 'is-active': appearance.state.mode === mode.id }"
        type="button"
        role="radio"
        :aria-checked="appearance.state.mode === mode.id"
        @click="appearance.setMode(mode.id)"
      >
        <span class="theme-preview" :class="`is-${mode.id}`" aria-hidden="true">
          <span class="preview-top-line" />
          <span class="preview-sub-line" />
          <span class="preview-window"> <i /><i /><i /> </span>
        </span>
        <strong>{{ mode.label }}</strong>
      </button>
    </div>

    <div class="theme-config-card">
      <div class="theme-config-header">
        <h2>{{ themeSectionTitle }}</h2>
        <div class="theme-config-actions">
          <input
            ref="importInput"
            class="theme-file-input"
            type="file"
            accept="application/json,.json"
            @change="importThemeFile"
          />
          <button type="button" @click="openImport">导入</button>
          <button type="button" @click="copyTheme">复制主题</button>
          <PopupSelect
            class="preset-select-control"
            :model-value="editingTheme.preset"
            :options="themePresetOptions"
            accessible-label="主题预设"
            variant="preset"
            align="end"
            :menu-min-width="188"
            @update:model-value="
              appearance.applyPreset(editingScheme, String($event))
            "
          >
            <template #prefix><span class="preset-badge">Aa</span></template>
          </PopupSelect>
        </div>
      </div>

      <div class="theme-setting-row">
        <label for="accent-color">强调色</label>
        <div
          class="color-control"
          :style="{ backgroundColor: editingTheme.accent, color: '#fff' }"
          @click="openColorPicker('accent')"
        >
          <span class="color-swatch" aria-hidden="true">
            <input
              id="accent-color"
              ref="accentColorInput"
              type="color"
              :value="editingTheme.accent.toLowerCase()"
              aria-label="选择强调色"
              @click.stop
              @input="
                applyColor('accent', ($event.target as HTMLInputElement).value)
              "
            />
          </span>
          <input
            :value="editingTheme.accent"
            aria-label="输入强调色"
            spellcheck="false"
            @click.stop
            @input="previewColor('accent', $event)"
            @change="commitColor('accent', $event)"
          />
        </div>
      </div>
      <div class="theme-setting-row">
        <label for="background-color">背景</label>
        <div
          class="color-control"
          :class="{ 'is-light': editingScheme === 'light' }"
          :style="{
            backgroundColor: editingTheme.background,
            color: editingTheme.foreground
          }"
          @click="openColorPicker('background')"
        >
          <span class="color-swatch" aria-hidden="true">
            <input
              id="background-color"
              ref="backgroundColorInput"
              type="color"
              :value="editingTheme.background.toLowerCase()"
              aria-label="选择背景色"
              @click.stop
              @input="
                applyColor(
                  'background',
                  ($event.target as HTMLInputElement).value
                )
              "
            />
          </span>
          <input
            :value="editingTheme.background"
            aria-label="输入背景色"
            spellcheck="false"
            @click.stop
            @input="previewColor('background', $event)"
            @change="commitColor('background', $event)"
          />
        </div>
      </div>
      <div class="theme-setting-row">
        <label for="foreground-color">前景</label>
        <div
          class="color-control"
          :class="{ 'is-light': editingScheme === 'light' }"
          :style="{
            backgroundColor: editingTheme.foreground,
            color: editingTheme.background
          }"
          @click="openColorPicker('foreground')"
        >
          <span class="color-swatch" aria-hidden="true">
            <input
              id="foreground-color"
              ref="foregroundColorInput"
              type="color"
              :value="editingTheme.foreground.toLowerCase()"
              aria-label="选择前景色"
              @click.stop
              @input="
                applyColor(
                  'foreground',
                  ($event.target as HTMLInputElement).value
                )
              "
            />
          </span>
          <input
            :value="editingTheme.foreground"
            aria-label="输入前景色"
            spellcheck="false"
            @click.stop
            @input="previewColor('foreground', $event)"
            @change="commitColor('foreground', $event)"
          />
        </div>
      </div>
      <div class="theme-setting-row">
        <label for="ui-font-size">UI 字号</label>
        <div class="font-size-control">
          <input
            id="ui-font-size"
            type="number"
            :min="FONT_SIZE_LIMITS.uiFontSize.min"
            :max="FONT_SIZE_LIMITS.uiFontSize.max"
            step="0.5"
            :value="editingTheme.uiFontSize"
            :placeholder="String(editingTheme.uiFontSize)"
            inputmode="decimal"
            required
            aria-label="UI 字号（像素）"
            @input="previewFontSize('uiFontSize', $event)"
            @change="commitFontSize('uiFontSize', $event)"
          />
          <span>px</span>
        </div>
      </div>
      <div class="theme-setting-row">
        <label for="code-font-size">代码字号</label>
        <div class="font-size-control is-code">
          <input
            id="code-font-size"
            type="number"
            :min="FONT_SIZE_LIMITS.codeFontSize.min"
            :max="FONT_SIZE_LIMITS.codeFontSize.max"
            step="0.5"
            :value="editingTheme.codeFontSize"
            :placeholder="String(editingTheme.codeFontSize)"
            inputmode="decimal"
            required
            aria-label="代码字号（像素）"
            @input="previewFontSize('codeFontSize', $event)"
            @change="commitFontSize('codeFontSize', $event)"
          />
          <span>px</span>
        </div>
      </div>
      <label class="theme-setting-row is-toggle">
        <span>半透明侧边栏</span>
        <span class="theme-toggle">
          <input
            type="checkbox"
            :checked="editingTheme.translucentSidebar"
            @change="
              updateTheme(
                'translucentSidebar',
                ($event.target as HTMLInputElement).checked
              )
            "
          />
        </span>
      </label>
    </div>
  </section>
</template>

<style scoped src="./appearance-theme-settings.css"></style>
