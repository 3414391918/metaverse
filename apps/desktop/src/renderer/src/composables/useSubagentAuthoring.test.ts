import { describe, expect, it, vi } from "vitest";
import {
  createEnvelope,
  type SessionPromptCommandPayload,
  type SubagentAuthoringRuntimeContext
} from "@deepwrite/contracts";
import { useSubagentAuthoring } from "./useSubagentAuthoring";

const runtime = {
  provider: "deepwrite",
  model: "deepwrite-writing-faux",
  mode: "local-faux" as const
};

const context: SubagentAuthoringRuntimeContext = {
  parentAgentId: "script",
  parentAgentLabel: "剧本智能体",
  outputMode: "handoff",
  skills: [
    {
      id: "skill_1",
      title: "剧情检查",
      libraryTitle: "写作技能库",
      body: "检查人物动机与事件因果。"
    }
  ],
  existingSubagentNames: []
};

describe("useSubagentAuthoring", () => {
  it("hydrates selected indexed skills before starting generation", async () => {
    const prompt = vi.fn(async (payload: SessionPromptCommandPayload) => ({
      sessionId: payload.sessionId,
      runId: "run_authoring_hydrated",
      acceptedAt: "2026-08-19T04:00:00.000Z",
      runtime
    }));
    const readDocument = vi.fn(async () => ({
      content: "从技能文档按需读取的正文。"
    }));
    const controller = useSubagentAuthoring({
      api: () => ({
        session: { prompt, abort: vi.fn() },
        catalog: { readDocument }
      }),
      createId: () => "authoring_session_hydrated"
    });
    const indexedContext: SubagentAuthoringRuntimeContext = {
      ...context,
      skills: [
        {
          id: "skill:library_1:entry_1",
          libraryId: "library_1",
          entryId: "entry_1",
          title: "剧情检查",
          libraryTitle: "写作技能库",
          body: ""
        }
      ]
    };

    await expect(controller.generate(indexedContext, "model_a")).resolves.toBe(
      true
    );

    expect(readDocument).toHaveBeenCalledWith({
      projectId: "library_1",
      target: "document",
      documentId: "entry_1"
    });
    expect(
      prompt.mock.calls[0]?.[0].workspaceContext?.subagentAuthoring?.skills[0]
        ?.body
    ).toBe("从技能文档按需读取的正文。");
  });

  it("stays busy while a model turn waits for and begins a retry", async () => {
    let promptPayload: SessionPromptCommandPayload | undefined;
    const api = {
      session: {
        prompt: vi.fn(async (payload: SessionPromptCommandPayload) => {
          promptPayload = payload;
          return {
            sessionId: payload.sessionId,
            runId: "run_authoring_retry",
            acceptedAt: "2026-07-26T04:00:00.000Z",
            runtime
          };
        }),
        abort: vi.fn()
      }
    };
    const controller = useSubagentAuthoring({
      api: () => api,
      createId: () => "authoring_session_retry"
    });

    await expect(controller.generate(context, "model_a")).resolves.toBe(true);
    const sessionId = promptPayload?.sessionId;
    if (!sessionId) throw new Error("missing authoring session id");

    controller.handleEvent(
      createEnvelope(
        "agent.turn_started",
        {
          sessionId,
          runId: "run_authoring_retry",
          messageId: "authoring_message_retry",
          turnId: "authoring_turn_retry",
          attempt: 1,
          maxAttempts: 6,
          runtime
        },
        {
          id: "event_authoring_turn_started",
          timestamp: "2026-07-26T04:00:00.000Z",
          context: { sessionId, runId: "run_authoring_retry" }
        }
      )
    );
    controller.handleEvent(
      createEnvelope(
        "agent.retry_scheduled",
        {
          sessionId,
          runId: "run_authoring_retry",
          messageId: "authoring_message_retry",
          turnId: "authoring_turn_retry",
          failedAttempt: 1,
          nextAttempt: 2,
          maxAttempts: 6,
          delayMs: 30_000,
          retryAt: "2026-07-26T04:00:30.000Z",
          reason: "连接暂时中断",
          runtime
        },
        {
          id: "event_authoring_retry_scheduled",
          timestamp: "2026-07-26T04:00:01.000Z",
          context: { sessionId, runId: "run_authoring_retry" }
        }
      )
    );

    expect(controller.status.value).toBe("running");
    expect(controller.isBusy.value).toBe(true);
    expect(controller.statusText.value).toBe(
      "网络波动，30s 后重试（第 1/5 次）"
    );

    controller.handleEvent(
      createEnvelope(
        "agent.turn_started",
        {
          sessionId,
          runId: "run_authoring_retry",
          messageId: "authoring_message_retry",
          turnId: "authoring_turn_retry",
          attempt: 2,
          maxAttempts: 6,
          runtime
        },
        {
          id: "event_authoring_retry_started",
          timestamp: "2026-07-26T04:00:30.000Z",
          context: { sessionId, runId: "run_authoring_retry" }
        }
      )
    );

    expect(controller.status.value).toBe("running");
    expect(controller.isBusy.value).toBe(true);
    expect(controller.statusText.value).toBe("正在重试（第 1/5 次）");
  });
});
