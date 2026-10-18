import { workspace } from "./long-agent-tools.test-support";
import type { LongWorkspaceRuntimeContext } from "./index.test-support";
import {
  DEFAULT_LONG_AGENT_PROFILES,
  PiAgentRuntimeAdapter,
  buildEffectiveSystemPrompt,
  describe,
  expect,
  it,
  normalChatContext
} from "./index.test-support";

describe("creation system prompts", () => {
  it("isolates chat-assistant prompts, tools and cached history from workspace agents", async () => {
    const runtime = new PiAgentRuntimeAdapter({ tokensPerSecond: 0 });
    const sessionId = "session_shared_chat_boundary";

    for (const [runId, prompt] of [
      ["run_chat_1", "你好，只聊聊天"],
      ["run_chat_2", "继续刚才的话题"]
    ] as const) {
      for await (const _event of runtime.start({
        runId,
        sessionId,
        prompt,
        mode: "chat-assistant",
        chatAssistantRuntimeContext: normalChatContext(),
        thinkingLevel: "off"
      })) {
        // Consume the isolated chat turn before inspecting the cache.
      }
    }

    for await (const _event of runtime.start({
      runId: "run_workspace_same_session",
      sessionId,
      prompt: "分析当前内容",
      thinkingLevel: "off",
      workspaceContext: {
        activeResource: {
          id: "workspace_resource",
          domain: "creation",
          title: "工作区文稿",
          path: ["工作区文稿"],
          source: "live-editor",
          content: "这段内容不能进入聊天助手。"
        }
      }
    })) {
      // Consume a workspace turn with the same session id.
    }

    const cache = (
      runtime as unknown as {
        conversationAgents: Map<
          string,
          {
            state: {
              systemPrompt: string;
              tools: Array<{ name: string }>;
              messages: Array<{ role?: string; content?: unknown }>;
            };
          }
        >;
      }
    ).conversationAgents;
    expect([...cache.keys()]).toEqual(
      expect.arrayContaining([
        `${sessionId}:chat-assistant:normal`,
        `${sessionId}:default`
      ])
    );

    const chat = cache.get(`${sessionId}:chat-assistant:normal`)!;
    expect(chat.state.tools.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        "list_creation_projects",
        "get_creation_project_summary",
        "query_model_configs",
        "query_model_usage"
      ])
    );
    expect(chat.state.tools.map(({ name }) => name)).not.toEqual(
      expect.arrayContaining(["read_workspace_content", "edit_text"])
    );
    expect(chat.state.systemPrompt).toContain("普通聊天模式");
    expect(chat.state.systemPrompt).not.toContain("本地创作协作智能体");
    const chatUserMessages = chat.state.messages.filter(
      (message) => message.role === "user"
    );
    expect(chatUserMessages.map((message) => message.content)).toEqual([
      "你好，只聊聊天",
      "继续刚才的话题"
    ]);
    expect(JSON.stringify(chatUserMessages)).not.toContain("sessionId");
    expect(JSON.stringify(chatUserMessages)).not.toContain("工作区文稿");
  });

  it("describes DeepSeek server-side search for workspace agents only when enabled", () => {
    const creationProfile = DEFAULT_LONG_AGENT_PROFILES[0]!;
    const workspaceContext = { longWorkspace: workspace("long", "draft") };
    const disabledPrompt = buildEffectiveSystemPrompt("DeepWrite base", {
      runId: "run_short_search_off",
      sessionId: "session_short_search_off",
      prompt: "继续写第一节",
      longAgentProfile: creationProfile,
      workspaceContext
    });
    expect(disabledPrompt).not.toContain("本轮已启用 DeepSeek 服务端智能搜索");
    expect(disabledPrompt).not.toContain(
      "实时公开信息使用 DeepSeek 服务端 web_search"
    );

    const enabledPrompt = buildEffectiveSystemPrompt("DeepWrite base", {
      runId: "run_short_search_on",
      sessionId: "session_short_search_on",
      prompt: "查一下同类题材",
      longAgentProfile: creationProfile,
      webSearchEnabled: true,
      workspaceContext
    });
    expect(enabledPrompt).toContain("本轮已启用 DeepSeek 服务端智能搜索");
    expect(enabledPrompt).toContain("DeepSeek 服务端 web_search");
    expect(enabledPrompt).toContain(
      "网络能力仅限本轮列出的 DeepSeek 服务端 web_search"
    );
  });

  it("uses only the configured long-agent prompt and discards the base prompt", () => {
    const profile = DEFAULT_LONG_AGENT_PROFILES.find(
      ({ id }) => id === "long"
    )!;
    const longWorkspace: LongWorkspaceRuntimeContext = {
      bookId: "longbook_prompt",
      title: "雾港长篇",
      activeRoot: "plot_design",
      activeAgentId: profile.id,
      navigation: {
        schemaVersion: 1,
        bookId: "longbook_prompt",
        updatedAt: "2026-07-26T10:00:00.000Z",
        counts: {
          worldbuildingCategories: 0,
          characters: 0,
          volumes: 1,
          arcs: 0,
          chapterCards: 0,
          storyEvents: 0,
          storyPlots: 0,
          foreshadowingThreads: 0,
          committedChapters: 0
        },
        worldbuilding: [],
        characterTypes: [{ id: "protagonist", title: "主角", order: 1 }],
        characters: [],
        volumes: [{ id: "volume_prompt", title: "第一卷", order: 1 }],
        arcs: [],
        chapterCards: [],
        committedThroughChapterId: null
      }
    };
    const prompt = buildEffectiveSystemPrompt("DeepWrite base", {
      runId: "run_long_prompt",
      sessionId: "session_long_prompt",
      prompt: "调整结构",
      writeApprovalMode: "auto-approve",
      longAgentProfile: profile,
      workspaceContext: { longWorkspace }
    });

    expect(prompt).toBe(profile.systemPrompt.trim());
    expect(prompt).not.toContain("DeepWrite base");
    expect(prompt).not.toContain("【当前长篇智能体");
    expect(prompt).not.toContain("【DeepWrite 长篇工具边界】");
  });

  it("keeps the long chapter-writer runtime boundary limited to novel body", () => {
    const profile = DEFAULT_LONG_AGENT_PROFILES.find(
      ({ id }) => id === "long"
    )!;
    const longWorkspace: LongWorkspaceRuntimeContext = {
      bookId: "longbook_writer_prompt",
      title: "雾港长篇",
      activeRoot: "draft",
      activeAgentId: profile.id,
      activeChapterCardId: "chapter_writer_prompt",
      navigation: {
        schemaVersion: 1,
        bookId: "longbook_writer_prompt",
        updatedAt: "2026-08-02T10:00:00.000Z",
        counts: {
          worldbuildingCategories: 0,
          characters: 0,
          volumes: 1,
          arcs: 1,
          chapterCards: 1,
          storyEvents: 0,
          storyPlots: 0,
          foreshadowingThreads: 0,
          committedChapters: 0
        },
        worldbuilding: [],
        characterTypes: [{ id: "protagonist", title: "主角", order: 1 }],
        characters: [],
        volumes: [{ id: "volume_writer_prompt", title: "第一卷", order: 1 }],
        arcs: [
          {
            id: "arc_writer_prompt",
            volumeId: "volume_writer_prompt",
            title: "主线",
            order: 1
          }
        ],
        chapterCards: [
          {
            id: "chapter_writer_prompt",
            volumeId: "volume_writer_prompt",
            primaryArcId: "arc_writer_prompt",
            title: "第一章",
            narrativeOrder: 1,
            bodyStatus: "empty"
          }
        ],
        committedThroughChapterId: null
      }
    };

    const prompt = buildEffectiveSystemPrompt("DeepWrite base", {
      runId: "run_writer_prompt",
      sessionId: "session_writer_prompt",
      prompt: "写第一章",
      longAgentProfile: profile,
      workspaceContext: { longWorkspace }
    });

    expect(prompt).toBe(profile.systemPrompt.trim());
    expect(prompt).toContain("All five stages share the same tools");
    expect(prompt).toContain(
      "The fixed context already contains the worldbuilding directory, character directory, and creative workspace structure navigation."
    );
    expect(prompt).toContain(
      "Do not request, infer, or repeat implementation details"
    );
    expect(prompt).not.toContain("必须同时形成正文");
  });

  it("lets the continuity ledger write any unrecorded chapter and catch up in one pass", () => {
    const profile = DEFAULT_LONG_AGENT_PROFILES.find(
      ({ id }) => id === "long"
    )!;
    const longWorkspace: LongWorkspaceRuntimeContext = {
      bookId: "longbook_ledger_prompt",
      title: "雾港长篇",
      activeRoot: "continuity_ledger",
      activeAgentId: profile.id,
      navigation: {
        schemaVersion: 1,
        bookId: "longbook_ledger_prompt",
        updatedAt: "2026-08-16T10:00:00.000Z",
        counts: {
          worldbuildingCategories: 0,
          characters: 0,
          volumes: 1,
          arcs: 0,
          chapterCards: 0,
          storyEvents: 0,
          storyPlots: 0,
          foreshadowingThreads: 0,
          committedChapters: 0
        },
        worldbuilding: [],
        characterTypes: [{ id: "protagonist", title: "主角", order: 1 }],
        characters: [],
        volumes: [{ id: "volume_ledger_prompt", title: "第一卷", order: 1 }],
        arcs: [],
        chapterCards: [],
        committedThroughChapterId: null
      }
    };

    const prompt = buildEffectiveSystemPrompt("DeepWrite base", {
      runId: "run_ledger_prompt",
      sessionId: "session_ledger_prompt",
      prompt: "批量提交所有未提交章节",
      longAgentProfile: profile,
      workspaceContext: { longWorkspace }
    });

    expect(prompt).toContain("propose_continuity_commit");
    expect(prompt).toContain(
      "The foreshadowing overview is the design source."
    );
  });
});
