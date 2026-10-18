<script setup lang="ts">
import { NOVEL_PROPOSAL_ACCESSIBLE_NAME } from "./novelWorkspacePresentation";
import { computed } from "vue";
import type {
  LongContinuityFileChange,
  LongContinuityFileRole,
  LongWorkspaceIndexSnapshot
} from "@deepwrite/contracts";
import type { LongWorkspaceProposalItem } from "../composables/useLongWorkspaceProposals";
import { buildAgentTextDiff } from "../utils/agentTextDiff";
import AppIcon from "./AppIcon.vue";
import LongLedgerFinalizationCard from "./LongLedgerFinalizationCard.vue";
import LongProposalImpactDetails from "./LongProposalImpactDetails.vue";

const props = withDefaults(
  defineProps<{
    items: LongWorkspaceProposalItem[];
    workspaceIndex?: LongWorkspaceIndexSnapshot | null;
    embedded?: boolean;
    conversationCard?: boolean;
  }>(),
  {
    embedded: false,
    conversationCard: false
  }
);

const emit = defineEmits<{
  approve: [eventId: string];
  reject: [eventId: string];
  retryPreview: [eventId: string];
  locate: [eventId: string];
}>();

const pendingCount = computed(
  () => props.items.filter(({ status }) => status !== "accepted").length
);
const completedCount = computed(
  () => props.items.filter(({ status }) => status === "accepted").length
);

type LongContentFileChange = Extract<
  LongWorkspaceProposalItem["event"],
  {
    type:
      | "long.worldbuilding_file_proposal"
      | "long.character_file_proposal"
      | "long.continuity_file_proposal";
  }
>["payload"]["files"][number];

function isContentFileProposalItem(item: LongWorkspaceProposalItem): boolean {
  return (
    item.event.type === "long.worldbuilding_file_proposal" ||
    item.event.type === "long.character_file_proposal" ||
    item.event.type === "long.continuity_file_proposal"
  );
}

const hasEditProposalSurfaceItems = computed(() =>
  props.items.some(
    (item) =>
      item.event.type === "long.mutation_proposal" ||
      isContentFileProposalItem(item)
  )
);

const contentFileCards = computed(() => {
  const cards = new Map<
    string,
    Array<{
      file: LongContentFileChange;
      diff: ReturnType<typeof buildAgentTextDiff>;
    }>
  >();
  for (const item of props.items) {
    if (
      item.event.type !== "long.worldbuilding_file_proposal" &&
      item.event.type !== "long.character_file_proposal" &&
      item.event.type !== "long.continuity_file_proposal"
    )
      continue;
    cards.set(
      item.event.id,
      item.event.payload.files.map((file) => ({
        file,
        diff: buildAgentTextDiff(file.beforeText, file.afterText)
      }))
    );
  }
  return cards;
});

const continuityRoleLabels: Record<LongContinuityFileRole, string> = {
  foreshadowing_changes: "伏笔变化",
  world_reveals: "世界观揭露",
  character_current_state: "人物当前状态",
  character_history: "人物历史轨迹",
  chapter_end_state: "章末状态",
  handoff: "接续包"
};

function trustedContinuityIdentity(fileId: string): {
  chapterCardId: string;
  role: LongContinuityFileRole;
  characterId: string | null;
} | null {
  const index = props.workspaceIndex;
  if (!index) return null;
  for (const chapter of index.chapters) {
    if (chapter.characterState.id === fileId) {
      return {
        chapterCardId: chapter.chapterCardId,
        role: "chapter_end_state",
        characterId: null
      };
    }
    if (chapter.handoff.id === fileId) {
      return {
        chapterCardId: chapter.chapterCardId,
        role: "handoff",
        characterId: null
      };
    }
    if (chapter.foreshadowingChanges.id === fileId) {
      return {
        chapterCardId: chapter.chapterCardId,
        role: "foreshadowing_changes",
        characterId: null
      };
    }
    if (chapter.worldReveals?.id === fileId) {
      return {
        chapterCardId: chapter.chapterCardId,
        role: "world_reveals",
        characterId: null
      };
    }
    for (const continuity of chapter.characterContinuity) {
      if (continuity.currentState.id === fileId) {
        return {
          chapterCardId: chapter.chapterCardId,
          role: "character_current_state",
          characterId: continuity.characterId
        };
      }
      if (continuity.history.id === fileId) {
        return {
          chapterCardId: chapter.chapterCardId,
          role: "character_history",
          characterId: continuity.characterId
        };
      }
    }
  }
  return null;
}

