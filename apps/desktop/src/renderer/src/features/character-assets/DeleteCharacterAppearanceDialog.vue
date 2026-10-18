<script setup lang="ts">
import CharacterAssetDialog from "./CharacterAssetDialog.vue";
defineProps<{
  name: string;
  count: number;
  busy: boolean;
  disabled?: boolean;
}>();
const emit = defineEmits<{ close: []; confirm: [] }>();
</script>
<template>
  <CharacterAssetDialog title="删除形象" :busy="busy" @close="emit('close')">
    <p>确认删除「{{ name }}」？</p>
    <p>
      将永久删除此形象的文本描述和
      {{ count }} 张角色资产图，并清理空的资产目录。
    </p>
    <p>不进入回收站，无法撤销。</p>
    <template #actions>
      <button type="button" :disabled="busy" @click="emit('close')">
        取消
      </button>
      <button
        type="button"
        class="character-danger"
        :disabled="busy || disabled"
        @click="emit('confirm')"
      >
        {{ busy ? "正在删除…" : "确认永久删除" }}
      </button>
    </template>
  </CharacterAssetDialog>
</template>
