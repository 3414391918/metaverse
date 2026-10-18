<script setup lang="ts">
import { computed } from "vue";
import type {
  LongWorkspaceEntityChange,
  LongWorkspaceIndexSnapshot,
  LongWorkspaceLedgerRecordEdit,
  LongWorkspaceRelationshipChange
} from "@deepwrite/contracts";
import type { LongWorkspaceProposalItem } from "../composables/useLongWorkspaceProposals";
import { longCharacterFiles } from "../utils/longCharacterFiles";
import { longWorldbuildingFiles } from "../utils/longWorldbuildingFiles";

const props = defineProps<{
  item: LongWorkspaceProposalItem;
  workspaceIndex?: LongWorkspaceIndexSnapshot | null | undefined;
}>();

const preview = computed(() => props.item.preview);
const operationCount = computed(() =>
  props.item.event.type === "long.mutation_proposal"
    ? props.item.event.payload.batch.operations.length
    : 0
);
const workspaceFilePaths = computed(() => {
  const index = props.workspaceIndex;
  const entries: Array<readonly [string, string]> = [];
  if (!index) return new Map(entries);
  entries.push([index.bookLine.id, index.bookLine.path]);
  for (const file of longWorldbuildingFiles(index.worldbuilding)) {
    entries.push([file.id, file.path]);
  }
  for (const file of longCharacterFiles(index)) {
    entries.push([file.id, file.path]);
  }
  for (const chapter of index.chapters) {
    entries.push(
      [chapter.body.id, chapter.body.path],
      [chapter.card.id, chapter.card.path],
      [chapter.characterState.id, chapter.characterState.path],
      [chapter.handoff.id, chapter.handoff.path],
      [chapter.foreshadowingChanges.id, chapter.foreshadowingChanges.path]
    );
    if (chapter.worldReveals) {
      entries.push([chapter.worldReveals.id, chapter.worldReveals.path]);
    }
    for (const continuity of chapter.characterContinuity) {
      entries.push(
        [continuity.currentState.id, continuity.currentState.path],
        [continuity.history.id, continuity.history.path]
      );
    }
  }
  for (const commit of index.ledger.commits) {
    entries.push([commit.recordFile.id, commit.recordFile.path]);
  }
  return new Map(entries);
});

function structureImpactTotal(): number {
  const impact = preview.value?.impact;
  return impact
    ? impact.createdEntityIds.length +
        impact.updatedEntityIds.length +
        impact.deletedEntityIds.length
    : 0;
}

function proposalFilePath(fileId: string): string {
  const previewed = preview.value?.fileIntents.find(
    ({ file }) => file.id === fileId
  );
  return previewed?.file.path ?? workspaceFilePaths.value.get(fileId) ?? fileId;
}

const entityKindLabels: Record<string, string> = {
  "worldbuilding-category": "世界观分类",
  "worldbuilding-item": "世界观条目",
  "character-type": "人物类型",
  character: "人物",
  volume: "卷",
  arc: "剧情弧",
  "chapter-card": "章卡",
  "story-event": "故事事件",
  "story-plot": "故事情节",
  "event-connection": "事件连接",
  "narrative-placement": "叙事落点",
  "foreshadowing-thread": "伏笔线",
  "foreshadowing-beat": "伏笔节拍"
};

function entityActionLabel(action: LongWorkspaceEntityChange["action"]) {
  if (action === "create") return "新建实体";
  if (action === "delete") return "删除实体";
  return "更新实体";
}

function snapshotText(value: unknown): string {
  return value === null ? "（不存在）" : JSON.stringify(value, null, 2);
}

const relationshipKindLabels: Record<string, string> = {
  "worldbuilding-category-item": "世界观分类与条目",
  "character-type-member": "人物类型归属",
  "arc-volume": "剧情点与分卷",
  "chapter-volume": "章卡与分卷",
  "chapter-primary-arc": "章卡与主剧情点",
  "story-plot-arc": "故事情节与剧情点",
  "story-event-arc": "故事事件与剧情点",
  "story-event-character": "故事事件与人物",
  "event-connection-source": "事件连接的起点",
  "event-connection-target": "事件连接的终点",
  "narrative-placement-event": "叙事落点与事件",
  "narrative-placement-chapter": "叙事落点与章卡",
  "narrative-placement-commit": "叙事落点与连续性记录",
  "foreshadowing-truth-event": "伏笔线与真相事件",
  "foreshadowing-thread-beat": "伏笔线与触点",
  "foreshadowing-beat-volume": "伏笔触点与分卷",
  "foreshadowing-beat-arc": "伏笔触点与剧情点",
  "foreshadowing-beat-event": "伏笔触点与事件",
  "foreshadowing-beat-placement": "伏笔触点与叙事落点",
  "foreshadowing-beat-chapter": "伏笔触点与章卡",
  "foreshadowing-beat-commit": "伏笔触点与连续性记录",
  "character-files": "人物与文件",
  "chapter-files": "章节与文件",
  "ledger-commit": "连续性提交",
  "ledger-state": "连续性账本状态",
  "continuity-projection": "连续性投影"
};