function continuityFileTitle(
  item: LongWorkspaceProposalItem,
  file: LongContinuityFileChange
): string {
  const index = props.workspaceIndex;
  const identity = trustedContinuityIdentity(file.fileId);
  const trusted =
    identity ??
    (item.preview
      ? {
          chapterCardId: file.chapterCardId,
          role: file.role,
          characterId: file.characterId
        }
      : null);
  if (!index || !trusted) return "连续性文件（待校验）";
  const chapter = index.plot.chapterCards.find(
    ({ id }) => id === trusted.chapterCardId
  );
  const character =
    trusted.characterId === null
      ? null
      : index.characters.find(({ id }) => id === trusted.characterId);
  if (!chapter || (trusted.characterId !== null && !character)) {
    return "连续性文件（待校验）";
  }
  return `${chapter.title} / ${
    character ? `${character.name} / ` : ""
  }${continuityRoleLabels[trusted.role]}`;
}

function contentFileTitle(
  item: LongWorkspaceProposalItem,
  file: LongContentFileChange
): string {
  return item.event.type === "long.continuity_file_proposal"
    ? continuityFileTitle(item, file as LongContinuityFileChange)
    : file.title;
}

function canDisplayContentFileDiff(item: LongWorkspaceProposalItem): boolean {
  return (
    item.event.type !== "long.continuity_file_proposal" ||
    (Boolean(item.preview) &&
      (item.status === "ready" ||
        item.status === "submitting" ||
        item.status === "accepted"))
  );
}

function proposalTitle(item: LongWorkspaceProposalItem): string {
  switch (item.event.type) {
    case "long.mutation_proposal":
      return "结构变更";
    case "long.worldbuilding_file_proposal":
      return item.event.payload.files.length === 1
        ? item.event.payload.files[0]!.title
        : `${item.event.payload.files.length} 个世界观文件`;
    case "long.character_file_proposal":
      return item.event.payload.files.length === 1
        ? item.event.payload.files[0]!.title
        : `${item.event.payload.files[0]?.characterName ?? "人物"}的 ${item.event.payload.files.length} 个文件`;
    case "long.continuity_file_proposal":
      return item.event.payload.files.length === 1
        ? contentFileTitle(item, item.event.payload.files[0]!)
        : `${item.event.payload.files.length} 个连续性文件`;
    case "long.ledger_commit_proposal":
      return "连续性账本归档";
  }
}

function proposalAction(item: LongWorkspaceProposalItem): string {
  if (item.status === "submitting") return "处理中…";
  if (item.approvalMode === "auto-approve" && item.status === "error") {
    return "重试自动保存";
  }
  if (item.status === "error" && item.event.type !== "long.mutation_proposal") {
    return "重试";
  }
  switch (item.event.type) {
    case "long.mutation_proposal":
      return "确认应用";
    case "long.worldbuilding_file_proposal":
    case "long.character_file_proposal":
    case "long.continuity_file_proposal":
      return "确认写入并保存";
    case "long.ledger_commit_proposal":
      return item.status === "error" ? "重试归档" : "立即归档";
  }
}

