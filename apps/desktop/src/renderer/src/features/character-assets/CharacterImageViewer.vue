<script setup lang="ts">
import { computed, ref } from "vue";
import CharacterAssetDialog from "./CharacterAssetDialog.vue";
import { zoomTransform, panTransform } from "../../utils/imageViewerTransform";
const props = defineProps<{ src: string; label: string; copying: boolean }>();
const emit = defineEmits<{ close: []; copy: [] }>();
const transform = ref({ scale: 1, x: 0, y: 0 });
const viewport = ref<HTMLElement | null>(null);
const image = ref<HTMLImageElement | null>(null);
const drag = ref<{ id: number; x: number; y: number } | null>(null);
const imageStyle = computed(() => ({
  transform: `translate(${transform.value.x}px, ${transform.value.y}px) scale(${transform.value.scale})`
}));
function zoom(factor: number, event?: WheelEvent) {
  const box = viewport.value?.getBoundingClientRect();
  transform.value = zoomTransform(
    transform.value,
    transform.value.scale * factor,
    event && box ? event.clientX - box.left - box.width / 2 : 0,
    event && box ? event.clientY - box.top - box.height / 2 : 0
  );
}
function reset() {
  transform.value = { scale: 1, x: 0, y: 0 };
}
function original() {
  if (image.value)
    transform.value = {
      scale: Math.min(8, image.value.naturalWidth / image.value.width),
      x: 0,
      y: 0
    };
}
function pointerDown(event: PointerEvent) {
  if (event.button !== 0) return;
  drag.value = { id: event.pointerId, x: event.clientX, y: event.clientY };
  viewport.value?.setPointerCapture(event.pointerId);
}
function pointerMove(event: PointerEvent) {
  const current = drag.value;
  if (!current || current.id !== event.pointerId) return;
  transform.value = panTransform(
    transform.value,
    event.clientX - current.x,
    event.clientY - current.y,
    image.value?.width ?? 400,
    image.value?.height ?? 300
  );
  drag.value = { id: current.id, x: event.clientX, y: event.clientY };
}
function copyKey(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "c") {
    event.preventDefault();
    emit("copy");
  }
}
</script>
<template>
  <CharacterAssetDialog :title="props.label" wide @close="emit('close')">
    <div class="image-controls" @keydown="copyKey">
      <button type="button" aria-label="缩小图片" @click="zoom(1 / 1.25)">
        −</button
      ><span>{{ Math.round(transform.scale * 100) }}%</span
      ><button type="button" aria-label="放大图片" @click="zoom(1.25)">
        ＋
      </button>
      <button type="button" @click="reset">适合窗口</button
      ><button type="button" @click="original">原始尺寸</button
      ><button type="button" :disabled="copying" @click="emit('copy')">
        {{ copying ? "复制中…" : "复制图片" }}
      </button>
    </div>
    <div
      ref="viewport"
      class="image-viewport"
      :class="{ 'is-dragging': drag }"
      tabindex="0"
      aria-label="图片查看区，可滚轮缩放、拖动查看，按 Command 或 Ctrl 加 C 复制图片"
      @keydown="copyKey"
      @wheel.prevent="zoom($event.deltaY < 0 ? 1.12 : 1 / 1.12, $event)"
      @pointerdown="pointerDown"
      @pointermove="pointerMove"
      @pointerup="drag = null"
      @pointercancel="drag = null"
    >
      <img
        ref="image"
        :src="src"
        :alt="label"
        :style="imageStyle"
        draggable="false"
        @load="reset"
      />
    </div>
  </CharacterAssetDialog>
</template>
<style scoped>
.image-controls {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 14px;
}
button {
  font: inherit;
  border: 1px solid var(--theme-line);
  padding: 7px 12px;
  border-radius: 8px;
  background: var(--surface-muted);
  color: var(--text-primary);
  cursor: pointer;
}
.image-viewport {
  height: min(68vh, 800px);
  min-height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: var(--surface-main);
  border: 1px solid var(--theme-line);
  border-radius: 12px;
  cursor: grab;
  touch-action: none;
  user-select: none;
}
.image-viewport.is-dragging {
  cursor: grabbing;
}
.image-viewport img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  flex-shrink: 0;
  transform-origin: center;
  pointer-events: none;
}
</style>
