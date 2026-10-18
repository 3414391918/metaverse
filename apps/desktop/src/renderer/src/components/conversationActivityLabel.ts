import type { AgentSubagentRun } from "../types/conversation";

const TOOL_ACTIVITY: Readonly<Record<string, string>> = {
  read: "读取文件",
  list: "列出范围",
  create: "创建文件",
  edit: "修改内容",
  delete: "删除对象",
  load_skill: "加载技能",
  query_linked_material_entries: "查询素材",
  ask_user_question: "询问用户",
  propose_continuity_commit: "提交连续性",
  web_search: "智能搜索",
  switch_storyline_stage: "切换阶段",
  spawn_subagent: "安排任务中"
};

type WorkActivityItem =
  | { type: "thinking" }
  | { type: "tool"; tool: { name: string } }
  | { type: "tool-group"; tools: readonly { name: string }[] }
  | { type: string };

/** Short stage name for a real tool call. Unknown tools stay generic. */
export function toolActivityLabel(toolName: string): string {
  const known = TOOL_ACTIVITY[toolName];
  if (known) return known;
  if (toolName.startsWith("read_") || toolName.startsWith("get_")) {
    return "读取文件";
  }
  if (toolName.startsWith("list_")) return "列出范围";
  if (toolName.startsWith("search_")) return "搜索内容";
  if (toolName.startsWith("query_")) return "查询资料";
  if (toolName.startsWith("create_")) return "创建文件";
  if (toolName.startsWith("delete_")) return "删除对象";
  if (
    toolName.startsWith("write_") ||
    toolName.startsWith("edit_") ||
    toolName.startsWith("replace_") ||
    toolName.startsWith("rename_") ||
    toolName.startsWith("move_")
  ) {
    return "修改内容";
  }
  return "执行工具";
}

/** Running groups name their latest member; finished groups stay summarized. */
export function workGroupActivityLabel(group: {
  running: boolean;
  items: readonly WorkActivityItem[];
}): string {
  if (!group.running) return "处理完成";
  const last = group.items.at(-1);
  if (last?.type === "thinking") return "思考中";
  if (last?.type === "tool" && "tool" in last) {
    return toolActivityLabel(last.tool.name);
  }
  if (last?.type === "tool-group" && "tools" in last) {
    const tool = last.tools.at(-1);
    if (tool) return toolActivityLabel(tool.name);
  }
  return "处理完成";
}

/** Parent badge while a child run is still open. */
export function subagentPhaseLabel(
  run: Pick<
    AgentSubagentRun,
    "thinking" | "output" | "toolCalls" | "processingSteps"
  >
): "安排任务中" | "子智能体执行中" {
  const working =
    Boolean(
      run.thinking?.length || run.output?.length || run.toolCalls.length
    ) ||
    run.processingSteps.some(
      (step) =>
        step.type === "tool" ||
        ((step.type === "thinking" || step.type === "response") &&
          step.content.length > 0)
    );
  return working ? "子智能体执行中" : "安排任务中";
}
