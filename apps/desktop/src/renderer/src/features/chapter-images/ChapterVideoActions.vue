<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import {
  isLongChapterImageDirectory,
  type LongDeleteChapterVideoResult,
  type LongReadChapterVideoInput
} from "@deepwrite/contracts";
import type { ChapterImageContext } from "./useChapterImageActions";
import ChapterVideoFileDialog from "./ChapterVideoFileDialog.vue";
import ChapterVideoDeleteDialog from "./ChapterVideoDeleteDialog.vue";
import {
  chapterVideoDataUrl,
  type ChapterVideoExtension
} from "./chapter-video-file";
import { chapterVideoIpcTarget } from "./chapter-video-ipc-target";
import { uiMessage } from "../../ui-feedback";

const props = defineProps<{
  context?: ChapterImageContext | undefined;
  disabled: boolean;
  content: string;
  savedContent?: string | undefined;
  resolveVideoUrl?: ((source: string) => string | undefined) | undefined;
}>();
const emit = defineEmits<{
  deleted: [result: LongDeleteChapterVideoResult, previousContent: string];
  busy: [busy: boolean];
}>();
interface Selection {
  target: LongReadChapterVideoInput;
  offset: number;
}
const menu = ref<(Selection & { x: number; y: number }) | null>(null);
const replacement = ref<
  (Selection & { revision?: string; file?: File }) | null
>(null);
const deletion = ref<
  (Selection & { revision: string; expectedContent: string }) | null
>(null);
const busy = ref(false);
const loading = ref(false);
const versions = ref<Record<string, string>>({});
const previewVersion = Array.from(
  crypto.getRandomValues(new Uint8Array(32)),
  (byte) => byte.toString(16).padStart(2, "0")
).join("");
const menuPanel = ref<HTMLElement | null>(null);
watch(menu, async (value) => {
  if (value) {
    await nextTick();
    menuPanel.value?.querySelector<HTMLButtonElement>("button")?.focus();
  }
});
watch(
  () => `${props.context?.bookId}:${props.context?.chapterCardId}`,
  () => {
    menu.value = null;
    replacement.value = null;
    deletion.value = null;
    versions.value = {};
  }
);
function api() {
  const value = window.deepwrite?.long;
  if (!value) throw new Error("桌面视频服务不可用。");
  return value;
}
function resolveUrl(source: string) {
  const url = props.resolveVideoUrl?.(source);
  if (!url?.startsWith("deepwrite-image://book/")) return url;
  const filename = source.split("/").at(-1) ?? "";
  return `${url.split("?")[0]}?v=${versions.value[filename] ?? previewVersion}`;
}
function onContextMenu(event: MouseEvent) {
  const element = event.target;
  if (!(element instanceof HTMLVideoElement) || !props.context) return;
  const match =
    /^deepwrite-image:\/\/book\/([^/]+)\/([^/]+)\/videos\/([A-Za-z0-9][A-Za-z0-9._-]*\.(?:mp4|webm))(?:\?v=[a-f0-9]{64})?$/iu.exec(
      element.getAttribute("src") ?? ""
    );
  if (
    !match ||
    match[1] !== props.context.bookId ||
    !isLongChapterImageDirectory(match[2] ?? "")
  )
    return;
  event.preventDefault();
  event.stopPropagation();
  if (props.disabled) return;
  const offset = Number(element.dataset.videoOffset);
  if (!Number.isSafeInteger(offset) || offset < 0) return;
  menu.value = {
    target: { ...props.context, filename: match[3]! },
    offset,
    x: Math.max(8, Math.min(event.clientX, window.innerWidth - 180)),
    y: Math.max(8, Math.min(event.clientY, window.innerHeight - 145))
  };
}
async function copy() {
  const selected = menu.value;
  menu.value = null;
  if (!selected) return;
  try {
    await api().copyChapterVideo(chapterVideoIpcTarget(selected.target));
    uiMessage.success("视频文件已复制");
  } catch (error) {
    uiMessage.error(error instanceof Error ? error.message : "复制视频失败。");
  }
}
async function beginReplacement() {
  const selected = menu.value;
  menu.value = null;
  if (!selected) return;
  replacement.value = { target: selected.target, offset: selected.offset };
  loading.value = true;
  try {
    const snapshot = await api().readChapterVideo(
      chapterVideoIpcTarget(selected.target)
    );
    if (replacement.value) replacement.value.revision = snapshot.revision;
  } catch (error) {
    replacement.value = null;
    uiMessage.error(error instanceof Error ? error.message : "读取视频失败。");
  } finally {
    loading.value = false;
  }
}
async function confirmReplacement() {
  const selected = replacement.value;
  if (!selected?.revision || !selected.file || busy.value) return;
  busy.value = true;
  emit("busy", true);
  try {
    const result = await api().replaceChapterVideo({
      ...selected.target,
      expectedRevision: selected.revision,
      videoDataUrl: await chapterVideoDataUrl(selected.file)
    });
    versions.value = {
      ...versions.value,
      [selected.target.filename]: result.revision
    };
    replacement.value = null;
    uiMessage.success("视频已替换并保存");
  } catch (error) {
    uiMessage.error(error instanceof Error ? error.message : "替换视频失败。");
  } finally {
    busy.value = false;
    emit("busy", false);
  }
}
async function beginDeletion() {
  const selected = menu.value;
  menu.value = null;
  if (!selected) return;
  if (props.content !== props.savedContent) {
    uiMessage.error("请先保存当前正文，再删除视频。");
    return;
  }
  loading.value = true;
  try {
    const snapshot = await api().readChapterVideo(
      chapterVideoIpcTarget(selected.target)
    );
    deletion.value = {
      target: selected.target,
      offset: selected.offset,
      expectedContent: props.content,
      revision: snapshot.revision
    };
  } catch (error) {
    uiMessage.error(error instanceof Error ? error.message : "读取视频失败。");
  } finally {
    loading.value = false;
  }
}
async function confirmDeletion() {
  const selected = deletion.value;
  if (!selected || busy.value) return;
  busy.value = true;
  emit("busy", true);
  try {
    const result = await api().deleteChapterVideo({
      ...selected.target,
      offset: selected.offset,
      expectedContent: selected.expectedContent,
      expectedRevision: selected.revision
    });
    deletion.value = null;
    emit("deleted", result, selected.expectedContent);
    uiMessage.success("视频已删除");
  } catch (error) {
    uiMessage.error(error instanceof Error ? error.message : "删除视频失败。");
  } finally {
    busy.value = false;
    emit("busy", false);
  }
}
</script>

