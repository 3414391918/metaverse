import {
  fauxToolCall,
  fauxAssistantMessage,
  fauxText
} from "@earendil-works/pi-ai";
import type { AgentRunInput } from "./runtime-types";
export function analysisFauxResponses(input: AgentRunInput) {
  const revision = input.workspaceContext?.revisionAnalysis;
  if (revision)
    return [
      fauxAssistantMessage(
        fauxToolCall(
          "create_skill_draft",
          {
            title: "修改方向技能",
            description: "在文稿修订时根据修改证据调整表达并保留作品事实。",
            content:
              "# 修改方向\n\n适用场景：文稿修订。\n\n1. 阅读原文与修改目标。\n2. 根据证据调整表达。\n3. 检查是否保留作品事实。\n\n这是 Faux Runtime 验证草稿。"
          },
          { id: `${input.runId}-revision-result` }
        ),
        { stopReason: "toolUse" }
      ),
      fauxAssistantMessage(
        fauxText(
          "# 修改分析报告\n\n这是 Faux Runtime 验证结果。\n\n" +
            revision.changes
              .map(
                (c, i) =>
                  `差异 ${i + 1}（${c.id}）：${c.reason || "修改动机为推断"}`
              )
              .join("\n")
        )
      )
    ];
  return undefined;
}
