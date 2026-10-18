<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useId } from "vue";
import type { PromptTemplate } from "@deepwrite/contracts";
import { pastedImagePng } from "../features/chapter-images/clipboard-image";
import CharacterImageViewer from "../features/character-assets/CharacterImageViewer.vue";
import { uiMessage } from "../ui-feedback";
import AppIcon from "./AppIcon.vue";

const props = defineProps<{
  draft: PromptTemplate;
  busy: boolean;
  existing: boolean;
  previews: Record<string, string>;
}>();
const emit = defineEmits<{
  close: [];
  save: [];
  delete: [];
  updateName: [value: string];
  updateContent: [value: string];
  addImage: [pngDataUrl: string];
  removeImage: [id: string];
}>();
const titleId = useId();
const nameInput = ref<HTMLInputElement>();
const dialog = ref<HTMLElement>();
const readingImage = ref(false);
const copyingImage = ref(false);
const viewer = ref<{ id: string; label: string } | null>(null);
let previousFocus: HTMLElement | null = null;
async function copyImage() {
  const source = viewer.value && props.previews[viewer.value.id];
  if (!source || copyingImage.value) return;
  copyingImage.value = true;
  try {
    const api = window.deepwrite?.promptTemplates;
    if (!api) throw new Error("提示词模板服务暂不可用。");
    await api.copyImage({ pngDataUrl: source });
    uiMessage.success("图片已复制，可粘贴到其他应用。");
  } catch (error) {
    uiMessage.error(error instanceof Error ? error.message : "复制图片失败。");
  } finally {
    copyingImage.value = false;
  }
}
async function pasteImages(event?: ClipboardEvent) {
  const files = Array.from(event?.clipboardData?.files ?? []).filter((file) =>
    file.type.startsWith("image/")
  );
  if (event && !files.length) return;
  event?.preventDefault();
  event?.stopPropagation();
  if (props.busy || readingImage.value) return;
  readingImage.value = true;
  try {
    if (files.length) {
      for (const file of files) emit("addImage", await pastedImagePng(file));
    } else {
      const snapshot = await window.deepwrite?.long.readClipboardImage();
      if (!snapshot) throw new Error("剪贴板中没有图片，请先复制图片。");
      emit("addImage", snapshot.pngDataUrl);
    }
  } catch (error) {
    uiMessage.error(
      error instanceof Error ? error.message : "无法粘贴模板图片。"
    );
  } finally {
    readingImage.value = false;
  }
}
const onPaste = (event: ClipboardEvent) => {
  if (viewer.value) return;
  void pasteImages(event);
};
function close() {
  if (!props.busy && !readingImage.value) emit("close");
}
function keydown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    close();
  }
  if (event.key !== "Tab") return;
  const controls = Array.from(
    dialog.value?.querySelectorAll<HTMLElement>(
      "button:not(:disabled), input:not(:disabled), textarea:not(:disabled)"
    ) ?? []
  );
  const first = controls[0];
  const last = controls.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
}
onMounted(() => {
  previousFocus =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  nameInput.value?.focus();
  document.addEventListener("paste", onPaste, true);
});
onBeforeUnmount(() => {
  document.removeEventListener("paste", onPaste, true);
  if (previousFocus?.isConnected) previousFocus.focus();
});
</script>

