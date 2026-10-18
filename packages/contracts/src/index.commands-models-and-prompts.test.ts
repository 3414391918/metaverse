import { longWorkspaceRuntimeFixture } from "./workspace-runtime.test-support";
import {
  AgentMessageCompletedEventEnvelopeSchema,
  AgentMessageDeltaEventEnvelopeSchema,
  CommandEnvelopeSchema,
  PROMPT_IMAGE_ATTACHMENT_MAX_BYTES,
  PROTOCOL_VERSION,
  SessionPromptAcceptedPayloadSchema,
  SystemEventEnvelopeSchema,
  SystemHealthPayloadSchema,
  UserPromptAttachmentsSchema,
  createEnvelope,
  describe,
  expect,
  it,
  runtime
} from "./index.test-support";
import {
  SessionPromptCommandEnvelopeSchema,
  SessionPromptCommandPayloadSchema
} from "./session/commands";

describe("desktop contracts: commands and prompts", () => {
  it("creates a versioned command envelope with a correlation id", () => {
    const envelope = createEnvelope("system.health", {}, { id: "cmd_health" });

    expect(CommandEnvelopeSchema.parse(envelope)).toMatchObject({
      protocolVersion: PROTOCOL_VERSION,
      id: "cmd_health",
      type: "system.health",
      context: { correlationId: "cmd_health" }
    });
  });

  it("rejects unknown protocol versions", () => {
    const envelope = createEnvelope("system.health", {}, { id: "cmd_health" });

    expect(() =>
      CommandEnvelopeSchema.parse({ ...envelope, protocolVersion: 2 })
    ).toThrow();
  });

  it("accepts three healthy utility workers", () => {
    const workers = ["core", "agent", "tool"].map((name, index) => ({
      name,
      status: "ok",
      pid: 1000 + index,
      details: {}
    }));

    expect(
      SystemHealthPayloadSchema.parse({
        status: "ok",
        checkedAt: new Date().toISOString(),
        workers
      }).workers
    ).toHaveLength(3);
  });

  it("accepts a prompt with a matching session and live editor snapshot", () => {
    const envelope = createEnvelope(
      "session.prompt",
      {
        sessionId: "session_1",
        message: "续写这一段",
        conversationHistory: [
          {
            role: "user" as const,
            content: "先写一个雨夜开场。",
            createdAt: "2026-08-17T07:58:00.000Z"
          },
          {
            role: "assistant" as const,
            content: "雨水沿着旧站台的铁轨漫开。",
            createdAt: "2026-08-17T07:59:00.000Z"
          }
        ],
        conversationHistoryMode: "replace" as const,
        thinkingLevel: "medium" as const,
        writeApprovalMode: "auto-approve" as const,
        workspaceContext: {
          activeResource: {
            id: "chapter_1",
            domain: "creation" as const,
            title: "第一章",
            path: ["长篇小说", "第一章"],
            format: "markdown",
            source: "live-editor" as const,
            content: "窗外正在下雨。"
          }
        }
      },
      {
        id: "cmd_prompt",
        context: { sessionId: "session_1", resourceId: "chapter_1" }
      }
    );

    expect(CommandEnvelopeSchema.parse(envelope)).toMatchObject({
      type: "session.prompt",
      payload: {
        conversationHistory: [
          { role: "user", content: "先写一个雨夜开场。" },
          { role: "assistant", content: "雨水沿着旧站台的铁轨漫开。" }
        ],
        conversationHistoryMode: "replace",
        writeApprovalMode: "auto-approve"
      }
    });
  });

  it("accepts a long generated prompt without dropping character records", () => {
    const message = "人物关系：" + "关系".repeat(12_000);
    const envelope = createEnvelope(
      "session.prompt",
      { sessionId: "session_character", message },
      {
        id: "cmd_character_prompt",
        context: { sessionId: "session_character" }
      }
    );
    expect(
      SessionPromptCommandEnvelopeSchema.parse(envelope).payload.message
    ).toBe(message);
  });

  it("accepts only the explicit replace conversation-history mode", () => {
    expect(
      SessionPromptCommandPayloadSchema.parse({
        sessionId: "session_replace",
        message: "从这里重新执行",
        conversationHistoryMode: "replace"
      }).conversationHistoryMode
    ).toBe("replace");
    expect(() =>
      SessionPromptCommandPayloadSchema.parse({
        sessionId: "session_replace",
        message: "从这里重新执行",
        conversationHistoryMode: "append"
      })
    ).toThrow();
  });

  it("accepts agent team mode only for creative workspace prompts", () => {
    for (const agentTeamMode of ["normal", "team"] as const) {
      expect(
        SessionPromptCommandPayloadSchema.parse({
          sessionId: `session_${agentTeamMode}`,
          message: "继续创作",
          agentTeamMode,
          workspaceContext: {
            longWorkspace: longWorkspaceRuntimeFixture()
          }
        }).agentTeamMode
      ).toBe(agentTeamMode);
    }
    expect(
      SessionPromptCommandPayloadSchema.parse({
        sessionId: "session_default_mode",
        message: "使用缺省模式"
      }).agentTeamMode
    ).toBeUndefined();
    expect(() =>
      SessionPromptCommandPayloadSchema.parse({
        sessionId: "session_invalid_mode",
        message: "非法模式",
        agentTeamMode: "automatic"
      })
    ).toThrow();
    expect(() =>
      SessionPromptCommandPayloadSchema.parse({
        sessionId: "session_non_creative_mode",
        message: "非创作工作区",
        agentTeamMode: "team"
      })
    ).toThrow();
  });

  it("keeps chat-assistant prompts isolated from workspace and write context", () => {
    const accepted = createEnvelope(
      "session.prompt",
      {
        sessionId: "session_chat_1",
        message: "聊聊今天的计划",
        mode: "chat-assistant" as const,
        thinkingLevel: "medium" as const,
        chatAssistant: {
          mode: "normal" as const,
          webSearchEnabled: true
        }
      },
      { id: "cmd_chat", context: { sessionId: "session_chat_1" } }
    );
    expect(CommandEnvelopeSchema.parse(accepted)).toMatchObject({
      payload: {
        mode: "chat-assistant",
        chatAssistant: { mode: "normal", webSearchEnabled: true }
      }
    });

    const project = createEnvelope(
      "session.prompt",
      {
        sessionId: "session_chat_project",
        message: "核对第一章伏笔",
        mode: "chat-assistant" as const,
        chatAssistant: {
          mode: "project" as const,
          project: { projectType: "long" as const, projectId: "book-1" },
          webSearchEnabled: true
        }
      },
      { id: "cmd_chat_project", context: { sessionId: "session_chat_project" } }
    );
    expect(CommandEnvelopeSchema.parse(project)).toMatchObject({
      payload: {
        chatAssistant: {
          mode: "project",
          project: { projectType: "long", projectId: "book-1" },
          webSearchEnabled: true
        }
      }
    });

    const invalidProject = createEnvelope(
      "session.prompt",
      {
        sessionId: "session_chat_project",
        message: "缺少项目",
        mode: "chat-assistant" as const,
        chatAssistant: { mode: "project" as const }
      },
      {
        id: "cmd_chat_project_invalid",
        context: { sessionId: "session_chat_project" }
      }
    );
    expect(() => CommandEnvelopeSchema.parse(invalidProject)).toThrow();

    for (const forbidden of [
      { workspaceContext: {} },
      { writeApprovalMode: "request-approval" as const },
      { agentTeamMode: "team" as const },
      { autoApproveCrossStageOperations: true }
    ]) {
      const envelope = createEnvelope(
        "session.prompt",
        {
          sessionId: "session_chat_1",
          message: "不要读取工作区",
          mode: "chat-assistant" as const,
          ...forbidden
        },
        { id: "cmd_chat_forbidden", context: { sessionId: "session_chat_1" } }
      );
      expect(() => CommandEnvelopeSchema.parse(envelope)).toThrow();
    }

    const nonChatSearch = createEnvelope(
      "session.prompt",
      {
        sessionId: "session_non_chat_search",
        message: "不应启用搜索",
        chatAssistant: {
          mode: "normal" as const,
          webSearchEnabled: true
        }
      },
      {
        id: "cmd_non_chat_search",
        context: { sessionId: "session_non_chat_search" }
      }
    );
    expect(() => CommandEnvelopeSchema.parse(nonChatSearch)).toThrow();

    const workspaceSearch = createEnvelope(
      "session.prompt",
      {
        sessionId: "session_workspace_search",
        message: "查一下近期同类题材",
        thinkingLevel: "medium" as const,
        webSearchEnabled: true
      },
      {
        id: "cmd_workspace_search",
        context: { sessionId: "session_workspace_search" }
      }
    );
    expect(CommandEnvelopeSchema.parse(workspaceSearch)).toMatchObject({
      payload: { webSearchEnabled: true }
    });

    const chatTopLevelSearch = createEnvelope(
      "session.prompt",
      {
        sessionId: "session_chat_top_level_search",
        message: "不要走顶层搜索开关",
        mode: "chat-assistant" as const,
        chatAssistant: { mode: "normal" as const },
        webSearchEnabled: true
      },
      {
        id: "cmd_chat_top_level_search",
        context: { sessionId: "session_chat_top_level_search" }
      }
    );
    expect(() => CommandEnvelopeSchema.parse(chatTopLevelSearch)).toThrow();
  });

  it("accepts extracted text and base64 image prompt attachments", () => {
    const attachments = UserPromptAttachmentsSchema.parse([
      {
        id: "attachment_notes",
        kind: "text",
        name: "notes.md",
        mediaType: "text/markdown",
        size: 18,
        content: "雨夜场景需要更压抑。"
      },
      {
        id: "attachment_reference",
        kind: "image",
        name: "reference.png",
        mediaType: "image/png",
        size: 3,
        data: "AQID"
      }
    ]);

    expect(attachments.map((attachment) => attachment.kind)).toEqual([
      "text",
      "image"
    ]);
    expect(() =>
      UserPromptAttachmentsSchema.parse([
        {
          id: "too_large",
          kind: "image",
          name: "too-large.png",
          mediaType: "image/png",
          size: PROMPT_IMAGE_ATTACHMENT_MAX_BYTES + 1,
          data: "AQID"
        }
      ])
    ).toThrow();
    expect(() =>
      UserPromptAttachmentsSchema.parse([
        {
          id: "forged_size",
          kind: "image",
          name: "forged.png",
          mediaType: "image/png",
          size: 1,
          data: "AQID"
        }
      ])
    ).toThrow();
  });

  it("rejects blank prompts and mismatched session context", () => {
    const blank = createEnvelope(
      "session.prompt",
      { sessionId: "session_1", message: "   " },
      { id: "cmd_blank", context: { sessionId: "session_1" } }
    );
    const mismatch = createEnvelope(
      "session.prompt",
      { sessionId: "session_1", message: "继续" },
      { id: "cmd_mismatch", context: { sessionId: "session_2" } }
    );

    expect(() => CommandEnvelopeSchema.parse(blank)).toThrow();
    expect(() => CommandEnvelopeSchema.parse(mismatch)).toThrow();
  });

  it("validates a session abort against its session and run context", () => {
    const abort = createEnvelope(
      "session.abort",
      { sessionId: "session_1", runId: "run_1" },
      {
        id: "cmd_abort",
        context: { sessionId: "session_1", runId: "run_1" }
      }
    );
    const mismatch = createEnvelope(
      "session.abort",
      { sessionId: "session_1", runId: "run_1" },
      {
        id: "cmd_abort_mismatch",
        context: { sessionId: "session_1", runId: "run_2" }
      }
    );

    expect(CommandEnvelopeSchema.parse(abort).type).toBe("session.abort");
    expect(() => CommandEnvelopeSchema.parse(mismatch)).toThrow();
  });

  it("validates quick acceptance independently from streamed events", () => {
    expect(
      SessionPromptAcceptedPayloadSchema.parse({
        sessionId: "session_1",
        runId: "run_1",
        acceptedAt: new Date().toISOString(),
        runtime
      })
    ).toMatchObject({ runId: "run_1", runtime });
  });

  it("accepts delta and completion events with consistent envelope identity", () => {
    const delta = createEnvelope(
      "agent.message_delta",
      {
        sessionId: "session_1",
        runId: "run_1",
        messageId: "message_1",
        delta: "第一段",
        runtime
      },
      {
        id: "event_delta",
        context: { sessionId: "session_1", runId: "run_1" }
      }
    );
    const completed = createEnvelope(
      "agent.message_completed",
      {
        sessionId: "session_1",
        runId: "run_1",
        messageId: "message_1",
        role: "assistant" as const,
        content: "第一段",
        thinking: "先理解上下文。",
        stopReason: "stop",
        runtime
      },
      {
        id: "event_completed",
        context: { sessionId: "session_1", runId: "run_1" }
      }
    );

    expect(
      AgentMessageDeltaEventEnvelopeSchema.parse(delta).payload.delta
    ).toBe("第一段");
    expect(
      AgentMessageCompletedEventEnvelopeSchema.parse(completed).payload.content
    ).toBe("第一段");
    expect(SystemEventEnvelopeSchema.parse(completed).type).toBe(
      "agent.message_completed"
    );
  });
});
