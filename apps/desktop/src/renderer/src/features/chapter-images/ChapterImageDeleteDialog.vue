<script setup lang="ts">
import ImageDialog from "../character-assets/CharacterAssetDialog.vue";

defineProps<{ filename: string; busy: boolean }>();
const emit = defineEmits<{ close: []; confirm: [] }>();
</script>

<template>
  <ImageDialog title="删除图片" :busy="busy" @close="emit('close')">
    <p class="chapter-image-delete-description">
      删除
      {{ filename }}
      在正文中的这处引用。若这张图片没有其它引用，也会删除图片文件。
    </p>
    <template #actions>
      <button type="button" :disabled="busy" @click="emit('close')">
        取消
      </button>
      <button
        type="button"
        class="chapter-image-delete-confirm"
        :disabled="busy"
        @click="emit('confirm')"
      >
        {{ busy ? "正在删除…" : "确认删除" }}
      </button>
    </template>
  </ImageDialog>
</template>

<style scoped>
.chapter-image-delete-description {
  margin: 0;
  color: var(--text-secondary);
}
.chapter-image-delete-confirm {
  background: var(--danger, #a53b3b);
  color: white;
}
</style>
