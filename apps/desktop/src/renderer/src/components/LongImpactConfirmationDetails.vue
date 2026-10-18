<script setup lang="ts">
import { computed } from "vue";
import type { LongWorkspaceImpactConfirmation } from "@deepwrite/contracts";
import { longImpactConfirmationLines } from "../utils/longImpactConfirmation";

const props = withDefaults(
  defineProps<{
    confirmation: LongWorkspaceImpactConfirmation;
    fallback?: string;
    open?: boolean;
  }>(),
  {
    fallback: "本次操作没有额外关联影响。",
    open: true
  }
);

const lines = computed(() => longImpactConfirmationLines(props.confirmation));
const summary = computed(() => {
  const entityCount = props.confirmation.entityChanges.length;
  const relationshipCount = props.confirmation.relationshipChanges.length;
  const fileCount = props.confirmation.fileIntents.length;
  const ledgerCount = props.confirmation.ledgerRecordEdits.length;
  return [
    entityCount ? `${entityCount} 项实体变化` : "",
    relationshipCount ? `${relationshipCount} 项关联变化` : "",
    fileCount ? `${fileCount} 项文件变化` : "",
    ledgerCount ? `${ledgerCount} 份连续性记录调整` : ""
  ]
    .filter(Boolean)
    .join("、");
});
</script>

<template>
  <section class="long-impact-confirmation" aria-label="精确影响">
    <p>{{ summary || fallback }}</p>
    <details v-if="lines.length" :open="open">
      <summary>查看精确影响（{{ lines.length }} 项）</summary>
      <ul>
        <li v-for="(line, index) in lines" :key="`${index}:${line}`">
          {{ line }}
        </li>
      </ul>
    </details>
  </section>
</template>

<style scoped>
.long-impact-confirmation {
  display: grid;
  gap: 0.5rem;
  min-width: 0;
  padding: 0.75rem;
  border: 1px solid var(--theme-line);
  border-radius: 0.65rem;
  background: var(--surface-muted);
  color: var(--text-secondary);
  line-height: 1.5;
}

.long-impact-confirmation p {
  margin: 0;
  color: var(--text-primary);
  font-weight: 600;
}

.long-impact-confirmation summary {
  color: var(--text-secondary);
  cursor: pointer;
}

.long-impact-confirmation ul {
  display: grid;
  gap: 0.35rem;
  max-height: 12rem;
  margin: 0.5rem 0 0;
  padding: 0 0 0 1.25rem;
  overflow: auto;
  color: var(--text-tertiary);
  overflow-wrap: anywhere;
}
</style>