function proposalStatusText(item: LongWorkspaceProposalItem): string {
  if (item.event.type === "long.ledger_commit_proposal") {
    if (item.status === "accepted") return "已归档";
    if (item.status === "waiting") return "等待前序文件";
    if (item.status === "submitting") return "正在归档";
    if (item.status === "error") return "归档失败";
    return "等待归档";
  }
  if (item.status === "accepted") return "已接受";
  if (item.status === "waiting") return "等待前序文件";
  if (item.status === "previewing") {
    return item.approvalMode === "auto-approve" ? "自动预览中" : "正在预览";
  }
  if (item.status === "submitting") {
    return item.approvalMode === "auto-approve" ? "自动保存中" : "正在处理";
  }
  if (item.status === "error") {
    if (item.errorPhase === "preview") return "校验未通过";
    return item.approvalMode === "auto-approve"
      ? "自动保存失败"
      : item.errorRetryable === false
        ? "无法应用"
        : "应用失败";
  }
  return item.approvalMode === "auto-approve" ? "等待自动保存" : "等待确认";
}

function contentProposalVisualStatus(
  item: LongWorkspaceProposalItem
): "pending" | "accepting" | "accepted" | "error" {
  if (item.status === "accepted") return "accepted";
  if (item.status === "error") return "error";
  if (item.status === "previewing" || item.status === "submitting") {
    return "accepting";
  }
  return "pending";
}

function contentProposalStatusLabel(item: LongWorkspaceProposalItem): string {
  if (item.status === "accepted") return "已接受";
  if (item.status === "error") {
    return item.errorPhase === "preview" ? "校验未通过" : "应用失败";
  }
  if (item.status === "waiting") return "等待前序文件";
  if (item.status === "previewing") return "正在校验";
  if (item.status === "submitting") return "正在应用";
  return item.approvalMode === "auto-approve" ? "待自动保存" : "待审阅";
}

function contentProposalDiffStats(item: LongWorkspaceProposalItem): {
  additions: number;
  deletions: number;
  hunks: number;
} {
  return (contentFileCards.value.get(item.event.id) ?? []).reduce(
    (total, card) => ({
      additions: total.additions + card.diff.additions,
      deletions: total.deletions + card.diff.deletions,
      hunks: total.hunks + card.diff.hunks.length
    }),
    { additions: 0, deletions: 0, hunks: 0 }
  );
}

function contentProposalStatusMessage(item: LongWorkspaceProposalItem): string {
  if (item.status === "accepted") {
    return item.approvalMode === "auto-approve"
      ? "已自动批准并保存到本地 Markdown。"
      : "变更已应用并保存到本机。";
  }
  if (item.status === "error") {
    if (item.errorPhase === "preview") {
      return item.error ?? "暂时无法读取变更影响，内容尚未保存。";
    }
    return item.error ?? "变更未能保存，可再次保存或拒绝。";
  }
  if (item.status === "waiting") {
    return "正在等待前序文件创建或写入完成，随后继续校验。";
  }
  if (item.status === "previewing") {
    return "正在读取文件与变更影响……";
  }
  if (item.status === "submitting") {
    return "正在应用变更并保存……";
  }
  return item.approvalMode === "auto-approve"
    ? "已加入实时自动保存队列。"
    : "接受后将应用到对应 Markdown 并自动保存到本机。";
}

function showContentProposalActions(item: LongWorkspaceProposalItem): boolean {
  return (
    item.status !== "accepted" &&
    (item.approvalMode !== "auto-approve" || item.status === "error")
  );
}

function contentProposalAcceptDisabled(
  item: LongWorkspaceProposalItem
): boolean {
  return (
    item.status === "previewing" ||
    item.status === "submitting" ||
    item.status === "waiting" ||
    (item.status === "error" && item.errorRetryable === false) ||
    (item.status === "ready" && !item.preview)
  );
}

function contentProposalAcceptLabel(item: LongWorkspaceProposalItem): string {
  if (item.status === "submitting") return "保存中…";
  if (item.status === "error" && item.errorRetryable === false) {
    return "无法保存";
  }
  return item.status === "error"
    ? item.errorPhase === "preview"
      ? "重新读取并保存"
      : "再次保存"
    : "接受并保存";
}

