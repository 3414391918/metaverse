import type { LongWorkspaceImpactConfirmation } from "@deepwrite/contracts";

const ENTITY_LABELS: Record<string, string> = {
  "worldbuilding-category": "世界观分类",
  "worldbuilding-item": "世界观条目",
  "character-type": "人物类型",
  character: "人物",
  volume: "分卷",
  arc: "剧情点",
  "chapter-card": "章卡",
  "story-event": "故事事件",
  "story-plot": "故事情节",
  "event-connection": "事件连接",
  "narrative-placement": "叙事落点",
  "foreshadowing-thread": "伏笔线",
  "foreshadowing-beat": "伏笔触点"
};

const RELATIONSHIP_LABELS: Record<string, string> = {
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
  "character-files": "人物档案映射",
  "chapter-files": "章节文件映射",
  "ledger-commit": "连续性提交记录",
  "ledger-state": "连续性状态",
  "continuity-projection": "连续性投影"
};

function snapshotTitle(value: unknown): string | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  const snapshot = value as Record<string, unknown>;
  for (const key of ["title", "name", "label"]) {
    const candidate = snapshot[key];
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
}

function quotedTitle(value: unknown): string {
  const title = snapshotTitle(value);
  return title ? `“${title}”` : "";
}

export function longImpactConfirmationLines(
  confirmation: LongWorkspaceImpactConfirmation
): string[] {
  const lines: string[] = [];
  for (const change of confirmation.entityChanges) {
    const label = ENTITY_LABELS[change.kind] ?? change.kind;
    const title = quotedTitle(change.before ?? change.after);
    const action =
      change.action === "delete"
        ? "删除"
        : change.action === "create"
          ? "新增"
          : "更新";
    lines.push(`${action}${label}${title}（${change.id}）`);
  }
  for (const change of confirmation.relationshipChanges) {
    const label = RELATIONSHIP_LABELS[change.kind] ?? change.kind;
    const action =
      change.action === "delete"
        ? "解除"
        : change.action === "create"
          ? "新增"
          : "更新";
    lines.push(`${action}${label}（${change.id}）`);
  }
  for (const intent of confirmation.fileIntents) {
    lines.push(
      `${intent.action === "delete" ? "删除" : "创建"}文件 ${intent.file.path}`
    );
  }
  for (const edit of confirmation.ledgerRecordEdits) {
    const parts = [
      edit.removePlacementIds.length
        ? `解除 ${edit.removePlacementIds.length} 个叙事落点`
        : "",
      edit.removeForeshadowingBeatIds.length
        ? `解除 ${edit.removeForeshadowingBeatIds.length} 个伏笔触点记录`
        : "",
      edit.removeSubjectIds.length
        ? `清理 ${edit.removeSubjectIds.length} 个主体引用`
        : "",
      edit.removeKnowledgeAudienceIds.length
        ? `清理 ${edit.removeKnowledgeAudienceIds.length} 个认知受众`
        : "",
      edit.removeFactIds.length
        ? `清理 ${edit.removeFactIds.length} 条事实`
        : "",
      edit.removeFactKeys.length
        ? `清理 ${edit.removeFactKeys.length} 个事实键`
        : "",
      edit.removeKnowledgeKeys.length
        ? `清理 ${edit.removeKnowledgeKeys.length} 个认知键`
        : "",
      edit.removeOpenLoopIds.length
        ? `清理 ${edit.removeOpenLoopIds.length} 个未闭环项`
        : "",
      edit.reconcileForeshadowingThreadIds.length
        ? `重算 ${edit.reconcileForeshadowingThreadIds.length} 条伏笔线`
        : "",
      edit.replaceHandoff ? "重建接续包" : ""
    ].filter(Boolean);
    lines.push(
      `更新连续性记录 ${edit.recordFile.path}：${parts.join("、") || "同步关联清理结果"}`
    );
  }
  return lines;
}

export function longImpactConfirmationDescription(
  confirmation: LongWorkspaceImpactConfirmation,
  fallback = "删除后该内容将从本机移除。"
): string {
  const lines = longImpactConfirmationLines(confirmation);
  return lines.length ? lines.join("；") + "。" : fallback;
}