<template>
  <div class="chapter-image-actions" @contextmenu="onContextMenu">
    <slot :resolve-url="resolveUrl" />
    <Teleport to="body">
      <div
        v-if="menu"
        class="chapter-image-menu-dismiss"
        @mousedown.self="menu = null"
        @contextmenu.prevent="menu = null"
        @keydown.esc.stop="menu = null"
      >
        <div
          ref="menuPanel"
          class="chapter-image-menu"
          role="menu"
          aria-label="正文视频操作"
          :style="{ left: `${menu.x}px`, top: `${menu.y}px` }"
        >
          <button type="button" role="menuitem" @click="copy">复制视频</button>
          <button type="button" role="menuitem" @click="beginReplacement">
            替换视频
          </button>
          <button type="button" role="menuitem" @click="beginDeletion">
            删除视频
          </button>
        </div>
      </div>
    </Teleport>
    <ChapterVideoFileDialog
      v-if="replacement"
      mode="replace"
      :video="replacement.file"
      :expected-extension="
        replacement.target.filename.split('.').at(-1) as ChapterVideoExtension
      "
      :busy="busy"
      :loading="loading"
      :ready="Boolean(replacement.revision)"
      @video="
        (file) => {
          if (replacement) replacement.file = file;
        }
      "
      @close="
        () => {
          if (!busy) replacement = null;
        }
      "
      @confirm="confirmReplacement"
    />
    <ChapterVideoDeleteDialog
      v-if="deletion"
      :filename="deletion.target.filename"
      :busy="busy"
      @close="
        () => {
          if (!busy) deletion = null;
        }
      "
      @confirm="confirmDeletion"
    />
  </div>
</template>

<style scoped src="./chapter-image-actions.css" />
