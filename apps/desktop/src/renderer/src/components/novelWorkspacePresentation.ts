import type { LongWorkspaceRoot } from "@deepwrite/contracts";

export const NOVEL_EDITOR_LABELS = {
  accessibleName: "小说文件编辑器",
  emptyTitle: "选择一个小说文件",
  editLocked: "正在处理小说修改，编辑暂时锁定"
} as const;
export const NOVEL_PROPOSAL_ACCESSIBLE_NAME = "小说待审批提案";

export function novelDocumentEyebrow(
  root: LongWorkspaceRoot | undefined,
  role: string | undefined
): string {
  if (root === "draft") {
    if (role === "character-state") return "小说 · 章节人物状态";
    if (role === "handoff") return "小说 · 章节交接";
    return "小说 · 章节正文";
  }
  if (root === "worldbuilding") return "小说 · 世界设定";
  if (root === "character_design") return "小说 · 人物档案";
  if (root === "plot_design") return "小说 · 剧情设计";
  if (root === "continuity_ledger") return "小说 · 连续性记录";
  return "小说文稿";
}
