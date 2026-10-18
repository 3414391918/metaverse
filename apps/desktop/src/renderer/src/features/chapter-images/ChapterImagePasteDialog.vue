<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from "vue";
import ImageDialog from "../character-assets/CharacterAssetDialog.vue";
import { uiMessage } from "../../ui-feedback";
import { pastedImagePng, singlePastedImage } from "./clipboard-image";

const props = defineProps<{
  mode: "add" | "replace";
  image?: string | undefined;
  loading?: boolean;
  ready: boolean;
  busy: boolean;
}>();
const emit = defineEmits<{ close: []; confirm: []; image: [png: string] }>();
const pasting = ref(false);
let generation = 0;
async function paste(event?: ClipboardEvent) {
  event?.preventDefault();
  event?.stopPropagation();
  if (props.busy || props.loading || pasting.value) return;
  const current = ++generation;
  pasting.value = true;
  try {
    const files = Array.from(event?.clipboardData?.files ?? []);
    let png: string;
    if (files.length) png = await pastedImagePng(singlePastedImage(files));
    else {
      const api = window.deepwrite?.long;
      if (!api) throw new Error("桌面图片服务不可用。");
      const snapshot = await api.readClipboardImage();
      if (!snapshot) throw new Error("剪贴板中没有图片，请先复制一张图片。");
      png = snapshot.pngDataUrl;
    }
    if (current === generation) emit("image", png);
  } catch (error) {
    if (current === generation)
      uiMessage.error(
        error instanceof Error ? error.message : "无法粘贴图片。"
      );
  } finally {
    if (current === generation) pasting.value = false;
  }
}
const onPaste = (event: ClipboardEvent) => {
  void paste(event);
};
const close = () => {
  if (!pasting.value && !props.busy) emit("close");
};
onMounted(() => document.addEventListener("paste", onPaste, true));
onBeforeUnmount(() => {
  generation++;
  document.removeEventListener("paste", onPaste, true);
});
</script>

<template>
  <ImageDialog
    :title="mode === 'add' ? '新增图片' : '替换图片'"
    :busy="busy || pasting"
    @close="close"
  >
    <div class="chapter-image-replacement">
      <p>
        {{
          mode === "add"
            ? "粘贴一张图片，确认后添加到正文当前位置。"
            : "粘贴一张图片，确认后替换当前图片。"
        }}
      </p>
      <div
        class="chapter-image-paste-area"
        tabindex="0"
        :aria-label="mode === 'add' ? '粘贴新增图片' : '粘贴替换图片'"
      >
        <img
          v-if="image"
          :src="image"
          :alt="mode === 'add' ? '待添加图片' : '待替换图片'"
        />
        <span v-else>{{
          loading
            ? "正在读取原图…"
            : pasting
              ? "正在读取粘贴图片…"
              : "按 Command / Ctrl + V 粘贴图片"
        }}</span>
      </div>
      <button
        type="button"
        :disabled="loading || busy || pasting"
        @click="paste()"
      >
        粘贴图片
      </button>
    </div>
    <template #actions>
      <button type="button" :disabled="busy || pasting" @click="close">
        取消
      </button>
      <button
        type="button"
        class="chapter-image-confirm"
        :disabled="!image || !ready || loading || busy || pasting"
        @click="emit('confirm')"
      >
        {{
          busy
            ? mode === "add"
              ? "正在添加…"
              : "正在替换…"
            : mode === "add"
              ? "确认添加"
              : "确认替换"
        }}
      </button>
    </template>
  </ImageDialog>
</template>

<style scoped src="./chapter-image-actions.css" />