function isStructureProposalItem(item: LongWorkspaceProposalItem): boolean {
  return item.event.type === "long.mutation_proposal";
}

function usesEditProposalSurface(item: LongWorkspaceProposalItem): boolean {
  return isStructureProposalItem(item) || isContentFileProposalItem(item);
}

function proposalVisualStatus(
  item: LongWorkspaceProposalItem
): "pending" | "accepting" | "accepted" | "rejected" | "conflict" | "error" {
  return contentProposalVisualStatus(item);
}

function structureProposalStatusMessage(
  item: LongWorkspaceProposalItem
): string {
  if (item.status === "accepted") return "结构变更已应用并保存到本机。";
  if (item.status === "error") {
    if (item.errorPhase === "preview") {
      return item.error ?? "暂时无法读取结构影响，变更尚未应用。";
    }
    return item.error ?? "结构变更未能应用，可重新预览后重试或拒绝。";
  }
  if (item.status === "previewing") {
    return "正在读取当前结构与影响范围……";
  }
  if (item.status === "submitting") {
    return "正在应用结构变更……";
  }
  return item.approvalMode === "auto-approve"
    ? "已加入实时自动保存队列。"
    : "接受后将应用到当前书籍的结构并自动保存到本机。";
}

function structureProposalAcceptDisabled(
  item: LongWorkspaceProposalItem
): boolean {
  return (
    item.status === "previewing" ||
    item.status === "submitting" ||
    item.status === "waiting" ||
    (item.status === "error" && item.errorRetryable === false) ||
    (item.status === "ready" && !item.preview)
  );
}

function structureProposalAcceptLabel(item: LongWorkspaceProposalItem): string {
  if (item.status === "submitting") return "应用中…";
  if (item.status === "error" && item.errorRetryable === false) {
    return "无法应用";
  }
  return item.status === "error"
    ? item.errorPhase === "preview"
      ? "重新校验并应用"
      : "重试应用"
    : "接受并应用";
}

function diffLineMark(type: "context" | "addition" | "deletion"): string {
  if (type === "addition") return "+";
  if (type === "deletion") return "−";
  return " ";
}
</script>

