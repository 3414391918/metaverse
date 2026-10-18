import type {
  AgentSubagentRun,
  AgentToolTrace,
  ChatMessage
} from "../types/conversation";
import { subagentPhaseLabel } from "./conversationActivityLabel";
import { isWriteTool } from "./conversationToolPresentation";
import {
  foldWorkGroups,
  type WorkGroupDisplayItem
} from "./conversationWorkGroups";

export type SubagentDisplayItem =
  | { id: string; type: "thinking"; content: string; createdAt: string }
  | { id: string; type: "response"; content: string; createdAt: string }
  | { id: string; type: "tool"; tool: AgentToolTrace; createdAt: string };

export type SubagentProcessingDisplayItem =
  | Exclude<SubagentDisplayItem, { type: "tool" }>
  | { id: string; type: "tool"; tool: AgentToolTrace; createdAt: string }
  | { id: string; type: "tool-group"; tools: AgentToolTrace[] }
  | WorkGroupDisplayItem;

export function subagentDisplayItems(
  run: AgentSubagentRun
): SubagentDisplayItem[] {
  if (run.processingSteps.length) {
    const items: SubagentDisplayItem[] = [];
    for (const step of run.processingSteps) {
      if (step.type === "thinking" || step.type === "response") {
        items.push({ ...step });
        continue;
      }
      const tool = run.toolCalls.find(
        (candidate) => candidate.id === step.toolCallId
      );
      if (tool) {
        items.push({
          id: step.id,
          type: "tool",
          tool,
          createdAt: step.createdAt
        });
      }
    }
    return items;
  }

  const items: SubagentDisplayItem[] = [];
  if (run.thinking) {
    items.push({
      id: `${run.subagentRunId}_thinking`,
      type: "thinking",
      content: run.thinking,
      createdAt: run.startedAt
    });
  }
  if (run.output) {
    items.push({
      id: `${run.subagentRunId}_response`,
      type: "response",
      content: run.output,
      createdAt: run.startedAt
    });
  }
  for (const tool of run.toolCalls) {
    items.push({
      id: `${run.subagentRunId}_${tool.id}`,
      type: "tool",
      tool,
      createdAt: tool.requestedAt
    });
  }
  return items;
}

export function subagentProcessingDisplayItems(
  run: AgentSubagentRun
): SubagentProcessingDisplayItem[] {
  const displayItems: Array<
    Exclude<SubagentProcessingDisplayItem, { type: "work-group" }>
  > = [];
  for (const item of subagentDisplayItems(run)) {
    if (item.type !== "tool" || isWriteTool(item.tool)) {
      displayItems.push(item);
      continue;
    }
    const previous = displayItems.at(-1);
    if (previous?.type === "tool-group") {
      previous.tools.push(item.tool);
      continue;
    }
    displayItems.push({
      id: `${item.id}_group`,
      type: "tool-group",
      tools: [item.tool]
    });
  }
  return foldWorkGroups(displayItems, run.status === "running");
}

const subagentStatusLabels: Record<
  Exclude<AgentSubagentRun["status"], "running">,
  string
> = {
  completed: "已完成",
  error: "失败",
  stopped: "已停止"
};

function retryCountdownSeconds(run: AgentSubagentRun, now: number): number {
  const retryAt = run.retry?.retryAt
    ? Date.parse(run.retry.retryAt)
    : Number.NaN;
  return Number.isFinite(retryAt)
    ? Math.max(0, Math.ceil((retryAt - now) / 1_000))
    : Math.max(0, Math.ceil((run.retry?.delayMs ?? 0) / 1_000));
}

export function subagentStatusLabel(
  run: AgentSubagentRun,
  now: number
): string {
  if (run.retry?.state === "trying") return "正在重试";
  if (run.retry?.state === "scheduled") {
    return `${retryCountdownSeconds(run, now)}s 后重试`;
  }
  if (run.status === "running") return subagentPhaseLabel(run);
  return subagentStatusLabels[run.status];
}

export function subagentRetryProgress(
  run: AgentSubagentRun
): string | undefined {
  if (!run.retry) return undefined;
  return `第 ${Math.max(1, run.retry.attempt - 1)}/${Math.max(1, run.retry.maxAttempts - 1)} 次`;
}

export function subagentRetryStatus(
  run: AgentSubagentRun,
  now: number
): string | undefined {
  const progress = subagentRetryProgress(run);
  if (!run.retry || !progress) return undefined;
  if (run.retry.state === "trying") return `正在重试（${progress}）`;
  return `网络波动，${retryCountdownSeconds(run, now)}s 后重试（${progress}）`;
}

export function subagentDuration(run: AgentSubagentRun, now: number): string {
  const start = Date.parse(run.startedAt);
  const end = run.completedAt
    ? Date.parse(run.completedAt)
    : run.status === "running"
      ? now
      : start;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "";
  const seconds = Math.max(0, Math.ceil((end - start) / 1_000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

function subagentPendingReviewCount(
  message: ChatMessage,
  run: AgentSubagentRun
): number {
  const toolCallIds = new Set(run.toolCalls.map((toolCall) => toolCall.id));
  return (message.editProposals ?? []).filter(
    (proposal) =>
      (proposal.status === "pending" || proposal.status === "accepting") &&
      proposal.toolCallIds.some((toolCallId) => toolCallIds.has(toolCallId))
  ).length;
}

function subagentWriteToolCount(run: AgentSubagentRun): number {
  return run.toolCalls.filter(isWriteTool).length;
}

export function subagentReviewHint(
  message: ChatMessage,
  run: AgentSubagentRun
): string | undefined {
  const pendingCount = subagentPendingReviewCount(message, run);
  if (pendingCount > 0) return `${pendingCount} 项待审阅`;
  const writeCount = subagentWriteToolCount(run);
  return writeCount > 0 ? `${writeCount} 次写入调用` : undefined;
}

export function subagentUsageLabel(run: AgentSubagentRun): string | undefined {
  return run.usage
    ? `${run.usage.totalTokens.toLocaleString("zh-CN")} tokens`
    : undefined;
}
