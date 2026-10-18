import {
  AgentEvaluationSnapshotEventEnvelopeSchema,
  AgentMessageDeltaEventEnvelopeSchema,
  AgentRetryScheduledEventEnvelopeSchema,
  AgentTurnStartedEventEnvelopeSchema,
  AgentUsageObservedEventEnvelopeSchema,
  SubagentActivitySchema,
  SystemEventEnvelopeSchema,
  UtilityInboundMessageSchema,
  UtilityOutboundMessageSchema,
  createEnvelope,
  describe,
  expect,
  it,
  runtime
} from "./index.test-support";

describe("desktop contracts: agent and Utility events", () => {
  it("validates an evaluation snapshot tied to its run and assistant message", () => {
    const context = { sessionId: "session_eval", runId: "run_eval" };
    const snapshot = createEnvelope(
      "agent.evaluation_snapshot",
      {
        ...context,
        messageId: "run_eval_assistant",
        runtime,
        snapshot: {
          schemaVersion: 1 as const,
          capturedAt: "2026-08-13T00:00:00.000Z",
          systemPrompt: "最终系统提示词",
          runtimeContext: {
            kind: "initial-session-context" as const,
            text: "运行时注入文本"
          },
          tools: [
            {
              name: "read_fixture",
              label: "读取夹具",
              description: "读取测试夹具。",
              inputSchema: {
                type: "object",
                properties: { id: { type: "string" } },
                required: ["id"]
              }
            }
          ],
          conversationHistory: [{ role: "user", text: "运行时注入文本" }]
        }
      },
      { id: "event_eval", context }
    );

    expect(
      AgentEvaluationSnapshotEventEnvelopeSchema.parse(snapshot).payload
        .snapshot.conversationHistory
    ).toEqual([{ role: "user", text: "运行时注入文本" }]);
    expect(SystemEventEnvelopeSchema.parse(snapshot).type).toBe(
      "agent.evaluation_snapshot"
    );
  });

  it("validates internal assistant usage observations without making them UI terminal events", () => {
    const context = { sessionId: "session_usage", runId: "run_usage" };
    const observed = createEnvelope(
      "agent.usage_observed",
      {
        ...context,
        messageId: "run_usage_assistant",
        observationId: "run_usage:turn:1:attempt:1",
        observedAt: "2026-07-29T10:00:00.000Z",
        turnId: "run_usage:turn:1",
        attempt: 1,
        status: "completed" as const,
        hadToolCall: true,
        usage: {
          inputTokens: 13,
          outputTokens: 5,
          cacheReadTokens: 2,
          cacheWriteTokens: 0,
          totalTokens: 20
        },
        runtime: {
          provider: "openai",
          model: "gpt-test",
          mode: "provider" as const,
          configId: "model-config-1"
        }
      },
      { id: "event_usage", context }
    );

    expect(
      AgentUsageObservedEventEnvelopeSchema.parse(observed).payload
    ).toMatchObject({
      observationId: "run_usage:turn:1:attempt:1",
      hadToolCall: true,
      runtime: { configId: "model-config-1" }
    });
    expect(SystemEventEnvelopeSchema.parse(observed).type).toBe(
      "agent.usage_observed"
    );
  });

  it("validates turn attempts and scheduled retries as non-terminal agent events", () => {
    const context = { sessionId: "session_retry", runId: "run_retry" };
    const turnStarted = createEnvelope(
      "agent.turn_started",
      {
        ...context,
        messageId: "message_retry",
        turnId: "turn_retry",
        attempt: 1,
        maxAttempts: 6,
        runtime
      },
      { id: "event_turn_started", context }
    );
    const retryScheduled = createEnvelope(
      "agent.retry_scheduled",
      {
        ...context,
        messageId: "message_retry",
        turnId: "turn_retry",
        failedAttempt: 1,
        nextAttempt: 2,
        maxAttempts: 6,
        delayMs: 2_000,
        retryAt: "2026-07-26T12:00:02.000Z",
        reason: "Network connection reset.",
        runtime
      },
      { id: "event_retry_scheduled", context }
    );

    expect(
      AgentTurnStartedEventEnvelopeSchema.parse(turnStarted).payload.attempt
    ).toBe(1);
    expect(
      AgentRetryScheduledEventEnvelopeSchema.parse(retryScheduled).payload
        .nextAttempt
    ).toBe(2);
    expect(SystemEventEnvelopeSchema.parse(turnStarted).type).toBe(
      "agent.turn_started"
    );
    expect(SystemEventEnvelopeSchema.parse(retryScheduled).type).toBe(
      "agent.retry_scheduled"
    );
    expect(
      UtilityOutboundMessageSchema.parse({
        kind: "utility.command.event",
        worker: "agent",
        requestId: "request_retry",
        event: retryScheduled
      }).kind
    ).toBe("utility.command.event");

    expect(() =>
      AgentTurnStartedEventEnvelopeSchema.parse({
        ...turnStarted,
        payload: { ...turnStarted.payload, attempt: 7 }
      })
    ).toThrow();
    expect(() =>
      AgentRetryScheduledEventEnvelopeSchema.parse({
        ...retryScheduled,
        payload: { ...retryScheduled.payload, nextAttempt: 3 }
      })
    ).toThrow();
  });

  it("validates subagent retry lifecycle activities", () => {
    expect(
      SubagentActivitySchema.parse({
        type: "turn_started",
        turnId: "subagent_turn_1",
        attempt: 2,
        maxAttempts: 6
      })
    ).toMatchObject({ type: "turn_started", attempt: 2 });
    expect(
      SubagentActivitySchema.parse({
        type: "retry_scheduled",
        turnId: "subagent_turn_1",
        failedAttempt: 2,
        nextAttempt: 3,
        maxAttempts: 6,
        delayMs: 5_000,
        retryAt: "2026-07-26T12:00:05.000Z",
        reason: "Provider temporarily unavailable."
      })
    ).toMatchObject({ type: "retry_scheduled", nextAttempt: 3 });

    expect(() =>
      SubagentActivitySchema.parse({
        type: "retry_scheduled",
        turnId: "subagent_turn_1",
        failedAttempt: 6,
        nextAttempt: 7,
        maxAttempts: 6,
        delayMs: 30_000,
        retryAt: "2026-07-26T12:00:30.000Z",
        reason: "Provider temporarily unavailable."
      })
    ).toThrow();
  });

  it("rejects an event whose run context differs from its payload", () => {
    const event = createEnvelope(
      "agent.message_delta",
      {
        sessionId: "session_1",
        runId: "run_1",
        messageId: "message_1",
        delta: "内容",
        runtime
      },
      {
        id: "event_bad_run",
        context: { sessionId: "session_1", runId: "run_2" }
      }
    );

    expect(() => AgentMessageDeltaEventEnvelopeSchema.parse(event)).toThrow();
  });

  it("validates command and event messages at the Utility boundary", () => {
    const command = createEnvelope(
      "session.prompt",
      { sessionId: "session_1", message: "分析人物动机" },
      { id: "cmd_utility", context: { sessionId: "session_1" } }
    );
    const event = createEnvelope(
      "agent.message_delta",
      {
        sessionId: "session_1",
        runId: "run_1",
        messageId: "message_1",
        delta: "正在分析",
        runtime
      },
      {
        id: "event_utility",
        context: { sessionId: "session_1", runId: "run_1" }
      }
    );

    expect(
      UtilityInboundMessageSchema.parse({
        kind: "utility.command.request",
        requestId: "request_1",
        command
      }).kind
    ).toBe("utility.command.request");
    expect(
      UtilityOutboundMessageSchema.parse({
        kind: "utility.command.event",
        worker: "agent",
        requestId: "request_1",
        event
      }).kind
    ).toBe("utility.command.event");

    const internalCommand = createEnvelope(
      "system.health",
      {},
      { id: "cmd_internal_health" }
    );
    expect(
      UtilityOutboundMessageSchema.parse({
        kind: "utility.internal.command.request",
        worker: "agent",
        target: "core",
        requestId: "internal_request_1",
        parentRequestId: "request_1",
        timeoutMs: 5_000,
        command: internalCommand
      }).kind
    ).toBe("utility.internal.command.request");
    expect(
      UtilityInboundMessageSchema.parse({
        kind: "utility.internal.command.result",
        worker: "agent",
        target: "core",
        requestId: "internal_request_1",
        parentRequestId: "request_1",
        result: {
          status: "accepted",
          requestId: internalCommand.id,
          payload: { status: "ok" }
        }
      }).kind
    ).toBe("utility.internal.command.result");
    expect(
      UtilityOutboundMessageSchema.safeParse({
        kind: "utility.internal.command.request",
        worker: "core",
        target: "tool",
        requestId: "internal_request_wrong_source",
        parentRequestId: "request_1",
        timeoutMs: 5_000,
        command: internalCommand
      }).success
    ).toBe(false);
    expect(
      UtilityOutboundMessageSchema.safeParse({
        kind: "utility.internal.command.request",
        worker: "agent",
        target: "agent",
        requestId: "internal_request_loop",
        parentRequestId: "request_1",
        timeoutMs: 5_000,
        command: internalCommand
      }).success
    ).toBe(false);
  });

  it("validates streamed tool arguments before tool execution", () => {
    const event = createEnvelope(
      "tool.call_stream",
      {
        sessionId: "session_tool_stream",
        runId: "run_tool_stream",
        streamId: "message_tool_stream:0",
        toolCallId: "tool_write_1",
        toolName: "write_workspace_editor",
        phase: "delta" as const,
        argumentsDelta: '{"text":"开场',
        runtime
      },
      {
        id: "event_tool_stream",
        context: { sessionId: "session_tool_stream", runId: "run_tool_stream" }
      }
    );

    expect(SystemEventEnvelopeSchema.parse(event).type).toBe(
      "tool.call_stream"
    );
  });
});