function relationshipActionLabel(
  action: LongWorkspaceRelationshipChange["action"]
) {
  if (action === "create") return "建立关联";
  if (action === "delete") return "解除关联";
  return "更新关联";
}

function ledgerRecordEditCount(edit: LongWorkspaceLedgerRecordEdit): number {
  return (
    edit.removePlacementIds.length +
    edit.removeForeshadowingBeatIds.length +
    edit.reconcileForeshadowingThreadIds.length +
    edit.removeSubjectIds.length +
    edit.removeKnowledgeAudienceIds.length +
    edit.removeFactIds.length +
    edit.removeFactKeys.length +
    edit.removeKnowledgeKeys.length +
    edit.removeOpenLoopIds.length +
    (edit.replaceHandoff ? 1 : 0)
  );
}
</script>

<template>
  <template v-if="preview">
    <div class="proposal-impact">
      <span>
        <strong>{{ operationCount }}</strong>
        结构操作
      </span>
      <span
        ><strong>{{ structureImpactTotal() }}</strong> 实体受影响</span
      >
      <span
        ><strong>{{ preview.fileIntents.length }}</strong> 文件增删</span
      >
      <span>
        <strong>{{ preview.relationshipChanges.length }}</strong> 关联变更
      </span>
      <span>
        <strong>{{ preview.ledgerRecordEdits.length }}</strong> 账本记录
      </span>
      <span
        ><strong>{{ preview.documentWrites.length }}</strong> 文档写入</span
      >
    </div>
    <details
      class="proposal-details"
      :open="
        preview.impact.deletedEntityIds.length > 0 ||
        preview.impact.deletedFileIds.length > 0 ||
        preview.relationshipChanges.length > 0 ||
        preview.ledgerRecordEdits.length > 0
      "
    >
      <summary>查看具体影响</summary>
      <div v-if="preview.entityChanges.length" class="detail-group entity-list">
        <strong>实体完整前后快照（{{ preview.entityChanges.length }}）</strong>
        <details
          v-for="change in preview.entityChanges"
          :key="`${change.action}:${change.kind}:${change.id}`"
          class="entity-change"
          :class="{ 'is-danger': change.action === 'delete' }"
        >
          <summary>
            {{ entityActionLabel(change.action) }} ·
            {{ entityKindLabels[change.kind] }} · {{ change.id }}
          </summary>
          <div class="entity-diff">
            <section>
              <strong>变更前</strong>
              <pre>{{ snapshotText(change.before) }}</pre>
            </section>
            <section>
              <strong>变更后</strong>
              <pre>{{ snapshotText(change.after) }}</pre>
            </section>
          </div>
        </details>
      </div>
      <div
        v-if="preview.relationshipChanges.length"
        class="detail-group entity-list"
      >
        <strong
          >关联关系变化（{{ preview.relationshipChanges.length }}）</strong
        >
        <details
          v-for="change in preview.relationshipChanges"
          :key="`${change.action}:${change.kind}:${change.id}`"
          class="entity-change"
          :class="{ 'is-danger': change.action === 'delete' }"
        >
          <summary>
            {{ relationshipActionLabel(change.action) }} ·
            {{ relationshipKindLabels[change.kind] }} · {{ change.id }}
          </summary>
          <div class="entity-diff">
            <section>
              <strong>变更前</strong>
              <pre>{{ snapshotText(change.before) }}</pre>
            </section>
            <section>
              <strong>变更后</strong>
              <pre>{{ snapshotText(change.after) }}</pre>
            </section>
          </div>
        </details>
      </div>
      <div
        v-if="preview.ledgerRecordEdits.length"
        class="detail-group ledger-list"
      >
        <strong>
          连续性账本记录影响（{{ preview.ledgerRecordEdits.length }}）
        </strong>
        <details
          v-for="edit in preview.ledgerRecordEdits"
          :key="edit.commitId"
          class="entity-change is-danger"
        >
          <summary>
            更新记录 {{ edit.commitId }} · {{ edit.recordFile.id }} ·
            {{ ledgerRecordEditCount(edit) }} 项
          </summary>
          <div class="ledger-edit">
            <code>{{ edit.recordFile.path }}</code>
            <span v-if="edit.removePlacementIds.length"
              >解除叙事落点：{{ edit.removePlacementIds.join("、") }}</span
            >
            <span v-if="edit.removeForeshadowingBeatIds.length"
              >解除伏笔触点：{{
                edit.removeForeshadowingBeatIds.join("、")
              }}</span
            >
            <span v-if="edit.reconcileForeshadowingThreadIds.length"
              >重算伏笔线：{{
                edit.reconcileForeshadowingThreadIds.join("、")
              }}</span
            >
            <span v-if="edit.removeSubjectIds.length"
              >清理主体引用：{{ edit.removeSubjectIds.join("、") }}</span
            >
            <span v-if="edit.removeKnowledgeAudienceIds.length"
              >清理认知受众：{{
                edit.removeKnowledgeAudienceIds.join("、")
              }}</span
            >
            <span v-if="edit.removeFactIds.length"
              >清理事实：{{ edit.removeFactIds.join("、") }}</span
            >
            <span v-if="edit.removeOpenLoopIds.length"
              >清理未闭环项：{{ edit.removeOpenLoopIds.join("、") }}</span
            >
            <span v-if="edit.removeFactKeys.length"
              >清理事实键 {{ edit.removeFactKeys.length }} 项</span
            >
            <span v-if="edit.removeKnowledgeKeys.length"
              >清理认知键 {{ edit.removeKnowledgeKeys.length }} 项</span
            >
            <span v-if="edit.replaceHandoff">更新接续包</span>
          </div>
        </details>
      </div>
      <div
        v-if="preview.impact.deletedFileIds.length"
        class="detail-group is-danger"
      >
        <strong
          >删除文件引用（{{ preview.impact.deletedFileIds.length }}）</strong
        >
        <code v-for="id in preview.impact.deletedFileIds" :key="id">{{
          id
        }}</code>
      </div>
      <div v-if="preview.fileIntents.length" class="detail-group">
        <strong>文件操作</strong>
        <span
          v-for="intent in preview.fileIntents"
          :key="`${intent.action}:${intent.file.id}`"
          :class="{ 'is-danger': intent.action === 'delete' }"
        >
          {{ intent.action === "delete" ? "删除引用" : "新建" }} ·
          {{ intent.file.path }} · {{ intent.reason }}
        </span>
      </div>
      <div v-if="preview.documentWrites.length" class="detail-group write-list">
        <strong>文档写入内容</strong>
        <details
          v-for="write in preview.documentWrites"
          :key="write.proposalId"
          class="proposal-content"
        >
          <summary>
            {{ proposalFilePath(write.fileId) }} · {{ write.mode }}
          </summary>
          <span>{{ write.reason }}</span>
          <textarea
            readonly
            spellcheck="false"
            :aria-label="`${proposalFilePath(write.fileId)}拟写内容`"
            :value="write.content"
          />
        </details>
      </div>
    </details>
  </template>
