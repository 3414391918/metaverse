<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import ImageDialog from "../character-assets/CharacterAssetDialog.vue";
import { uiMessage } from "../../ui-feedback";
import {
  chapterVideoExtension,
  type ChapterVideoExtension
} from "./chapter-video-file";

const props = defineProps<{
  mode: "add" | "replace";
  video?: File | undefined;
  expectedExtension?: ChapterVideoExtension | undefined;
  busy: boolean;
  loading?: boolean;
  ready: boolean;
}>();
const emit = defineEmits<{ close: []; confirm: []; video: [file: File] }>();
const fileInput = ref<HTMLInputElement | null>(null);
const previewUrl = ref<string>();
watch(
  () => props.video,
  (file) => {
    if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
    previewUrl.value = file ? URL.createObjectURL(file) : undefined;
  },
  { immediate: true }
);
onBeforeUnmount(() => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  document.removeEventListener("paste", onPaste, true);
});

function accept(file: File | undefined) {
  if (!file || props.busy || props.loading) return;
  try {
    const extension = chapterVideoExtension(file);
    if (props.expectedExtension && extension !== props.expectedExtension)
      throw new Error(
        `替换视频请使用 ${props.expectedExtension.toUpperCase()} 格式。`
      );
    emit("video", file);
  } catch (error) {
    uiMessage.error(error instanceof Error ? error.message : "视频无法读取。");
  }
}
function onPaste(event: ClipboardEvent) {
  const file = Array.from(event.clipboardData?.files ?? []).find((item) =>
    /\.(?:mp4|webm)$/iu.test(item.name)
  );
  if (!file) return;
  event.preventDefault();
  event.stopPropagation();
  accept(file);
}
onMounted(() => document.addEventListener("paste", onPaste, true));
</script>

<template>
  <ImageDialog
    :title="mode === 'add' ? '新增视频' : '替换视频'"
    :busy="busy"
    @close="emit('close')"
  >
    <div class="chapter-video-select">
      <p>
        {{
          mode === "add"
            ? "选择或粘贴一个视频文件，确认后插入正文当前位置。"
            : `选择或粘贴一个 ${expectedExtension?.toUpperCase() ?? ""} 视频文件替换当前视频。`
        }}
      </p>
      <div
        class="chapter-video-select-area"
        @dragover.prevent
        @drop.prevent="accept($event.dataTransfer?.files[0])"
      >
        <video
          v-if="previewUrl"
          :src="previewUrl"
          controls
          preload="metadata"
          playsinline
        />
        <span v-else>{{
          loading ? "正在读取视频…" : "选择视频文件，或在此粘贴、拖入视频"
        }}</span>
      </div>
      <input
        ref="fileInput"
        class="chapter-video-file-input"
        type="file"
        :accept="
          expectedExtension
            ? `video/${expectedExtension},.${expectedExtension}`
            : 'video/mp4,video/webm,.mp4,.webm'
        "
        @change="accept(($event.target as HTMLInputElement).files?.[0])"
      />
      <button
        type="button"
        :disabled="busy || loading"
        @click="fileInput?.click()"
      >
        选择视频
      </button>
    </div>
    <template #actions>
      <button type="button" :disabled="busy" @click="emit('close')">
        取消
      </button>
      <button
        type="button"
        class="chapter-video-confirm"
        :disabled="!video || !ready || busy || loading"
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

<style scoped>
.chapter-video-select {
  display: grid;
  gap: 14px;
}
.chapter-video-select p {
  margin: 0;
  color: var(--text-secondary);
}
.chapter-video-select-area {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 190px;
  padding: 12px;
  border: 1px dashed var(--theme-line);
  border-radius: 12px;
  background: var(--surface-main);
  color: var(--text-secondary);
}
.chapter-video-select-area video {
  display: block;
  max-width: 100%;
  max-height: min(45vh, 440px);
}
.chapter-video-file-input {
  display: none;
}
.chapter-video-select > button {
  justify-self: start;
}
button {
  font: inherit;
  cursor: pointer;
  padding: 8px 14px;
  border: 1px solid var(--theme-line);
  border-radius: 8px;
  background: var(--surface-muted);
  color: var(--text-primary);
}
button:disabled {
  cursor: default;
  opacity: 0.5;
}
.chapter-video-confirm {
  background: var(--button-primary-bg, var(--text-primary));
  color: var(--button-primary-text, var(--surface-main));
}
</style>
