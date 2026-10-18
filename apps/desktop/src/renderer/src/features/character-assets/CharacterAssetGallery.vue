<script setup lang="ts">
import { characterApi } from "./character-api";
import { computed, ref, watch } from "vue";
import type {
  LongCharacterAsset,
  LongCharacterProfileSnapshot
} from "@deepwrite/contracts";
import { uiMessage } from "../../ui-feedback";
import CharacterAssetDialog from "./CharacterAssetDialog.vue";
import CharacterImageViewer from "./CharacterImageViewer.vue";
import { assetClipboardPng, characterAssetUrl } from "./asset-image";
const props = defineProps<{
  bookId: string;
  characterId: string;
  appearanceId: string;
  assets: LongCharacterAsset[];
  disabled: boolean;
}>();
const emit = defineEmits<{
  updated: [snapshot: LongCharacterProfileSnapshot];
}>();
const images = computed(() =>
  props.assets.filter((item) => item.appearanceId === props.appearanceId)
);
const pending = ref(false),
  copying = ref(false),
  copyingPath = ref(false);
const viewer = ref<LongCharacterAsset | null>(null);
const menu = ref<{ asset: LongCharacterAsset; x: number; y: number } | null>(
  null
);
const renameTarget = ref<LongCharacterAsset | null>(null),
  deleteTarget = ref<LongCharacterAsset | null>(null);
const labelDraft = ref("");
const failedImages = ref(new Set<string>());
let loadErrorShown = false;
function imageFailed(asset: LongCharacterAsset) {
  failedImages.value.add(asset.id);
  if (!loadErrorShown) {
    loadErrorShown = true;
    uiMessage.error("部分角色资产图无法读取，请重新上传对应图片。");
  }
}
const url = (asset: LongCharacterAsset) =>
  characterAssetUrl(props.bookId, props.characterId, asset);