<template>
  <Teleport to="body">
    <div
      class="dialog-backdrop prompt-template-backdrop"
      @mousedown.self="close"
      @keydown="keydown"
    >
      <section
        ref="dialog"
        class="workspace-dialog prompt-template-dialog"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        :aria-busy="busy"
      >
        <header>
          <h2 :id="titleId">{{ existing ? "编辑模板" : "新增模板" }}</h2>
          <button
            class="template-close"
            type="button"
            aria-label="关闭模板编辑窗口"
            :disabled="busy || readingImage"
            @click="close"
          >
            <AppIcon name="close" :size="18" />
          </button>
        </header>
        <div class="template-fields">
          <label
            ><span>模板名称</span
            ><input
              ref="nameInput"
              :value="draft.name"
              type="text"
              maxlength="200"
              :disabled="busy"
              @input="
                emit('updateName', ($event.target as HTMLInputElement).value)
              "
          /></label>
          <label class="template-content"
            ><span>模板内容</span
            ><textarea
              :value="draft.content"
              maxlength="100000"
              spellcheck="false"
              :disabled="busy"
              @input="
                emit(
                  'updateContent',
                  ($event.target as HTMLTextAreaElement).value
                )
              "
            />
          </label>
          <div class="template-images">
            <div class="template-images-heading">
              <span>模板图片</span>
              <small>{{ draft.imageIds?.length ?? 0 }} / 20 张</small>
            </div>
            <div class="template-images-grid" aria-label="模板图片">
              <article v-for="(id, index) in draft.imageIds ?? []" :key="id">
                <button
                  type="button"
                  class="template-image-open"
                  :aria-label="`查看模板图片 ${index + 1}`"
                  :disabled="!previews[id]"
                  @click="viewer = { id, label: `模板图片 ${index + 1}` }"
                >
                  <img
                    v-if="previews[id]"
                    :src="previews[id]"
                    :alt="`模板图片 ${index + 1}`"
                  />
                  <span v-else>正在读取图片…</span>
                </button>
                <button
                  type="button"
                  class="template-image-remove"
                  :aria-label="`移除模板图片 ${index + 1}`"
                  :disabled="busy || readingImage"
                  @click="emit('removeImage', id)"
                >
                  移除
                </button>
              </article>
            </div>
            <div class="template-paste-actions">
              <button
                type="button"
                class="dialog-secondary-button"
                :disabled="
                  busy || readingImage || (draft.imageIds?.length ?? 0) >= 20
                "
                @click="pasteImages()"
              >
                {{ readingImage ? "正在读取…" : "粘贴图片" }}
              </button>
              <span>可按 Command / Ctrl + V 多次粘贴，支持一次粘贴多张。</span>
            </div>
          </div>
        </div>
        <footer>
          <button
            type="button"
            class="dialog-primary-button is-danger template-delete"
            :disabled="busy || readingImage || !existing"
            @click="emit('delete')"
          >
            删除模板
          </button>
          <button
            type="button"
            class="dialog-primary-button"
            :disabled="busy || readingImage"
            @click="emit('save')"
          >
            {{ busy ? "正在保存…" : "保存模板" }}
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
  <CharacterImageViewer
    v-if="viewer && previews[viewer.id]"
    :src="previews[viewer.id]!"
    :label="viewer.label"
    :copying="copyingImage"
    @close="viewer = null"
    @copy="copyImage"
  />
</template>

<style scoped>
.prompt-template-backdrop {
  z-index: 1500;
}
.prompt-template-dialog {
  width: min(760px, calc(100vw - 32px));
  max-height: calc(100dvh - 48px);
  padding: 24px;
  color: var(--text-primary);
  font-family: var(--ui-font);
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
h2 {
  margin: 0;
  font-size: 1.142857rem;
}
.template-close {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 7px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
}
.template-close:hover {
  background: var(--surface-hover);
}
.template-fields {
  display: grid;
  gap: 18px;
  margin: 20px 0;
  min-height: 0;
  overflow: auto;
}
label {
  display: grid;
  gap: 8px;
}
label span {
  font-size: 0.857143rem;
  color: var(--text-secondary);
}
input,
textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 12px;
  border: 1px solid var(--theme-line);
  border-radius: 9px;
  background: var(--surface-raised);
  color: var(--text-primary);
  font: inherit;
}
textarea {
  height: clamp(140px, 30dvh, 320px);
  resize: vertical;
  line-height: 1.65;
}
input:focus,
textarea:focus {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
footer {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.template-images {
  display: grid;
  gap: 12px;
}
.template-images-heading {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  color: var(--text-secondary);
  font-size: 0.857143rem;
}
.template-images-heading small {
  color: var(--text-tertiary);
}
.template-images-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(116px, 1fr));
  gap: 12px;
}
.template-images-grid article {
  position: relative;
  display: grid;
  place-items: center;
  aspect-ratio: 1;
  overflow: hidden;
  border: 1px solid var(--theme-line);
  border-radius: 9px;
  background: var(--surface-muted);
  color: var(--text-tertiary);
  font-size: 0.75rem;
}
.template-image-open {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--text-tertiary);
  cursor: zoom-in;
}
.template-image-open img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.template-image-remove {
  position: absolute;
  right: 6px;
  bottom: 6px;
  padding: 4px 8px;
  border-radius: 6px;
  background: var(--surface-raised);
  color: var(--text-primary);
  cursor: pointer;
}
.template-paste-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  color: var(--text-tertiary);
  font-size: 0.8rem;
}
footer button {
  min-height: 36px;
}
.template-delete {
  margin-right: auto;
}
button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}
@media (max-width: 480px) {
  .prompt-template-dialog {
    padding: 16px;
  }
  footer {
    gap: 6px;
  }
  footer button {
    flex: 1;
    padding-inline: 8px;
  }
}
</style>
