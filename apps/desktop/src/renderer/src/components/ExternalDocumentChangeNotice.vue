<script setup lang="ts">
defineProps<{
  changed: boolean;
  conflict: boolean;
  busy: boolean;
  error: string | null;
}>();
const emit = defineEmits<{ reload: []; resolve: [] }>();
</script>

<template>
  <div
    v-if="changed || conflict || error"
    class="external-document-notice"
    role="status"
    aria-live="polite"
  >
    <template v-if="changed">
      <span>文件已在其它位置修改。重新加载会合并当前未保存的编辑。</span>
      <button type="button" :disabled="busy" @click="emit('reload')">
        {{ busy ? "正在合并…" : "重新加载" }}
      </button>
    </template>
    <template v-else-if="conflict">
      <span>同一段内容存在冲突。两方文字已保留，请整理冲突标记后确认。</span>
      <button type="button" @click="emit('resolve')">确认已解决</button>
    </template>
    <span v-if="error" class="external-document-error">{{ error }}</span>
  </div>
</template>

<style scoped>
.external-document-notice {
  position: fixed;
  z-index: 2100;
  top: clamp(78px, 9vh, 120px);
  right: 24px;
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: min(560px, calc(100vw - 48px));
  padding: 12px 14px;
  border: 1px solid var(--theme-line);
  border-radius: 12px;
  background: var(--surface-raised);
  color: var(--text-primary);
  box-shadow: 0 12px 36px #0004;
}
.external-document-notice button {
  flex: none;
  padding: 7px 11px;
  border: 1px solid var(--theme-line);
  border-radius: 8px;
  background: var(--surface-muted);
  color: var(--text-primary);
  font: inherit;
  cursor: pointer;
}
.external-document-notice button:disabled {
  opacity: 0.5;
  cursor: default;
}
.external-document-error {
  color: var(--danger, #cf6262);
}
</style>