function openMenu(asset: LongCharacterAsset, event: MouseEvent) {
  if (props.disabled || pending.value) return;
  menu.value = {
    asset,
    x: Math.min(event.clientX, window.innerWidth - 170),
    y: Math.min(event.clientY, window.innerHeight - 100)
  };
}
function rename() {
  if (menu.value) {
    renameTarget.value = menu.value.asset;
    labelDraft.value = menu.value.asset.label;
  }
  menu.value = null;
}
function remove() {
  deleteTarget.value = menu.value?.asset ?? null;
  menu.value = null;
}
async function upload() {
  if (props.disabled || pending.value) return;
  pending.value = true;
  try {
    const next = await characterApi().importCharacterAssets({
      bookId: props.bookId,
      characterId: props.characterId,
      appearanceId: props.appearanceId
    });
    if (next) {
      emit("updated", next);
      uiMessage.success("角色资产图已上传");
    }
  } catch (e) {
    uiMessage.error(e instanceof Error ? e.message : "上传失败");
  } finally {
    pending.value = false;
  }
}
async function copyAbsolutePath() {
  if (props.disabled || pending.value || copyingPath.value) return;
  const target = {
    bookId: props.bookId,
    characterId: props.characterId
  };
  const appearanceId = props.appearanceId;
  copyingPath.value = true;
  try {
    const storage = await characterApi().prepareCharacterAppearanceDirectory({
      ...target,
      appearanceId
    });
    if (
      target.bookId !== props.bookId ||
      target.characterId !== props.characterId ||
      appearanceId !== props.appearanceId
    )
      return;
    emit("updated", storage.snapshot);
    await navigator.clipboard.writeText(storage.assetsDirectory);
    uiMessage.success("当前形象资产目录的绝对路径已复制");
  } catch (error) {
    uiMessage.error(
      error instanceof Error ? error.message : "复制绝对路径失败"
    );
  } finally {
    copyingPath.value = false;
  }
}
async function saveLabel() {
  const target = renameTarget.value;
  if (!target || pending.value) return;
  if (!labelDraft.value.trim()) {
    uiMessage.warning("图片标签不能为空");
    return;
  }
  pending.value = true;
  try {
    const next = await characterApi().renameCharacterAsset({
      bookId: props.bookId,
      characterId: props.characterId,
      assetId: target.id,
      label: labelDraft.value.trim()
    });
    emit("updated", next);
    if (viewer.value?.id === target.id)
      viewer.value = { ...target, label: labelDraft.value.trim() };
    renameTarget.value = null;
    uiMessage.success("图片标签已保存");
  } catch (e) {
    uiMessage.error(e instanceof Error ? e.message : "重命名失败");
  } finally {
    pending.value = false;
  }
}
async function confirmDelete() {
  const target = deleteTarget.value;
  if (!target || pending.value) return;
  pending.value = true;
  try {
    emit(
      "updated",
      await characterApi().deleteCharacterAsset({
        bookId: props.bookId,
        characterId: props.characterId,
        assetId: target.id
      })
    );
    if (viewer.value?.id === target.id) viewer.value = null;
    deleteTarget.value = null;
    uiMessage.success("图片已删除");
  } catch (e) {
    uiMessage.error(e instanceof Error ? e.message : "删除失败");
  } finally {
    pending.value = false;
  }
}
async function copyImage() {
  const asset = viewer.value;
  if (!asset || copying.value) return;
  copying.value = true;
  try {
    const pngDataUrl = await assetClipboardPng(url(asset));
    await characterApi().copyCharacterAsset({
      bookId: props.bookId,
      characterId: props.characterId,
      assetId: asset.id,
      pngDataUrl
    });
    uiMessage.success("图片已复制，可粘贴到其他应用");
  } catch (e) {
    uiMessage.error(e instanceof Error ? e.message : "复制图片失败");
  } finally {
    copying.value = false;
  }
}
watch(
  () => [props.bookId, props.characterId, props.appearanceId],
  () => {
    viewer.value = null;
    failedImages.value.clear();
    loadErrorShown = false;
    menu.value = null;
    renameTarget.value = null;
    deleteTarget.value = null;
  }
);
defineExpose({
  isBusy: computed(() => pending.value || copying.value || copyingPath.value)
});
</script>
<template>
  <section class="asset-gallery">
    <header>
      <div>
        <strong>形象图片描述</strong
        ><span>{{ images.length }} 张角色资产图</span>
      </div>
      <div class="asset-gallery-actions">
        <button
          type="button"
          class="character-save"
          :disabled="disabled || pending || copyingPath"
          @click="upload"
        >
          {{ pending ? "处理中…" : "上传图片" }}
        </button>
        <button
          type="button"
          :disabled="disabled || pending || copyingPath"
          title="复制当前形象资产图片目录的绝对路径"
          @click="copyAbsolutePath"
        >
          {{ copyingPath ? "正在复制…" : "复制绝对路径" }}
        </button>
      </div>
    </header>
    <div class="asset-grid" aria-label="角色资产图，右键可设置图片标签或删除">
      <button
        v-for="asset in images"
        :key="asset.id"
        type="button"
        class="asset-tile"
        :aria-label="`查看图片：${asset.label}`"
        @click="viewer = asset"
        @contextmenu.prevent.stop="openMenu(asset, $event)"
      >
        <div class="asset-thumbnail">
          <span v-if="failedImages.has(asset.id)" class="asset-image-error"
            >图片无法读取</span
          >
          <img
            v-else
            :src="url(asset)"
            :alt="asset.label"
            loading="lazy"
            decoding="async"
            draggable="false"
            @error="imageFailed(asset)"
          />
        </div>
        <span :title="asset.label">{{ asset.label }}</span>
      </button>
      <div v-if="!images.length" class="asset-empty">
        上传这一形象的角色资产图，支持一次选择多张。
      </div>
    </div>
    <Teleport to="body">
      <div
        v-if="menu"
        class="asset-menu-dismiss"
        @mousedown.self="menu = null"
        @wheel="menu = null"
        @contextmenu.prevent="menu = null"
        @keydown.esc="menu = null"
      >
        <div
          class="asset-context-menu"
          role="menu"
          :style="{ left: `${menu.x}px`, top: `${menu.y}px` }"
        >
          <button type="button" role="menuitem" @click="rename">重命名</button
          ><button
            type="button"
            role="menuitem"
            class="is-danger"
            @click="remove"
          >
            删除
          </button>
        </div>
      </div>
    </Teleport>
    <CharacterAssetDialog
      v-if="renameTarget"
      title="设置图片标签"
      :busy="pending"
      @close="renameTarget = null"
    >
      <label class="asset-label-input"
        >图片标签<input
          v-model="labelDraft"
          aria-label="图片标签"
          maxlength="256"
          :disabled="pending"
          @keydown.enter="saveLabel"
      /></label>
      <template #actions
        ><button type="button" :disabled="pending" @click="renameTarget = null">
          取消</button
        ><button
          type="button"
          class="character-save"
          :disabled="pending"
          @click="saveLabel"
        >
          保存
        </button></template
      >
    </CharacterAssetDialog>
    <CharacterAssetDialog
      v-if="deleteTarget"
      title="删除角色资产图"
      :busy="pending"
      @close="deleteTarget = null"
    >
      <p>
        确定删除“{{
          deleteTarget.label
        }}”吗？图片会从当前形象中移除，并删除作品目录中的这张图片。
      </p>
      <template #actions
        ><button type="button" :disabled="pending" @click="deleteTarget = null">
          取消</button
        ><button
          type="button"
          class="character-danger"
          :disabled="pending"
          @click="confirmDelete"
        >
          确认删除
        </button></template
      >
    </CharacterAssetDialog>
    <CharacterImageViewer
      v-if="viewer"
      :src="url(viewer)"
      :label="viewer.label"
      :copying="copying"
      @close="viewer = null"
      @copy="copyImage"
    />
  </section>
</template>
<style scoped src="./character-gallery.css"></style>