</template>

<style scoped>
.proposal-impact {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}
.proposal-impact span {
  display: inline-flex;
  align-items: baseline;
  gap: 3px;
  padding: 4px 6px;
  border-radius: 7px;
  background: var(--surface-main);
  color: var(--text-tertiary);
  font-size: 0.607143rem;
}
.proposal-impact strong {
  color: var(--text-primary);
  font-size: 0.678571rem;
}
.proposal-details {
  padding: 6px 8px;
  border: 1px solid var(--theme-line-soft);
  border-radius: 8px;
  background: var(--surface-main);
  font-size: 0.642857rem;
}
.proposal-details summary {
  color: var(--text-secondary);
  cursor: pointer;
}
.proposal-details[open] > summary {
  margin-bottom: 7px;
}
.detail-group {
  display: grid;
  gap: 4px;
  max-height: 150px;
  padding: 6px;
  overflow: auto;
  border-radius: 7px;
  background: var(--surface-muted);
  color: var(--text-secondary);
}
.detail-group + .detail-group {
  margin-top: 5px;
}
.detail-group strong {
  color: var(--text-primary);
}
.detail-group code,
.detail-group span {
  overflow-wrap: anywhere;
  color: var(--text-tertiary);
  font-family: var(--code-font);
  font-size: var(--code-font-size);
}
.write-list {
  max-height: none;
}
.entity-list,
.ledger-list {
  max-height: 360px;
}
.entity-change,
.proposal-content {
  padding: 5px 6px;
  border: 1px solid var(--theme-line-soft);
  border-radius: 6px;
  background: var(--surface-main);
}
.entity-change > summary,
.proposal-content > summary {
  overflow-wrap: anywhere;
  color: var(--text-secondary);
  cursor: pointer;
  font-family: var(--code-font);
  font-size: var(--code-font-size);
}
.entity-change.is-danger > summary,
.detail-group.is-danger strong,
.detail-group .is-danger {
  color: var(--danger);
}
.entity-diff {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}
.entity-diff section {
  min-width: 0;
}
.entity-diff pre {
  max-height: 240px;
  margin: 4px 0 0;
  padding: 6px;
  overflow: auto;
  border: 1px solid var(--theme-line-soft);
  border-radius: 6px;
  background: var(--surface-raised);
  color: var(--text-primary);
  font-family: var(--code-font);
  font-size: var(--code-font-size);
  line-height: 1.45;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.ledger-edit {
  display: grid;
  gap: 4px;
}
.proposal-content[open] summary {
  margin-bottom: 5px;
}
.proposal-content textarea {
  display: block;
  width: 100%;
  min-height: 132px;
  max-height: 320px;
  resize: vertical;
  padding: 7px;
  overflow: auto;
  border: 1px solid var(--theme-line-soft);
  border-radius: 6px;
  background: var(--surface-raised);
  color: var(--text-primary);
  font-family: var(--code-font);
  font-size: var(--code-font-size);
  line-height: 1.55;
}
@media (max-width: 42rem) {
  .entity-diff {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