<template>
  <section
    v-if="items.length"
    class="long-proposal-review"
    :class="{
      'is-embedded': embedded,
      'is-conversation-card': conversationCard,
      'has-edit-proposal-surface-items': hasEditProposalSurfaceItems
    }"
    :aria-label="NOVEL_PROPOSAL_ACCESSIBLE_NAME"
  >
    <header v-if="!embedded">
      <div>
        <span>智能体写入</span>
        <strong v-if="pendingCount">{{ pendingCount }} 项处理中</strong>
        <strong v-else>{{ completedCount }} 项已保存</strong>
      </div>
      <small>所有变更均按当前书籍隔离</small>
    </header>

    <div class="long-proposal-list">
      <article
        v-for="item in items"
        :key="item.event.id"
        :class="
          item.event.type === 'long.ledger_commit_proposal'
            ? 'long-ledger-finalization-item'
            : usesEditProposalSurface(item)
              ? ['edit-proposal-card', `is-${proposalVisualStatus(item)}`]
              : 'long-proposal-card'
        "
        :data-proposal-type="item.event.type"
        :aria-busy="item.status === 'submitting'"
      >
        <LongLedgerFinalizationCard
          v-if="item.event.type === 'long.ledger_commit_proposal'"
          :item="item"
          @approve="emit('approve', item.event.id)"
          @reject="emit('reject', item.event.id)"
        />
        <div
          v-if="
            item.event.type !== 'long.ledger_commit_proposal' &&
            !usesEditProposalSurface(item)
          "
          class="long-proposal-heading"
        >
          <span class="long-proposal-icon">
            <AppIcon
              :name="
                item.event.type === 'long.worldbuilding_file_proposal' ||
                item.event.type === 'long.character_file_proposal' ||
                item.event.type === 'long.continuity_file_proposal'
                  ? 'file'
                  : 'wand'
              "
              :size="15"
            />
          </span>
          <div>
            <strong>{{ proposalTitle(item) }}</strong>
            <small>{{ item.event.payload.agentId }}</small>
          </div>
          <div class="approval-status-actions">
            <span class="long-proposal-status" :class="`is-${item.status}`">
              {{ proposalStatusText(item) }}
            </span>
            <button
              v-if="item.status === 'accepted'"
              class="approval-target-button"
              type="button"
              title="跳转到目标文件"
              aria-label="跳转到目标文件"
              @click.stop="emit('locate', item.event.id)"
            >
              跳转到目标文件
            </button>
          </div>
        </div>

        <p
          v-if="
            item.event.type !== 'long.ledger_commit_proposal' &&
            !usesEditProposalSurface(item)
          "
        >
          {{ item.event.payload.summary }}
        </p>

        <template v-if="usesEditProposalSurface(item)">
          <header class="edit-proposal-header">
            <span class="edit-proposal-icon" aria-hidden="true">
              <AppIcon
                :name="isStructureProposalItem(item) ? 'wand' : 'file'"
                :size="17"
              />
            </span>
            <div class="edit-proposal-heading">
              <div class="edit-proposal-title-row">
                <strong>{{ proposalTitle(item) }}</strong>
                <span
                  class="edit-proposal-status"
                  :class="`is-${proposalVisualStatus(item)}`"
                >
                  {{
                    isStructureProposalItem(item)
                      ? proposalStatusText(item)
                      : contentProposalStatusLabel(item)
                  }}
                </span>
                <button
                  v-if="item.status === 'accepted'"
                  class="approval-target-button"
                  type="button"
                  title="跳转到目标文件"
                  aria-label="跳转到目标文件"
                  @click.stop="emit('locate', item.event.id)"
                >
                  跳转到目标文件
                </button>
              </div>
              <p>{{ item.event.payload.summary }}</p>
            </div>
            <div
              v-if="
                isContentFileProposalItem(item) &&
                canDisplayContentFileDiff(item)
              "
              class="edit-proposal-stats"
              :aria-label="`增加 ${contentProposalDiffStats(item).additions} 行，删除 ${contentProposalDiffStats(item).deletions} 行`"
            >
              <span class="is-addition">
                +{{ contentProposalDiffStats(item).additions }}
              </span>
              <span class="is-deletion">
                −{{ contentProposalDiffStats(item).deletions }}
              </span>
            </div>
          </header>

          <details
            v-if="
              isContentFileProposalItem(item) &&
              canDisplayContentFileDiff(item) &&
              contentProposalDiffStats(item).hunks
            "
            class="edit-proposal-diff"
          >
            <summary>
              <span>查看差异</span>
              <small>
                {{ contentProposalDiffStats(item).hunks }} 个变更块
              </small>
              <AppIcon name="chevron" :size="13" />
            </summary>
            <div class="edit-diff-content">
              <section
                v-for="card in contentFileCards.get(item.event.id) ?? []"
                :key="card.file.fileId"
                class="long-edit-diff-file"
              >
                <div
                  v-if="(contentFileCards.get(item.event.id)?.length ?? 0) > 1"
                  class="long-edit-diff-file-label"
                >
                  {{ contentFileTitle(item, card.file) }}
                </div>
                <div
                  v-for="(hunk, hunkIndex) in card.diff.hunks"
                  :key="`${card.file.fileId}:hunk:${hunkIndex}`"
                  class="edit-diff-hunk"
                >
                  <div class="edit-diff-hunk-header">
                    @@ -{{ hunk.oldStart }},{{ hunk.oldLines }} +{{
                      hunk.newStart
                    }},{{ hunk.newLines }}
                    @@
                  </div>
                  <div
                    v-for="(line, lineIndex) in hunk.lines"
                    :key="`${card.file.fileId}:${hunkIndex}:${lineIndex}`"
                    class="edit-diff-line"
                    :class="`is-${line.type}`"
                  >
                    <span class="edit-diff-line-number">
                      {{ line.oldLineNumber ?? "" }}
                    </span>
                    <span class="edit-diff-line-number">
                      {{ line.newLineNumber ?? "" }}
                    </span>
                    <span class="edit-diff-line-mark" aria-hidden="true">
                      {{ diffLineMark(line.type) }}
                    </span>
                    <code>{{ line.text }}</code>
                  </div>
                </div>
                <p v-if="card.diff.truncated" class="edit-diff-truncated">
                  差异较大，仅显示部分变更；行数统计包含完整提案。
                </p>
              </section>
            </div>
          </details>
          <p
            v-else-if="
              isContentFileProposalItem(item) &&
              !canDisplayContentFileDiff(item)
            "
            class="edit-proposal-empty"
          >
            文件身份和原文尚未通过校验，暂不显示差异。
          </p>
          <p
            v-else-if="isContentFileProposalItem(item)"
            class="edit-proposal-empty"
          >
            已创建空白 Markdown 文件，没有正文行级差异。
          </p>

          <footer class="edit-proposal-footer">
            <span class="edit-proposal-message">
              {{
                isStructureProposalItem(item)
                  ? structureProposalStatusMessage(item)
                  : contentProposalStatusMessage(item)
              }}
            </span>
            <div
              v-if="
                isStructureProposalItem(item)
                  ? item.status !== 'accepted' &&
                    (item.approvalMode !== 'auto-approve' ||
                      item.status === 'error')
                  : showContentProposalActions(item)
              "
              class="edit-proposal-actions"
            >
              <button
                class="edit-review-button is-reject"
                type="button"
                :disabled="item.status === 'submitting'"
                @click="emit('reject', item.event.id)"
              >
                拒绝
              </button>
              <button
                class="edit-review-button is-accept"
                type="button"
                :disabled="
                  isStructureProposalItem(item)
                    ? structureProposalAcceptDisabled(item)
                    : contentProposalAcceptDisabled(item)
                "
                @click="emit('approve', item.event.id)"
              >
                {{
                  isStructureProposalItem(item)
                    ? structureProposalAcceptLabel(item)
                    : contentProposalAcceptLabel(item)
                }}
              </button>
            </div>
          </footer>
        </template>

        <LongProposalImpactDetails
          v-if="item.event.type === 'long.mutation_proposal' && item.preview"
          :item="item"
          :workspace-index="workspaceIndex"
        />

        <footer
          v-if="
            item.event.type !== 'long.ledger_commit_proposal' &&
            !usesEditProposalSurface(item) &&
            item.status !== 'accepted' &&
            (item.approvalMode !== 'auto-approve' || item.status === 'error')
          "
        >
          <button
            class="long-proposal-secondary"
            type="button"
            :disabled="item.status === 'submitting'"
            @click="emit('reject', item.event.id)"
          >
            拒绝
          </button>
          <button
            v-if="
              (item.event.type === 'long.mutation_proposal' ||
                item.event.type === 'long.worldbuilding_file_proposal' ||
                item.event.type === 'long.character_file_proposal' ||
                item.event.type === 'long.continuity_file_proposal') &&
              item.status === 'error'
            "
            class="long-proposal-secondary"
            type="button"
            @click="emit('retryPreview', item.event.id)"
          >
            重新预览
          </button>
          <button
            class="long-proposal-primary"
            type="button"
            :disabled="
              item.status === 'previewing' ||
              item.status === 'submitting' ||
              ((item.event.type === 'long.mutation_proposal' ||
                item.event.type === 'long.worldbuilding_file_proposal' ||
                item.event.type === 'long.character_file_proposal' ||
                item.event.type === 'long.continuity_file_proposal') &&
                (item.status !== 'ready' || !item.preview))
            "
            @click="emit('approve', item.event.id)"
          >
            {{ proposalAction(item) }}
          </button>
        </footer>
      </article>
    </div>
  </section>
