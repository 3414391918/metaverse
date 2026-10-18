<script setup lang="ts">
import type {
  BodyTextFormat,
  BodyTextFormats,
  BodyTextFormatChange,
  BodyTextKind,
  TextViewMode
} from "@deepwrite/contracts";
import PopupSelect from "./PopupSelect.vue";

defineProps<{
  defaultTextViewMode: TextViewMode;
  bodyTextFormats: BodyTextFormats;
}>();
const emit = defineEmits<{
  updateDefaultTextViewMode: [mode: TextViewMode];
  updateBodyTextFormat: [change: BodyTextFormatChange];
}>();
const textViewModeOptions = [
  { value: "edit", label: "编辑" },
  { value: "preview", label: "预览" }
];
const formatOptions: { value: BodyTextFormat; label: string }[] = [
  { value: "flush-compact", label: "不缩进，段间不空行" },
  { value: "flush-spaced", label: "不缩进，段间空一行" },
  { value: "indent-compact", label: "缩进两字，段间不空行" },
  { value: "indent-spaced", label: "缩进两字，段间空一行" }
];
const fields: { kind: BodyTextKind; label: string }[] = [
  { kind: "long", label: "小说正文格式规范" }
];
</script>

<template>
  <section class="settings-group">
    <h2 class="settings-group-title">正文文本</h2>
    <div class="settings-card">
      <div class="settings-item body-text-setting">
        <span class="settings-item-text"
          ><strong>默认文本模式</strong
          ><small
            >打开软件或切换文本时的默认显示方式，文本页内仍可随时手动切换</small
          ></span
        >
        <PopupSelect
          class="body-text-select"
          :model-value="defaultTextViewMode"
          :options="textViewModeOptions"
          accessible-label="选择默认文本模式"
          align="end"
          :menu-min-width="240"
          @update:model-value="
            emit('updateDefaultTextViewMode', String($event) as TextViewMode)
          "
        />
      </div>
      <div
        v-for="field in fields"
        :key="field.kind"
        class="settings-item body-text-setting"
      >
        <span class="settings-item-text"
          ><strong>{{ field.label }}</strong
          ><small
            >点击正文工具栏的“一键规范格式”时应用，可撤销；缩进两字使用两个全角空格。</small
          ></span
        >
        <PopupSelect
          class="body-text-select"
          :model-value="bodyTextFormats[field.kind]"
          :options="formatOptions"
          :accessible-label="`选择${field.label}`"
          align="end"
          :menu-min-width="240"
          @update:model-value="
            emit('updateBodyTextFormat', {
              kind: field.kind,
              format: String($event) as BodyTextFormat
            })
          "
        />
      </div>
    </div>
  </section>
</template>

<style scoped src="./settings-page.css"></style>
<style scoped>
.body-text-setting {
  flex-wrap: wrap;
  gap: 16px;
}
.body-text-setting .settings-item-text {
  min-width: min(240px, 100%);
}
.body-text-select {
  width: 260px;
  max-width: 100%;
  flex: 0 1 260px;
}
</style>
