<script setup lang="ts">
import ImageDialog from "../character-assets/CharacterAssetDialog.vue";
defineProps<{ filename: string; busy: boolean }>();
const emit = defineEmits<{ close: []; confirm: [] }>();
</script>

<template>
  <ImageDialog title="删除视频" :busy="busy" @close="emit('close')">
    <p>
      删除 {{ filename }} 在正文中的这处引用。没有其它引用时，也会删除视频文件。
    </p>
    <template #actions>
      <button type="button" :disabled="busy" @click="emit('close')">
        取消
      </button>
      <button
        type="button"
        class="danger"
        :disabled="busy"
        @click="emit('confirm')"
      >
        {{ busy ? "正在删除…" : "确认删除" }}
      </button>
    </template>
  </ImageDialog>
</template>

<style scoped>
p {
  margin: 0;
  color: var(--text-secondary);
}
.danger {
  background: var(--danger, #a53b3b);
  color: white;
}
</style>
