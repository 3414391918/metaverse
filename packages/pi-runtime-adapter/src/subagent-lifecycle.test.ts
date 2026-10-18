import type { AgentToolResult } from "@earendil-works/pi-agent-core";
import {
  fauxAssistantMessage,
  fauxText,
  fauxThinking,
  fauxToolCall,
  type Context
} from "@earendil-works/pi-ai";

import { describe, expect, it } from "vitest";

import {
  type SubagentToolDetails,
  type SubagentToolProgress
} from "./subagent-runtime";
import {
  enabledDefinition,
  childTool,
  makeHarness,
  progressFrom
} from "./subagent-runtime.test-support";

describe("subagent runtime lifecycle", () => {
  it("closes the lifecycle with an error when child initialization fails", async () => {
    const { tool } = makeHarness({
      createRunId: () => "subrun-init-error",
      buildChildTools: () => {
        throw new Error("工具权限初始化失败");
      }
    });
    if (!tool) throw new Error("spawn_subagent was not built");
    const updates: AgentToolResult<SubagentToolDetails>[] = [];

    const result = await tool.execute(
      "parent-init-error",
      { subagent_id: "continuity_checker", task: "初始化检查" } as never,
      undefined,
      (update) => updates.push(update as AgentToolResult<SubagentToolDetails>)
    );

    expect(progressFrom(updates).map((item) => item.type)).toEqual([
      "started",
      "completed"
    ]);
    expect(progressFrom(updates).at(-1)).toMatchObject({
      status: "error",
      errorMessage: "工具权限初始化失败"
    });
    expect(result.content[0]).toMatchObject({
      type: "text",
      text: expect.stringContaining("工具权限初始化失败")
    });
  });

  it("runs with a clean transcript, projects activity, and returns only the final summary", async () => {
    const contexts: Context[] = [];
    let createdRunCount = 0;
    const { tool, faux } = makeHarness({
      createRunId: () => `subrun-fixed-${++createdRunCount}`,
      onContext: (context) => contexts.push(context),
      buildChildTools: () => [
        childTool(),
        { ...childTool(), name: "load_skill", label: "加载技能" },
        { ...childTool(), name: "spawn_subagent", label: "调用子智能体" }
      ],
      responses: [
        fauxAssistantMessage(
          [
            fauxThinking("先检查当前工作区。"),
            fauxToolCall(
              "echo_child_context",
              { text: "第一节" },
              { id: "child-tool" }
            )
          ],
          { stopReason: "toolUse" }
        ),
        fauxAssistantMessage([
          fauxThinking("整理交接结论。"),
          fauxText("连续性检查完成：第一节时间线一致。")
        ])
      ]
    });
    if (!tool) throw new Error("spawn_subagent was not built");
    const updates: AgentToolResult<SubagentToolDetails>[] = [];

    const result = await tool.execute(
      "parent-spawn-call",
      { subagent_id: "continuity_checker", task: "检查第一节时间线" } as never,
      undefined,
      (update) => updates.push(update as AgentToolResult<SubagentToolDetails>)
    );
    const progress = progressFrom(updates);
    const usageObserved = progress.filter(
      (
        item
      ): item is Extract<SubagentToolProgress, { type: "usage_observed" }> =>
        item.type === "usage_observed"
    );

    expect(contexts[0]?.messages).toHaveLength(1);
    expect(contexts[0]?.messages[0]).toMatchObject({
      role: "user",
      content: "检查第一节时间线"
    });
    expect(contexts[0]?.systemPrompt).toContain(enabledDefinition.systemPrompt);
    expect(contexts[0]?.systemPrompt).toContain("【本轮运行事实】");
    expect(contexts[0]?.systemPrompt).toContain("echo_child_context");
    expect(JSON.stringify(contexts[0])).not.toContain("你是短篇正文主智能体");
    expect(JSON.stringify(contexts[0])).not.toContain("雾港回声");
    expect(contexts[0]?.tools?.map((candidate) => candidate.name)).toEqual([
      "echo_child_context"
    ]);
    expect(
      contexts[0]?.tools?.some((candidate) => candidate.name === "load_skill")
    ).toBe(false);
    expect(
      contexts[0]?.tools?.some(
        (candidate) => candidate.name === "spawn_subagent"
      )
    ).toBe(false);
    expect(progress[0]).toMatchObject({
      type: "started",
      parentToolCallId: "parent-spawn-call",
      subagentRunId: "subrun-fixed-1"
    });
    expect(
      progress.some(
        (item) =>
          item.type === "activity" && item.activity.type === "thinking_delta"
      )
    ).toBe(true);
    expect(
      progress.some(
        (item) =>
          item.type === "activity" &&
          item.activity.type === "tool_requested" &&
          item.activity.toolCallId === "subrun-fixed-1:child-tool"
      )
    ).toBe(true);
    expect(progress.some((item) => item.type === "child_tool_details")).toBe(
      true
    );
    expect(usageObserved).toHaveLength(2);
    expect(
      usageObserved.map((item) => ({
        status: item.status,
        hadToolCall: item.hadToolCall,
        attempt: item.attempt
      }))
    ).toEqual([
      { status: "completed", hadToolCall: true, attempt: 1 },
      { status: "completed", hadToolCall: false, attempt: 1 }
    ]);
    expect(progress.at(-1)).toMatchObject({
      type: "completed",
      status: "completed",
      summary: "连续性检查完成：第一节时间线一致。"
    });
    const requestedIndex = progress.findIndex(
      (item) =>
        item.type === "activity" && item.activity.type === "tool_requested"
    );
    const completedToolIndex = progress.findIndex(
      (item) =>
        item.type === "activity" && item.activity.type === "tool_completed"
    );
    const detailsIndex = progress.findIndex(
      (item) => item.type === "child_tool_details"
    );
    expect(requestedIndex).toBeGreaterThan(0);
    expect(completedToolIndex).toBeGreaterThan(requestedIndex);
    expect(detailsIndex).toBeGreaterThan(completedToolIndex);
    expect(progress.length - 1).toBeGreaterThan(detailsIndex);
    expect(result.content).toEqual([
      {
        type: "text",
        text: "连续性检查完成：第一节时间线一致。"
      }
    ]);
    expect(result.details).toEqual({ kind: "subagent-result" });
    expect(JSON.stringify(result)).not.toContain("先检查当前工作区");
    expect(JSON.stringify(result)).not.toContain("已检查：第一节");

    faux.setResponses([fauxAssistantMessage(fauxText("第二次独立检查完成。"))]);
    const secondResult = await tool.execute("parent-spawn-call-2", {
      subagent_id: "continuity_checker",
      task: "重新独立检查"
    } as never);
    expect(contexts.at(-1)?.messages).toHaveLength(1);
    expect(contexts.at(-1)?.messages[0]).toMatchObject({
      role: "user",
      content: "重新独立检查"
    });
    expect(JSON.stringify(contexts.at(-1)?.messages)).not.toContain(
      "第一节时间线一致"
    );
    expect(secondResult.content).toEqual([
      {
        type: "text",
        text: "第二次独立检查完成。"
      }
    ]);
  });

  it("retries only the failed model turn and never replays a completed child tool", async () => {
    let toolExecutions = 0;
    const countingTool = childTool();
    const originalExecute = countingTool.execute;
    countingTool.execute = async (...args) => {
      toolExecutions += 1;
      return originalExecute(...args);
    };
    const { tool, faux } = makeHarness({
      createRunId: () => "subrun-retry",
      buildChildTools: () => [countingTool],
      retryPolicy: {
        delaysMs: [0, 0, 0, 0, 0],
        random: () => 0.5
      },
      responses: [
        fauxAssistantMessage(
          fauxToolCall(
            "echo_child_context",
            { text: "只执行一次" },
            { id: "once" }
          ),
          { stopReason: "toolUse" }
        ),
        fauxAssistantMessage("第一次残片", {
          stopReason: "error",
          errorMessage: "fetch failed: connection reset"
        }),
        fauxAssistantMessage("网络恢复后的最终交接。")
      ]
    });
    if (!tool) throw new Error("spawn_subagent was not built");
    const updates: AgentToolResult<SubagentToolDetails>[] = [];

    const result = await tool.execute(
      "parent-retry-call",
      {
        subagent_id: "continuity_checker",
        task: "验证子任务断线恢复"
      } as never,
      undefined,
      (update) => updates.push(update as AgentToolResult<SubagentToolDetails>)
    );
    const progress = progressFrom(updates);
    const retry = progress.find(
      (item) =>
        item.type === "activity" && item.activity.type === "retry_scheduled"
    );
    const usageObserved = progress.filter(
      (
        item
      ): item is Extract<SubagentToolProgress, { type: "usage_observed" }> =>
        item.type === "usage_observed"
    );

    expect(faux.state.callCount).toBe(3);
    expect(toolExecutions).toBe(1);
    expect(
      usageObserved.map((item) => ({
        status: item.status,
        hadToolCall: item.hadToolCall,
        turnId: item.turnId,
        attempt: item.attempt
      }))
    ).toEqual([
      {
        status: "completed",
        hadToolCall: true,
        turnId: "subrun-retry:turn:1",
        attempt: 1
      },
      {
        status: "error",
        hadToolCall: false,
        turnId: "subrun-retry:turn:2",
        attempt: 1
      },
      {
        status: "completed",
        hadToolCall: false,
        turnId: "subrun-retry:turn:2",
        attempt: 2
      }
    ]);
    expect(retry).toMatchObject({
      type: "activity",
      activity: {
        type: "retry_scheduled",
        failedAttempt: 1,
        nextAttempt: 2,
        maxAttempts: 6
      }
    });
    expect(result.content[0]).toMatchObject({
      type: "text",
      text: "网络恢复后的最终交接。"
    });
    expect(progress.at(-1)).toMatchObject({
      type: "completed",
      status: "completed"
    });
  });

  it("propagates parent cancellation to the active child agent", async () => {
    const { tool } = makeHarness({
      tokensPerSecond: 1,
      createRunId: () => "subrun-abort",
      responses: [fauxAssistantMessage(fauxText("不会完整输出".repeat(1_000)))]
    });
    if (!tool) throw new Error("spawn_subagent was not built");
    const controller = new AbortController();
    const updates: AgentToolResult<SubagentToolDetails>[] = [];
    const running = tool.execute(
      "parent-abort-call",
      { subagent_id: "continuity_checker", task: "长时间检查" } as never,
      controller.signal,
      (update) => updates.push(update as AgentToolResult<SubagentToolDetails>)
    );
    queueMicrotask(() => controller.abort());

    const result = await running;
    expect(progressFrom(updates).at(-1)).toMatchObject({
      type: "completed",
      status: "aborted",
      subagentRunId: "subrun-abort"
    });
    expect(result.content[0]).toMatchObject({
      type: "text",
      text: expect.stringContaining("已中止")
    });
  }, 5_000);

  it("applies the same tool execution hooks inside the isolated child", async () => {
    let beforeCalls = 0;
    let afterCalls = 0;
    const { tool } = makeHarness({
      toolExecutionHooks: {
        beforeToolCall: async () => {
          beforeCalls += 1;
          return undefined;
        },
        afterToolCall: async () => {
          afterCalls += 1;
          return undefined;
        }
      },
      responses: [
        fauxAssistantMessage(
          [
            fauxToolCall(
              "echo_child_context",
              { text: "权限检查" },
              { id: "hook-tool" }
            )
          ],
          { stopReason: "toolUse" }
        ),
        fauxAssistantMessage(fauxText("权限 hook 继承完成。"))
      ]
    });
    if (!tool) throw new Error("spawn_subagent was not built");

    const result = await tool.execute("parent-hook-call", {
      subagent_id: "continuity_checker",
      task: "验证权限 hook"
    } as never);

    expect(beforeCalls).toBe(1);
    expect(afterCalls).toBe(1);
    expect(result.content[0]).toMatchObject({
      type: "text",
      text: "权限 hook 继承完成。"
    });
  });

  it("enforces a wall-clock deadline even while the child keeps streaming", async () => {
    const { tool } = makeHarness({
      tokensPerSecond: 1,
      timeoutMs: 20,
      responses: [fauxAssistantMessage(fauxText("持续输出".repeat(1_000)))]
    });
    if (!tool) throw new Error("spawn_subagent was not built");
    const updates: AgentToolResult<SubagentToolDetails>[] = [];

    const result = await tool.execute(
      "parent-timeout-call",
      { subagent_id: "continuity_checker", task: "验证硬截止时间" } as never,
      undefined,
      (update) => updates.push(update as AgentToolResult<SubagentToolDetails>)
    );

    expect(progressFrom(updates).at(-1)).toMatchObject({
      type: "completed",
      status: "error",
      errorMessage: expect.stringContaining("硬截止时间")
    });
    expect(result.content[0]).toMatchObject({
      type: "text",
      text: expect.stringContaining("硬截止时间")
    });
  }, 5_000);
});
