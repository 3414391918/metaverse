import type {
  AgentRuntimeEvent,
  LongWorkspaceRuntimeContext
} from "./index.test-support";
import {
  DEFAULT_LIBRARY_AGENT_PROFILES,
  createShortWorkspaceContentRevision,
  buildRuntimeUserPrompt,
  DEFAULT_LONG_AGENT_PROFILES,
  PiAgentRuntimeAdapter,
  describe,
  expect,
  it
} from "./index.test-support";

describe("runtime conversation history and current contexts", () => {
  it("does not emit thinking when thinking is disabled", async () => {
    const runtime = new PiAgentRuntimeAdapter({ tokensPerSecond: 0 });
    const events: AgentRuntimeEvent[] = [];

    for await (const event of runtime.start({
      runId: "run_no_thinking",
      sessionId: "session_no_thinking",
      prompt: "只验证回复流",
      thinkingLevel: "off"
    })) {
      events.push(event);
    }

    expect(events.some((event) => event.type === "agent.thinking_delta")).toBe(
      false
    );
    expect(
      events.filter((event) => event.type === "agent.completed")
    ).toHaveLength(1);
  });

  it("permanently injects context only into the first user message", async () => {
    const runtime = new PiAgentRuntimeAdapter({ tokensPerSecond: 0 });

    for (const [index, prompt] of ["先检查人物", "再检查剧情"].entries()) {
      for await (const _event of runtime.start({
        runId: `run_history_${index}`,
        sessionId: "session_history",
        prompt,
        thinkingLevel: "off",
        workspaceContext: {
          activeResource: {
            id: "chapter_history",
            domain: "creation",
            title: "历史测试",
            path: ["历史测试"],
            source: "live-editor",
            content: `第 ${index + 1} 轮快照`
          }
        }
      })) {
        // Consume the complete run before inspecting the cached transcript.
      }
    }

    const cache = (
      runtime as unknown as {
        conversationAgents: Map<
          string,
          { state: { messages: Array<{ role?: string; content?: unknown }> } }
        >;
      }
    ).conversationAgents;
    const agent = cache.get("session_history:default");
    const userMessages = agent?.state.messages.filter(
      (message) => message.role === "user"
    );

    expect(userMessages).toHaveLength(2);
    expect(String(userMessages?.[0]?.content)).toContain(
      "【本次智能体会话固定上下文】"
    );
    expect(String(userMessages?.[0]?.content)).toContain(
      "实时内容:\n第 1 轮快照"
    );
    expect(String(userMessages?.[0]?.content)).toContain("先检查人物");
    expect(userMessages?.[1]?.content).toBe("再检查剧情");
    expect(String(userMessages?.[0]?.content)).not.toContain("run_history_1");
  });

  it("restores persisted conversation history only when rebuilding an agent", async () => {
    const runtime = new PiAgentRuntimeAdapter({ tokensPerSecond: 0 });
    const history = [
      {
        role: "user" as const,
        content: "先帮我规划一段雨夜相遇。",
        createdAt: "2026-08-17T07:58:00.000Z"
      },
      {
        role: "assistant" as const,
        content: "可以从旧站台的一封错投来信开始。",
        createdAt: "2026-08-17T07:59:00.000Z"
      }
    ];

    for await (const _event of runtime.start({
      runId: "run_restored_history_1",
      sessionId: "session_restored_history",
      prompt: "我上边说了啥？",
      conversationHistory: history,
      thinkingLevel: "off"
    })) {
      // Consume the rebuilt conversation turn.
    }

    for await (const _event of runtime.start({
      runId: "run_restored_history_2",
      sessionId: "session_restored_history",
      prompt: "继续",
      conversationHistory: [
        {
          role: "user",
          content: "这条历史不应重复灌入",
          createdAt: "2026-08-17T08:01:00.000Z"
        }
      ],
      thinkingLevel: "off"
    })) {
      // Consume a normal follow-up turn on the same in-memory agent.
    }

    const cache = (
      runtime as unknown as {
        conversationAgents: Map<
          string,
          { state: { messages: Array<{ role?: string; content?: unknown }> } }
        >;
      }
    ).conversationAgents;
    const messages = cache.get("session_restored_history:default")?.state
      .messages;

    expect(messages?.map((message) => message.role)).toEqual([
      "user",
      "assistant",
      "user",
      "assistant",
      "user",
      "assistant"
    ]);
    expect(String(messages?.[0]?.content)).toBe("先帮我规划一段雨夜相遇。");
    expect(JSON.stringify(messages)).toContain(
      "可以从旧站台的一封错投来信开始。"
    );
    expect(JSON.stringify(messages)).not.toContain("这条历史不应重复灌入");
  });

  it("replaces a cached conversation agent with the supplied history", async () => {
    const runtime = new PiAgentRuntimeAdapter({ tokensPerSecond: 0 });

    for await (const _event of runtime.start({
      runId: "run_history_before_replace",
      sessionId: "session_history_replace",
      prompt: "这轮内容稍后应被舍弃",
      thinkingLevel: "off"
    })) {
      // Populate the cached conversation agent.
    }

    for await (const _event of runtime.start({
      runId: "run_history_replace",
      sessionId: "session_history_replace",
      prompt: "修改后的问题",
      conversationHistory: [
        {
          role: "user",
          content: "保留的问题",
          createdAt: "2026-08-25T10:00:00.000Z"
        },
        {
          role: "assistant",
          content: "保留的回答",
          createdAt: "2026-08-25T10:01:00.000Z"
        }
      ],
      conversationHistoryMode: "replace",
      thinkingLevel: "off"
    })) {
      // Consume the replacement turn.
    }

    const cache = (
      runtime as unknown as {
        conversationAgents: Map<
          string,
          { state: { messages: Array<{ role?: string; content?: unknown }> } }
        >;
      }
    ).conversationAgents;
    const messages = cache.get("session_history_replace:default")?.state
      .messages;

    expect(messages?.map((message) => message.role)).toEqual([
      "user",
      "assistant",
      "user",
      "assistant"
    ]);
    expect(JSON.stringify(messages)).toContain("保留的问题");
    expect(JSON.stringify(messages)).toContain("修改后的问题");
    expect(JSON.stringify(messages)).not.toContain("这轮内容稍后应被舍弃");

    for await (const _event of runtime.start({
      runId: "run_history_replace_empty",
      sessionId: "session_history_replace",
      prompt: "从第一条重新开始",
      conversationHistoryMode: "replace",
      thinkingLevel: "off"
    })) {
      // Consume an empty-prefix replacement turn.
    }

    const resetMessages = cache.get("session_history_replace:default")?.state
      .messages;
    expect(resetMessages?.map((message) => message.role)).toEqual([
      "user",
      "assistant"
    ]);
    expect(JSON.stringify(resetMessages)).toContain("从第一条重新开始");
    expect(JSON.stringify(resetMessages)).not.toContain("保留的问题");
  });

  it("permanently injects worldbuilding context only into the first user message", async () => {
    const profile = DEFAULT_LONG_AGENT_PROFILES.find(
      ({ id }) => id === "long"
    )!;
    const longWorkspace: LongWorkspaceRuntimeContext = {
      bookId: "longbook_world_history",
      title: "雾港长篇",
      activeRoot: "worldbuilding",
      activeAgentId: profile.id,
      activeFileId: "file_faction_watch:content",
      worldbuildingDirectory: {
        categories: [
          {
            categoryId: "world_factions",
            title: "势力",
            order: 1,
            format: "list",
            itemCount: 1,
            items: [
              {
                itemId: "worlditem_watchers",
                title: "守夜人",
                order: 1
              }
            ],
            omittedItemCount: 0
          }
        ],
        omittedCategoryCount: 0
      },
      worldbuildingFocus: {
        categoryTitle: "势力",
        format: "list",
        currentStage: {
          kind: "item",
          title: "守夜人",
          text: { content: "守夜人负责执行宵禁。" }
        },
        overview: { content: "各势力争夺港务权。" }
      },
      navigation: {
        schemaVersion: 1,
        bookId: "longbook_world_history",
        updatedAt: "2026-07-30T10:00:00.000Z",
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
        volumes: [{ id: "volume_world_history", title: "第一卷", order: 1 }],
        arcs: [],
        chapterCards: [],
        committedThroughChapterId: null
      }
    };
    const runtime = new PiAgentRuntimeAdapter({ tokensPerSecond: 0 });

    for (const [index, prompt] of [
      "先检查世界规则",
      "再补充力量体系"
    ].entries()) {
      for await (const _event of runtime.start({
        runId: `run_world_history_${index}`,
        sessionId: "session_world_history",
        prompt,
        thinkingLevel: "off",
        longAgentProfile: profile,
        workspaceContext: { longWorkspace }
      })) {
        // Consume both turns before inspecting the cache-stable transcript.
      }
    }

    const cache = (
      runtime as unknown as {
        conversationAgents: Map<
          string,
          { state: { messages: Array<{ role?: string; content?: unknown }> } }
        >;
      }
    ).conversationAgents;
    const agent = cache.get(
      "session_world_history:long:long:longbook_world_history"
    );
    const userMessages = agent?.state.messages.filter(
      (message) => message.role === "user"
    );

    expect(userMessages).toHaveLength(2);
    expect(String(userMessages?.[0]?.content)).toContain(
      "【本次智能体会话固定上下文】"
    );
    expect(String(userMessages?.[0]?.content)).toContain(
      "创作作品: 《雾港长篇》"
    );
    expect(String(userMessages?.[0]?.content)).toContain(
      "势力（category_id=world_factions；类型=条目列表；共 1 项）"
    );
    expect(String(userMessages?.[0]?.content)).toContain(
      "守夜人（item_id=worlditem_watchers；顺序=1）"
    );
    expect(String(userMessages?.[0]?.content)).toContain(
      "当前用户所处的世界观阶段: 列表型分类「势力」 / 条目「守夜人」（category_id=world_factions；item_id=worlditem_watchers）"
    );
    expect(String(userMessages?.[0]?.content)).toContain(
      "当前阶段简要信息: 仅定位当前页面，正文未注入"
    );
    expect(String(userMessages?.[0]?.content)).toContain(
      "【当前阶段信息与要求】"
    );
    expect(String(userMessages?.[0]?.content)).toContain(
      "【创作结构导航（发送时快照；条目正文与最新内容请通过工具读取）】"
    );
    expect(String(userMessages?.[0]?.content)).toContain(
      "全书共 1 卷、0 个剧情点、0 张章卡、0 条故事情节、0 个故事事件、0 条伏笔线"
    );
    expect(String(userMessages?.[0]?.content)).not.toContain("当前剧情工作区");
    expect(String(userMessages?.[0]?.content)).not.toContain(
      "各势力争夺港务权。"
    );
    expect(String(userMessages?.[0]?.content)).not.toContain(
      "守夜人负责执行宵禁。"
    );
    expect(String(userMessages?.[0]?.content)).toContain("先检查世界规则");
    expect(userMessages?.[1]?.content).toContain("再补充力量体系");
  });
  it("assembles only the active library tools and keeps entry bodies out of the prompt", async () => {
    const profile = DEFAULT_LIBRARY_AGENT_PROFILES.find(
      ({ domain }) => domain === "material"
    )!;
    const entryBody = "DO_NOT_INLINE_LIBRARY_BODY_7d9d";
    const input = {
      runId: "run_library",
      sessionId: "session_library",
      prompt: "整理这个素材库",
      thinkingLevel: "off" as const,
      libraryAgentProfile: profile,
      workspaceContext: {
        activeResource: {
          id: "material-document-1",
          domain: "material" as const,
          title: "雨夜人物",
          path: ["人物素材", "雨夜人物"],
          source: "live-editor" as const,
          content: entryBody
        },
        libraryWorkspace: {
          domain: "material" as const,
          libraryId: "material-library-1",
          title: "人物素材",
          libraryType: "short" as const,
          kind: "character" as const,
          overviewDocumentId: "material-overview-1",
          overview: "仅用于都市悬疑人物",
          overviewRevision:
            createShortWorkspaceContentRevision("仅用于都市悬疑人物"),
          readOnly: false,
          activeEntryId: "material-entry-1",
          projectRevision: 2,
          entries: [
            {
              id: "material-entry-1",
              documentId: "material-document-1",
              stageId: "character" as const,
              title: "雨夜人物",
              content: entryBody,
              revision: createShortWorkspaceContentRevision(entryBody),
              readOnly: false
            }
          ]
        }
      }
    };

    const prompt = buildRuntimeUserPrompt(input);
    expect(prompt).toContain("雨夜人物 (material-entry-1)");
    expect(prompt).toContain("仅用于都市悬疑人物");
    expect(prompt).not.toContain(entryBody);

    const runtime = new PiAgentRuntimeAdapter({ tokensPerSecond: 0 });
    for await (const _event of runtime.start(input)) {
      // Consume the local run before inspecting its domain-scoped agent.
    }
    for await (const _event of runtime.start({
      ...input,
      runId: "run_library_followup",
      prompt: "继续整理人物关系"
    })) {
      // Consume the follow-up turn to verify the stable library prefix.
    }
    const cache = (
      runtime as unknown as {
        conversationAgents: Map<
          string,
          {
            state: {
              tools: Array<{ name: string }>;
              systemPrompt: string;
              messages: Array<{ role?: string; content?: unknown }>;
            };
          }
        >;
      }
    ).conversationAgents;
    const agent = cache.get(
      "session_library:library:material:material-library-1"
    );
    expect(agent?.state.tools.map(({ name }) => name)).toEqual([
      "list_material_entries",
      "read_material_entry",
      "search_material_entries",
      "load_skill",
      "create_material_entry",
      "edit_material_entry",
      "edit_material_library_overview"
    ]);
    expect(agent?.state.systemPrompt).toContain("素材库管理智能体");
    const userMessages = agent?.state.messages.filter(
      (message) => message.role === "user"
    );
    expect(userMessages).toHaveLength(2);
    expect(String(userMessages?.[0]?.content)).toContain(
      "【本次智能体会话固定上下文】"
    );
    expect(String(userMessages?.[0]?.content)).toContain(
      "当前资料库: 《人物素材》"
    );
    expect(userMessages?.[1]?.content).toBe("继续整理人物关系");
  });
});
