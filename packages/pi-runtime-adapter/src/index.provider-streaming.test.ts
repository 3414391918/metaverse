import type { AgentRuntimeEvent, AssistantMessage } from "./index.test-support";
import {
  PiAgentRuntimeAdapter,
  buildRawUserMessage,
  createAssistantMessageEventStream,
  describe,
  expect,
  interceptToolCallStream,
  it,
  providerRuntime,
  reconcileToolCallArguments,
  toToolStreamRuntimeEvent,
  toUsageObservedRuntimeEvent,
  toolCallMessage
} from "./index.test-support";

describe("provider and local streaming", () => {
  it("keeps uploaded text and images as native user-message content", () => {
    const message = buildRawUserMessage(
      {
        runId: "run_attachment",
        sessionId: "session_attachment",
        prompt: "结合附件分析场景",
        attachments: [
          {
            id: "notes",
            kind: "text",
            name: "notes.md",
            mediaType: "text/markdown",
            size: 12,
            content: "雨夜，旧站台。"
          },
          {
            id: "reference",
            kind: "image",
            name: "reference.png",
            mediaType: "image/png",
            size: 3,
            data: "AQID"
          }
        ]
      },
      123
    );

    expect(message.timestamp).toBe(123);
    expect(message.content).toEqual([
      {
        type: "text",
        text: expect.stringContaining("雨夜，旧站台。")
      },
      { type: "image", data: "AQID", mimeType: "image/png" }
    ]);
  });

  it("does not silently ignore images on the local text-only runtime", async () => {
    const runtime = new PiAgentRuntimeAdapter({ tokensPerSecond: 0 });
    const consume = async () => {
      for await (const _event of runtime.start({
        runId: "run_image_faux",
        sessionId: "session_image_faux",
        prompt: "分析图片",
        attachments: [
          {
            id: "reference",
            kind: "image",
            name: "reference.png",
            mediaType: "image/png",
            size: 3,
            data: "AQID"
          }
        ]
      })) {
        // The capability check fails before a stream is created.
      }
    };

    await expect(consume()).rejects.toThrow("Faux 不支持图片理解");
  });

  it("observes raw tool chunks while forwarding them to pi-agent-core", async () => {
    const source = createAssistantMessageEventStream();
    const observed: Array<{ type: string; turn: number }> = [];
    const intercepted = interceptToolCallStream(
      async () => source,
      (event, turn) => observed.push({ type: event.type, turn })
    );
    const message = toolCallMessage("tool_write", "write_workspace_editor");
    const forwarded = await intercepted(
      {} as Parameters<typeof intercepted>[0],
      { messages: [] },
      undefined
    );
    const received: string[] = [];
    const consume = (async () => {
      for await (const event of forwarded) received.push(event.type);
    })();

    source.push({ type: "start", partial: message });
    source.push({ type: "toolcall_start", contentIndex: 0, partial: message });
    source.push({
      type: "toolcall_delta",
      contentIndex: 0,
      delta: '{"text":"第一段',
      partial: message
    });
    source.push({
      type: "toolcall_end",
      contentIndex: 0,
      toolCall: message.content[0] as Extract<
        AssistantMessage["content"][number],
        { type: "toolCall" }
      >,
      partial: message
    });
    source.push({ type: "done", reason: "toolUse", message });
    await consume;

    expect(observed).toEqual([
      { type: "toolcall_start", turn: 0 },
      { type: "toolcall_delta", turn: 0 },
      { type: "toolcall_end", turn: 0 }
    ]);
    expect(received).toEqual([
      "start",
      "toolcall_start",
      "toolcall_delta",
      "toolcall_end",
      "done"
    ]);
  });

  it("turns an intercepted iterator rejection into a retryable error terminal", async () => {
    const partial = toolCallMessage(
      "tool_interrupted",
      "write_workspace_editor"
    );
    const source = {
      async *[Symbol.asyncIterator]() {
        yield { type: "start", partial } as const;
        throw new Error("socket hang up");
      },
      result: async () => partial
    };
    const intercepted = interceptToolCallStream(
      async () =>
        source as unknown as ReturnType<
          typeof createAssistantMessageEventStream
        >,
      () => {}
    );
    const forwarded = await intercepted(
      {} as Parameters<typeof intercepted>[0],
      { messages: [] },
      undefined
    );
    const received: string[] = [];
    for await (const event of forwarded) received.push(event.type);

    expect(received).toEqual(["start", "error"]);
    await expect(forwarded.result()).resolves.toMatchObject({
      stopReason: "error",
      errorMessage: "socket hang up"
    });
  });

  it("assigns unique tool stream ids when content indexes repeat across model turns", () => {
    const input = {
      runId: "run_repeated_content_index",
      sessionId: "session_repeated_content_index",
      prompt: "先读取再写入"
    };
    const messageId = "run_repeated_content_index_assistant";
    const firstMessage = toolCallMessage("tool_read", "read_workspace_content");
    const secondMessage = toolCallMessage(
      "tool_write",
      "write_workspace_editor"
    );

    const first = toToolStreamRuntimeEvent(
      {
        type: "toolcall_start",
        contentIndex: 0,
        partial: firstMessage
      },
      input,
      providerRuntime,
      messageId,
      0
    );
    const second = toToolStreamRuntimeEvent(
      {
        type: "toolcall_start",
        contentIndex: 0,
        partial: secondMessage
      },
      input,
      providerRuntime,
      messageId,
      1
    );

    expect(first).toMatchObject({
      type: "agent.tool_stream",
      payload: { streamId: `${messageId}:0:0`, toolCallId: "tool_read" }
    });
    expect(second).toMatchObject({
      type: "agent.tool_stream",
      payload: { streamId: `${messageId}:1:0`, toolCallId: "tool_write" }
    });
  });

  it.each(["write_draft_section", "replace_draft_section_text"])(
    "captures an early argument snapshot for %s",
    (toolName) => {
      const input = {
        runId: `run_${toolName}`,
        sessionId: `session_${toolName}`,
        prompt: "写正文"
      };
      const message = toolCallMessage(`tool_${toolName}`, toolName);
      const toolCall = message.content[0] as Extract<
        AssistantMessage["content"][number],
        { type: "toolCall" }
      > & { partialJson?: string };
      toolCall.partialJson =
        toolName === "write_draft_section"
          ? '{"section_id":"section-1","text":"第一段'
          : '{"section_id":"section-1","replacements":[{"original_text":"旧片段';

      const event = toToolStreamRuntimeEvent(
        { type: "toolcall_start", contentIndex: 0, partial: message },
        input,
        providerRuntime,
        `${input.runId}_assistant`,
        0
      );

      expect(event.payload).toMatchObject({
        toolName,
        phase: "start",
        argumentsDelta: "",
        argumentsSnapshot: toolCall.partialJson
      });
    }
  );

  it("reduces cumulative tool argument snapshots to non-duplicated deltas", () => {
    const first = reconcileToolCallArguments("", "", '{"text":"第一');
    const second = reconcileToolCallArguments(
      first.next,
      "段",
      '{"text":"第一段'
    );
    const completed = reconcileToolCallArguments(
      second.next,
      "",
      '{"text":"第一段正文"}'
    );

    expect(first).toEqual({ delta: '{"text":"第一', next: '{"text":"第一' });
    expect(second).toEqual({ delta: "段", next: '{"text":"第一段' });
    expect(completed).toEqual({
      delta: '正文"}',
      next: '{"text":"第一段正文"}'
    });
    expect(
      reconcileToolCallArguments(completed.next, completed.next, completed.next)
    ).toEqual({ delta: "", next: completed.next });
  });

  it("observes intermediate tool turns and provider errors for accounting", () => {
    const input = {
      runId: "run_usage_observed",
      sessionId: "session_usage_observed",
      prompt: "执行工具后继续"
    };
    const intermediate = toUsageObservedRuntimeEvent(
      toolCallMessage("tool_usage", "write_draft_section"),
      input,
      providerRuntime,
      "run_usage_observed_assistant",
      { turnId: "run_usage_observed:turn:1", attempt: 1, maxAttempts: 6 }
    );
    const failedMessage: AssistantMessage = {
      ...toolCallMessage("tool_unused", "unused"),
      content: [{ type: "text", text: "" }],
      usage: {
        input: 21,
        output: 8,
        cacheRead: 3,
        cacheWrite: 2,
        totalTokens: 34,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }
      },
      stopReason: "error",
      errorMessage: "connection reset"
    };
    const failed = toUsageObservedRuntimeEvent(
      failedMessage,
      input,
      providerRuntime,
      "run_usage_observed_assistant",
      { turnId: "run_usage_observed:turn:2", attempt: 2, maxAttempts: 6 }
    );

    expect(intermediate).toMatchObject({
      type: "agent.usage_observed",
      payload: {
        observationId: "run_usage_observed:turn:1:attempt:1",
        turnId: "run_usage_observed:turn:1",
        attempt: 1,
        status: "completed",
        hadToolCall: true,
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0
        },
        runtime: providerRuntime
      }
    });
    expect(failed).toMatchObject({
      type: "agent.usage_observed",
      payload: {
        observationId: "run_usage_observed:turn:2:attempt:2",
        status: "error",
        hadToolCall: false,
        usage: {
          inputTokens: 21,
          outputTokens: 8,
          cacheReadTokens: 3,
          cacheWriteTokens: 2,
          totalTokens: 34
        }
      }
    });
  });

  it("streams thinking and text through pi-agent-core without an API key", async () => {
    const runtime = new PiAgentRuntimeAdapter({ tokensPerSecond: 0 });
    const events: AgentRuntimeEvent[] = [];

    for await (const event of runtime.start({
      runId: "run_1",
      sessionId: "session_1",
      prompt: "续写当前章节",
      thinkingLevel: "medium",
      workspaceContext: {
        activeResource: {
          id: "chapter_3",
          domain: "creation",
          title: "第三章 雨夜回声",
          path: ["雾港来信", "第三章 雨夜回声"],
          format: "正文",
          source: "live-editor",
          content: "雨是在午夜以后落下来的。"
        }
      }
    })) {
      events.push(event);
    }

    const deltas = events
      .filter(
        (event): event is Extract<AgentRuntimeEvent, { type: "agent.delta" }> =>
          event.type === "agent.delta"
      )
      .map((event) => event.payload.delta)
      .join("");
    const thinking = events.filter(
      (event) => event.type === "agent.thinking_delta"
    );
    const completed = events.find((event) => event.type === "agent.completed");
    const usageObserved = events.filter(
      (
        event
      ): event is Extract<
        AgentRuntimeEvent,
        { type: "agent.usage_observed" }
      > => event.type === "agent.usage_observed"
    );

    expect(thinking.length).toBeGreaterThan(0);
    expect(deltas).toBe(completed?.payload.content);
    expect(completed?.payload.content).toContain("第三章 雨夜回声");
    expect(completed?.payload.runtime.mode).toBe("local-faux");
    expect(usageObserved).toHaveLength(1);
    expect(usageObserved[0]).toMatchObject({
      payload: {
        status: "completed",
        hadToolCall: false,
        turnId: "run_1:turn:1",
        attempt: 1
      }
    });
    expect(usageObserved[0]?.payload.usage).toEqual(completed?.payload.usage);
    expect(
      events.some((event) => event.type === "agent.evaluation_snapshot")
    ).toBe(false);
    expect(
      events.filter((event) => event.type === "agent.turn_started")
    ).toEqual([
      expect.objectContaining({
        runId: "run_1",
        sessionId: "session_1",
        payload: expect.objectContaining({ attempt: 1, maxAttempts: 6 })
      })
    ]);
    expect(
      events.filter(
        (event) =>
          event.type === "agent.completed" || event.type === "agent.error"
      )
    ).toHaveLength(1);
    expect(
      events.every(
        (event) => event.runId === "run_1" && event.sessionId === "session_1"
      )
    ).toBe(true);
  });

  it("emits one error terminal when the run stays idle", async () => {
    const runtime = new PiAgentRuntimeAdapter({
      idleTimeoutMs: 1,
      tokensPerSecond: 0.01
    });
    const events: AgentRuntimeEvent[] = [];

    for await (const event of runtime.start({
      runId: "run_timeout",
      sessionId: "session_timeout",
      prompt: "验证超时"
    })) {
      events.push(event);
    }

    expect(events.filter((event) => event.type === "agent.error")).toHaveLength(
      1
    );
    expect(events.some((event) => event.type === "agent.completed")).toBe(
      false
    );
  });

  it("keeps a run alive while streamed events continue", async () => {
    const runtime = new PiAgentRuntimeAdapter({
      idleTimeoutMs: 100,
      tokensPerSecond: 200
    });
    const events: AgentRuntimeEvent[] = [];

    for await (const event of runtime.start({
      runId: "run_active_stream",
      sessionId: "session_active_stream",
      prompt: "验证持续流式事件",
      thinkingLevel: "off"
    })) {
      events.push(event);
    }

    expect(events.some((event) => event.type === "agent.error")).toBe(false);
    expect(
      events.filter((event) => event.type === "agent.completed")
    ).toHaveLength(1);
  });
});
