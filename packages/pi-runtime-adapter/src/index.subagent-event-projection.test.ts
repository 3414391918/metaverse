import {
  describe,
  evaluationConversationHistory,
  expect,
  it,
  providerRuntime,
  toRuntimeEvents,
  toolCallMessage
} from "./index.test-support";

describe("DeepWrite Pi runtime adapter: subagent-event-projection", () => {
  it("omits blank tool names from evaluation conversation history", () => {
    expect(
      evaluationConversationHistory([
        toolCallMessage(" ", " "),
        {
          role: "toolResult",
          toolCallId: "   ",
          toolName: "",
          content: [{ type: "text", text: "工具已返回。" }],
          isError: false,
          timestamp: 2
        }
      ])
    ).toEqual([
      { role: "assistant", text: "" },
      { role: "tool", text: "工具已返回。" }
    ]);
  });

  it("maps subagent progress updates in started-activity-completed order", () => {
    const input = {
      runId: "parent-run-order",
      sessionId: "parent-session-order",
      prompt: "委派检查"
    };
    const progress = [
      {
        type: "started",
        parentToolCallId: "spawn-order",
        subagentRunId: "subrun-order",
        subagentId: "reviewer",
        name: "审校",
        task: "检查时间线"
      },
      {
        type: "activity",
        parentToolCallId: "spawn-order",
        subagentRunId: "subrun-order",
        subagentId: "reviewer",
        name: "审校",
        activity: { type: "message_delta", delta: "结论" }
      },
      {
        type: "completed",
        parentToolCallId: "spawn-order",
        subagentRunId: "subrun-order",
        subagentId: "reviewer",
        name: "审校",
        status: "completed",
        summary: "检查完成"
      }
    ];
    const events = progress.flatMap((item) =>
      toRuntimeEvents(
        {
          type: "tool_execution_update",
          toolCallId: "spawn-order",
          toolName: "spawn_subagent",
          args: {},
          partialResult: {
            content: [{ type: "text", text: "progress" }],
            details: { kind: "subagent-progress", progress: item }
          }
        } as never,
        input,
        providerRuntime,
        "parent-assistant-order"
      )
    );

    expect(events.map((event) => event.type)).toEqual([
      "subagent.started",
      "subagent.activity",
      "subagent.completed"
    ]);
    expect(
      events.every(
        (event) =>
          event.runId === input.runId && event.sessionId === input.sessionId
      )
    ).toBe(true);
  });
});