</template>

<style scoped>
.long-proposal-review {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  max-height: min(43%, 360px);
  min-height: 0;
  border-top: 1px solid var(--theme-line);
  background: var(--surface-muted);
  color: var(--text-primary);
}

.long-proposal-review.is-embedded {
  max-height: none;
  border-top: 0;
  background: transparent;
}

.long-proposal-review.is-embedded .long-proposal-list {
  padding: 10px 0 0;
  overflow: visible;
}

.long-proposal-review.is-embedded.has-edit-proposal-surface-items
  .long-proposal-list {
  gap: 12px;
  padding: 0;
  margin: 14px 0 20px;
}

.long-proposal-review.is-embedded.is-conversation-card .long-proposal-list {
  padding: 0;
  margin: 0;
}

.long-proposal-review > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-width: 0;
  gap: 10px;
  padding: 9px 12px;
  border-bottom: 1px solid var(--theme-line-soft);
  background: var(--surface-raised);
}

.long-proposal-review > header > div {
  display: flex;
  align-items: baseline;
  gap: 7px;
}

.long-proposal-review > header span,
.long-proposal-review > header small {
  color: var(--text-tertiary);
  font-size: 0.642857rem;
}

.long-proposal-review > header strong {
  font-size: 0.75rem;
}

.long-proposal-list {
  display: grid;
  gap: 7px;
  min-height: 0;
  padding: 8px;
  overflow: auto;
}

