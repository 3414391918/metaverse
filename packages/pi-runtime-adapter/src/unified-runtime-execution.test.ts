import { describe, expect, it } from "vitest";
import { PiAgentRuntimeAdapter } from "./adapter";
import { toRuntimeEvents } from "./event-mapping";
import { buildDeepWriteSystemPrompt } from "./prompts";
import type { AgentRunInput, AgentRuntimeEvent } from "./runtime-types";

const retiredContexts = [
  "shortWorkspace",
  "scriptWorkspace",
  "learningImitation",
  "shortBookAnalysis",
  "longBookAnalysis",
  "styleComparison"
] as const;

describe("retired runtime execution boundaries", () => {
  it.each(retiredContexts)(
    "does not equip tools for a stale %s context",
    async (context) => {
      const runtime = new PiAgentRuntimeAdapter({
        tokensPerSecond: 0,
        evaluationMode: true
      });
      const events: AgentRuntimeEvent[] = [];
      const input = {
        runId: `retired-${context}`,
        sessionId: `retired-${context}`,
        prompt: "检查当前对象",
        thinkingLevel: "off",
        workspaceContext: { [context]: {} }
      } as unknown as AgentRunInput;
      for await (const event of runtime.start(input)) events.push(event);
      const snapshot = events.find(
        (event) => event.type === "agent.evaluation_snapshot"
      );
      expect(snapshot?.payload.snapshot.tools).toEqual([]);
      expect(snapshot?.payload.snapshot.systemPrompt).toBe(
        buildDeepWriteSystemPrompt()
      );
      expect(events.some((event) => event.type === "agent.completed")).toBe(
        true
      );
    }
  );

  it.each([
    "workspace-editor-mutation",
    "workspace-stage-selection",
    "learning-imitation-result-update",
    "short-book-analysis-result",
    "long-book-analysis-result",
    "long-book-analysis-note"
  ])("ignores stale tool result details of kind %s", (kind) => {
    const events = toRuntimeEvents(
      {
        type: "tool_execution_end",
        toolCallId: "retired-result",
        toolName: "retired_tool",
        isError: false,
        result: {
          content: [{ type: "text", text: "旧结果" }],
          details: {
            kind,
            workspaceId: "retired-workspace",
            stageId: "material_split",
            text: "旧文稿",
            baseRevision: "v1:1:00000000",
            summary: "旧结果",
            jobId: "retired-job",
            unitId: "retired-unit",
            update: { gimmick: "旧素材" },
            result: {
              name: "旧分析",
              description: "旧用途",
              content: "旧正文"
            },
            note: { text: "旧笔记" }
          }
        }
      } as never,
      { runId: "run", sessionId: "session", prompt: "检查" },
      { provider: "test", model: "test", mode: "provider" },
      "message"
    );
    expect(events.map((event) => event.type)).toEqual(["agent.tool_completed"]);
  });
});
