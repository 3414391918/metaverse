<script setup lang="ts">
import { computed } from "vue";
import type { LongWorkspaceProposalItem } from "../composables/useLongWorkspaceProposals";
import AppIcon from "./AppIcon.vue";

const props = defineProps<{ item: LongWorkspaceProposalItem }>();

const emit = defineEmits<{
  approve: [];
  reject: [];
}>();

const event = computed(() =>
  props.item.event.type === "long.ledger_commit_proposal"
    ? props.item.event
    : null
);

const batchInfo = computed(() => {
  const input = event.value?.payload.input;
  if (!input) return "";
  const chapterCardIds =
    input.mode === "text_files_batch"
      ? input.chapterCardIds
      : [input.chapterCardId];
  const checkpointChapterCardId =
    input.mode === "text_files_batch"
      ? input.checkpointChapterCardId
      : input.chapterCardId;
  return `本批 ${chapterCardIds.length} 章 · 末章检查点 ${checkpointChapterCardId}`;
});

const statusLabel = computed(() => {
  switch (props.item.status) {
    case "waiting":
      return "等待前序文件";
    case "submitting":
      return "正在归档";
    case "accepted":
      return "已归档";
    case "error":
      return "归档失败";
    case "previewing":
      return "正在校验";
    case "ready":
      return "等待归档";
    default:
      return "等待归档";
  }
});

const statusMessage = computed(() => {
  if (props.item.status === "error") {
    return props.item.error ?? "连续性账本归档失败，当前文件仍保留在本地。";
  }
  if (props.item.status === "waiting") {
    return "末章汇总连续性文件全部保存后，将自动归档整个章节批次。";
  }
  if (props.item.status === "submitting") {
    return "正在校验批次正文、历史账本和末章文件，并保存连续性记录……";
  }
  if (props.item.status === "accepted") {
    return "整批章节已共用一条连续性记录并保存到本地账本。";
  }
  return "等待执行连续性账本归档。";
});
</script>

<template>
  <section class="ledger-finalization-card" :class="`is-${item.status}`">
    <header>
      <span class="ledger-finalization-icon" aria-hidden="true">
        <AppIcon name="wand" :size="16" />
      </span>
      <div>
        <strong>连续性账本归档</strong>
        <small>{{ batchInfo }}</small>
      </div>
      <span class="ledger-finalization-status">{{ statusLabel }}</span>
    </header>

    <p class="ledger-finalization-summary">
      {{ event?.payload.summary }}
    </p>
    <p class="ledger-finalization-message">{{ statusMessage }}</p>

    <footer v-if="item.status === 'error'">
      <button type="button" class="is-secondary" @click="emit('reject')">
        {{ item.errorRetryable === false ? "关闭并保留文件" : "关闭" }}
      </button>
      <button
        v-if="item.errorRetryable !== false"
        type="button"
        class="is-primary"
        @click="emit('approve')"
      >
        重试归档
      </button>
    </footer>
  </section>
</template>

<style scoped>
.ledger-finalization-card {
  display: grid;
  gap: 10px;
  padding: 13px 14px;
  border: 1px solid var(--theme-line-soft);
  border-radius: 12px;
  background: var(--surface-raised);
  color: var(--text-primary);
}

.ledger-finalization-card.is-error {
  border-color: color-mix(in srgb, var(--accent) 34%, var(--theme-line));
}

header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
}

header > div {
  display: grid;
  gap: 2px;
}

header small,
.ledger-finalization-summary,
.ledger-finalization-message {
  color: var(--text-secondary);
}

.ledger-finalization-icon {
  display: inline-grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border-radius: 9px;
  background: var(--accent-soft);
  color: var(--accent);
}

.ledger-finalization-status {
  font-size: 12px;
  color: var(--text-secondary);
}

.is-error .ledger-finalization-status,
.is-error .ledger-finalization-message {
  color: var(--text-primary);
}

p {
  margin: 0;
  line-height: 1.55;
}

.ledger-finalization-message {
  padding: 9px 10px;
  border-radius: 8px;
  background: var(--surface-muted);
  font-size: 12px;
}

footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

button {
  min-height: 32px;
  padding: 0 13px;
  border: 1px solid var(--theme-line);
  border-radius: 8px;
  cursor: pointer;
}

button.is-secondary {
  background: var(--surface-raised);
  color: var(--text-primary);
}

button.is-primary {
  border-color: var(--text-primary);
  background: var(--text-primary);
  color: var(--surface-main);
}
</style>
