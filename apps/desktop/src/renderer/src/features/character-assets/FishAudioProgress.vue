<script setup lang="ts">
import type { FishAudioProgressNode } from "./useFishAudioProgress";

defineProps<{ nodes: FishAudioProgressNode[] }>();
</script>

<template>
  <section v-if="nodes.length" class="fish-progress" aria-label="执行进度">
    <h3>执行进度</h3>
    <details
      v-for="node in nodes"
      :key="node.id"
      :open="node.status === 'error' || node.status === 'cancelled'"
    >
      <summary>
        <span class="fish-progress-mark" :class="node.status">
          {{
            node.status === "completed"
              ? "✓"
              : node.status === "error"
                ? "!"
                : node.status === "cancelled"
                  ? "×"
                  : "…"
          }}
        </span>
        <span>{{ node.label }}</span>
        <small>{{
          node.status === "running"
            ? "进行中"
            : node.status === "error"
              ? "失败"
              : node.status === "cancelled"
                ? "已取消"
                : "完成"
        }}</small>
      </summary>
      <div class="fish-progress-body">
        <p
          v-if="node.detail"
          :class="{ 'fish-progress-error': node.status === 'error' }"
        >
          {{ node.detail }}
        </p>
        <p v-if="!node.detail">等待返回详细内容…</p>
      </div>
    </details>
  </section>
</template>

<style scoped>
.fish-progress {
  display: grid;
  gap: 8px;
  padding: 14px;
  border: 1px solid var(--theme-line);
  border-radius: 12px;
  background: var(--surface-main);
}
.fish-progress h3 {
  margin: 0 0 2px;
  font-size: 14px;
}
.fish-progress details {
  border-top: 1px solid var(--theme-line-soft);
}
.fish-progress summary {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 9px 2px;
  cursor: pointer;
}
.fish-progress summary small {
  margin-left: auto;
  color: var(--text-secondary);
}
.fish-progress-mark {
  display: inline-grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--surface-selected);
}
.fish-progress-mark.completed {
  color: var(--accent);
}
.fish-progress-mark.error,
.fish-progress-error {
  color: var(--color-danger, #e86b6b);
}
.fish-progress-body {
  display: grid;
  gap: 7px;
  padding: 0 2px 12px 29px;
}
.fish-progress-body p {
  margin: 0;
  overflow-wrap: anywhere;
}
</style>