.long-proposal-card {
  display: grid;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--theme-line-soft);
  border-radius: 10px;
  background: var(--surface-raised);
}

.long-proposal-heading {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) auto;
  align-items: center;
  gap: 7px;
}

.long-proposal-icon {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: var(--accent-soft);
  color: var(--accent);
}

.long-proposal-heading > div {
  display: grid;
  min-width: 0;
  gap: 1px;
}

.long-proposal-heading strong {
  font-size: 0.75rem;
}

.long-proposal-heading small {
  color: var(--text-tertiary);
  font-size: 0.607143rem;
}

.long-proposal-status {
  padding: 3px 6px;
  border-radius: 999px;
  background: var(--surface-selected);
  color: var(--text-secondary);
  font-size: 0.607143rem;
}

.long-proposal-status.is-error {
  color: var(--danger);
}

.long-proposal-status.is-accepted {
  background: color-mix(in srgb, var(--success) 13%, transparent);
  color: var(--success);
}

.long-proposal-card > p {
  color: var(--text-secondary);
  font-size: 0.678571rem;
  line-height: 1.55;
}

.long-edit-diff-file + .long-edit-diff-file {
  border-top: 1px solid var(--theme-line-soft);
}

.long-edit-diff-file-label {
  padding: 6px 12px;
  border-bottom: 1px solid var(--theme-line-soft);
  background: var(--surface-muted);
  color: var(--text-secondary);
  font-size: 0.75rem;
  font-weight: 600;
}

.long-proposal-card footer {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}

.long-proposal-card button {
  min-height: 27px;
  padding: 4px 9px;
  border-radius: 7px;
  font-size: 0.678571rem;
  cursor: pointer;
}

.long-proposal-card button:disabled {
  cursor: default;
  opacity: 0.55;
}

.long-proposal-secondary {
  border: 1px solid var(--theme-line);
  background: var(--surface-raised);
  color: var(--text-secondary);
}

.long-proposal-secondary:hover:not(:disabled) {
  background: var(--surface-hover);
  color: var(--text-primary);
}

.long-proposal-primary {
  background: var(--neutral-solid);
  color: var(--accent-contrast, #fff);
}

:global(html[data-theme="dark"] .long-proposal-primary) {
  background: var(--accent);
}
</style>
