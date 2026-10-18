import type { LongWorkspaceRuntimeContext } from "./index.test-support";
import {
  DEFAULT_LONG_AGENT_PROFILES,
  PiAgentRuntimeAdapter,
  buildEffectiveSystemPrompt,
  buildRuntimeUserPrompt,
  describe,
  expect,
  it
} from "./index.test-support";

describe("creation context refresh", () => {
  it("injects plot structure navigation and refreshes the plot position on every turn", async () => {
    const profile = DEFAULT_LONG_AGENT_PROFILES.find(
      ({ id }) => id === "long"
    )!;
    const navigation = {
      schemaVersion: 1 as const,
      bookId: "longbook_plot_prompt",
      updatedAt: "2026-07-26T10:00:00.000Z",
      counts: {
        worldbuildingCategories: 1,
        characters: 1,
        volumes: 2,
        arcs: 3,
        chapterCards: 1,
        storyEvents: 0,
        storyPlots: 2,
        foreshadowingThreads: 1,
        committedChapters: 1
      },
      worldbuilding: [
        {
          id: "world_rules",
          title: "世界规则",
          order: 1,
          format: "text" as const
        }
      ],
      characterTypes: [{ id: "protagonist", title: "主角", order: 1 }],
      characters: [
        {
          id: "character_lan",
          name: "林岚",
          group: "protagonist",
          order: 1
        }
      ],
      volumes: [
        { id: "volume_plot_a", title: "起势", order: 1 },
        { id: "volume_plot_b", title: "转折", order: 2 }
      ],
      arcs: [
        {
          id: "arc_plot_main",
          volumeId: "volume_plot_a",
          title: "主线",
          order: 1
        },
        {
          id: "arc_plot_hidden",
          volumeId: "volume_plot_a",
          title: "暗线",
          order: 2
        },
        {
          id: "arc_plot_turn",
          volumeId: "volume_plot_b",
          title: "反击",
          order: 1
        }
      ],
      chapterCards: [
        {
          id: "chapter_plot_one",
          volumeId: "volume_plot_a",
          primaryArcId: "arc_plot_main",
          title: "第一章",
          narrativeOrder: 1,
          bodyStatus: "written" as const
        }
      ],
      committedThroughChapterId: "chapter_plot_one"
    };
    const longWorkspace: LongWorkspaceRuntimeContext = {
      bookId: "longbook_plot_prompt",
      title: "雾港长篇",
      activeRoot: "plot_design",
      activeAgentId: profile.id,
      activeFileId: "file_long-book-line",
      agentsMd: "# 长篇上下文\n\n## 剧情点阶段\n维护结构。",
      worldbuildingDirectory: {
        categories: [
          {
            categoryId: "world_rules",
            title: "世界规则",
            order: 1,
            format: "text"
          },
          {
            categoryId: "world_factions",
            title: "势力",
            order: 2,
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
      navigation,
      plotFocus: {
        section: "plot_point",
        volumeId: "volume_plot_a",
        volumeTitle: "起势",
        arcId: "arc_plot_main",
        arcTitle: "主线"
      }
    };
    const input = {
      runId: "run_plot_prompt",
      sessionId: "session_plot_prompt",
      prompt: "梳理这一卷的节奏",
      longAgentProfile: profile,
      workspaceContext: { longWorkspace }
    };

    const userPrompt = buildRuntimeUserPrompt(input);
    const systemPrompt = buildEffectiveSystemPrompt("DeepWrite base", input);
    expect(systemPrompt).toContain("propose_continuity_commit");
    expect(systemPrompt).toContain("book_line");
    expect(systemPrompt).toBe(profile.systemPrompt.trim());
    expect(systemPrompt).toContain(
      "The fixed context already contains the worldbuilding directory, character directory, and creative workspace structure navigation."
    );
    expect(systemPrompt).toContain(
      "Do not request, infer, or repeat implementation details"
    );
    expect(userPrompt).toContain(
      "全书共 2 卷、3 个剧情点、1 张章卡、2 条故事情节、0 个故事事件、1 条伏笔线"
    );
    expect(userPrompt).toContain(
      "连续性记录：1 章；最高连续记录位置为「第一章」(chapter_plot_one)"
    );
    expect(userPrompt).toContain("【list 范围规则】");
    expect(userPrompt).toContain("叶子不要 list，直接 read");
    expect(userPrompt).toContain(
      "查连续性：list（stage=continuity, scope_id=<volume_id|chapter_id|character_id>）"
    );
    expect(userPrompt).toContain("不要对 arc_ 使用 continuity");
    expect(userPrompt).toContain("记录只作参考，不锁定正文或结构");
    expect(userPrompt).toContain("【章卡目录（由早到晚；共 1 张）】");
    expect(userPrompt).toContain(
      "1. 「第一章」(chapter_plot_one)；分卷=第 1 卷「起势」(volume_plot_a)；卷内顺序=1；主剧情点=「主线」(arc_plot_main)；正文=已写"
    );
    expect(userPrompt).toContain(
      "- 第 1 卷「起势」(volume_plot_a): 「主线」(arc_plot_main)、「暗线」(arc_plot_hidden)"
    );
    expect(userPrompt).toContain(
      "- 第 2 卷「转折」(volume_plot_b): 「反击」(arc_plot_turn)"
    );
    expect(userPrompt).toContain(
      "当前剧情工作区: 剧情点「主线」(arc_plot_main)，所属分卷「起势」(volume_plot_a)"
    );
    expect(userPrompt).toContain("【世界观条目列表（发送时快照）】");
    expect(userPrompt).toContain(
      "世界规则（category_id=world_rules；类型=文本）"
    );
    expect(userPrompt).toContain(
      "守夜人（item_id=worlditem_watchers；顺序=1）"
    );
    expect(userPrompt).toContain("【人物设计列表（发送时快照）】");
    expect(userPrompt).toContain(
      "【创作结构导航（发送时快照；条目正文与最新内容请通过工具读取）】"
    );
    expect(userPrompt).not.toContain("【当前阶段信息与要求】");
    expect(userPrompt.indexOf("【人物设计列表（发送时快照）】")).toBeLessThan(
      userPrompt.indexOf(
        "【创作结构导航（发送时快照；条目正文与最新内容请通过工具读取）】"
      )
    );
    expect(userPrompt).toContain("主角（type_id=protagonist；共 1 人）");
    expect(userPrompt).toContain("林岚（id=character_lan；顺序=1）");
    expect(userPrompt).not.toContain("session_plot_prompt");
    expect(userPrompt).not.toContain("run_plot_prompt");
    expect(userPrompt).not.toContain("当前根节点:");
    expect(userPrompt).not.toContain("当前文件:");
    expect(userPrompt).not.toContain("file_long-book-line");
    expect(userPrompt).not.toContain("当前用户所处的世界观阶段");
    expect(userPrompt).not.toContain("当前用户所处的人物阶段");

    const chapterCardPrompt = buildRuntimeUserPrompt({
      ...input,
      workspaceContext: {
        longWorkspace: {
          ...longWorkspace,
          activeChapterCardId: "chapter_plot_one",
          plotFocus: {
            section: "chapter_card",
            volumeId: "volume_plot_a",
            volumeTitle: "起势",
            chapterCardId: "chapter_plot_one",
            chapterCardTitle: "第一章"
          }
        }
      }
    });
    expect(chapterCardPrompt).toContain(
      "当前剧情工作区: 章卡「第一章」(chapter_plot_one)，所属分卷「起势」(volume_plot_a)"
    );

    const bookLinePrompt = buildRuntimeUserPrompt({
      ...input,
      workspaceContext: {
        longWorkspace: {
          ...longWorkspace,
          plotFocus: { section: "book_line" }
        }
      }
    });
    expect(bookLinePrompt).toContain("当前剧情工作区: 全书故事线");
    expect(bookLinePrompt).not.toContain("当前文件:");
    expect(bookLinePrompt).not.toContain("file_long-book-line");

    const draftProfile = DEFAULT_LONG_AGENT_PROFILES.find(
      ({ id }) => id === "long"
    )!;
    const draftPrompt = buildRuntimeUserPrompt({
      ...input,
      longAgentProfile: draftProfile,
      workspaceContext: {
        longWorkspace: {
          ...longWorkspace,
          activeRoot: "draft",
          activeAgentId: "long",
          plotFocus: undefined
        }
      }
    });
    expect(draftPrompt).toContain("【世界观条目列表（发送时快照）】");
    expect(draftPrompt).toContain("【人物设计列表（发送时快照）】");
    expect(draftPrompt).toContain(
      "【创作结构导航（发送时快照；条目正文与最新内容请通过工具读取）】"
    );
    expect(draftPrompt).toContain(
      "世界规则（category_id=world_rules；类型=文本）"
    );
    expect(draftPrompt).toContain("林岚（id=character_lan；顺序=1）");
    expect(draftPrompt).not.toContain("当前剧情工作区");
    expect(draftPrompt).not.toContain("session_plot_prompt");
    expect(draftPrompt).not.toContain("run_plot_prompt");
    expect(draftPrompt).not.toContain("当前根节点:");
    expect(draftPrompt).not.toContain("当前文件:");

    const runtime = new PiAgentRuntimeAdapter({ tokensPerSecond: 0 });
    const turnContexts: LongWorkspaceRuntimeContext[] = [
      {
        ...longWorkspace,
        plotFocus: { section: "book_line" }
      },
      {
        ...longWorkspace,
        navigation: {
          ...navigation,
          updatedAt: "2026-07-26T10:01:00.000Z"
        },
        plotFocus: {
          section: "plot_point",
          volumeId: "volume_plot_a",
          volumeTitle: "起势",
          arcId: "arc_plot_hidden",
          arcTitle: "暗线"
        }
      },
      {
        ...longWorkspace,
        activeChapterCardId: "chapter_plot_one",
        navigation: {
          ...navigation,
          updatedAt: "2026-07-26T10:02:00.000Z"
        },
        plotFocus: {
          section: "chapter_card",
          volumeId: "volume_plot_a",
          volumeTitle: "起势",
          chapterCardId: "chapter_plot_one",
          chapterCardTitle: "第一章"
        }
      }
    ];
    for (const [turnIndex, context] of turnContexts.entries()) {
      for await (const _event of runtime.start({
        runId: `run_plot_turn_${turnIndex}`,
        sessionId: "session_plot_turns",
        prompt: `剧情请求 ${turnIndex + 1}`,
        thinkingLevel: "off",
        longAgentProfile: profile,
        workspaceContext: { longWorkspace: context }
      })) {
        // Consume every turn before inspecting the cached model transcript.
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
      "session_plot_turns:long:long:longbook_plot_prompt"
    );
    const userMessages = agent?.state.messages.filter(
      (message) => message.role === "user"
    );
    expect(userMessages).toHaveLength(3);
    expect(String(userMessages?.[0]?.content)).toContain(
      "【本次智能体会话固定上下文】"
    );
    expect(String(userMessages?.[0]?.content)).toContain(
      "当前剧情工作区: 全书故事线"
    );
    expect(String(userMessages?.[0]?.content)).not.toContain(
      "session_plot_turns"
    );
    expect(String(userMessages?.[0]?.content)).not.toContain("当前文件:");
    expect(String(userMessages?.[0]?.content)).not.toContain(
      "file_long-book-line"
    );
    expect(String(userMessages?.[0]?.content)).toContain(
      "【世界观条目列表（发送时快照）】"
    );
    expect(String(userMessages?.[0]?.content)).toContain(
      "【人物设计列表（发送时快照）】"
    );
    expect(String(userMessages?.[1]?.content)).toContain(
      "【本轮创作工作区上下文】"
    );
    expect(String(userMessages?.[1]?.content)).toContain(
      "【创作结构导航（本轮发送时快照；条目正文与最新内容请通过工具读取）】"
    );
    expect(String(userMessages?.[1]?.content)).toContain(
      "【创作上下文（AGENTS.md）】"
    );
    expect(String(userMessages?.[1]?.content)).not.toContain(
      "【世界观条目列表"
    );
    expect(String(userMessages?.[1]?.content)).not.toContain("【人物设计列表");
    expect(String(userMessages?.[1]?.content)).toContain(
      "【世界观分类入口（本轮发送时快照）】"
    );
    expect(String(userMessages?.[1]?.content)).toContain(
      "【人物类型入口（本轮发送时快照）】"
    );
    expect(String(userMessages?.[1]?.content)).toContain("【list 范围规则】");
    expect(String(userMessages?.[1]?.content)).toContain(
      "连续性不要传 arc_ 或 book_line"
    );
    expect(String(userMessages?.[1]?.content)).toContain(
      "世界规则（category_id=world_rules；类型=文本）"
    );
    expect(String(userMessages?.[1]?.content)).toContain(
      "主角（type_id=protagonist；共 1 人）"
    );
    expect(String(userMessages?.[1]?.content)).toContain(
      "当前剧情工作区: 剧情点「暗线」(arc_plot_hidden)"
    );
    expect(String(userMessages?.[1]?.content)).not.toContain("当前文件:");
    expect(String(userMessages?.[1]?.content)).not.toContain(
      "file_long-book-line"
    );
    expect(String(userMessages?.[1]?.content)).not.toContain("当前根节点:");
    expect(String(userMessages?.[2]?.content)).toContain(
      "当前章卡: chapter_plot_one"
    );
    expect(String(userMessages?.[2]?.content)).toContain(
      "当前剧情工作区: 章卡「第一章」(chapter_plot_one)"
    );
    expect(String(userMessages?.[2]?.content)).not.toContain("当前文件:");
  });

  it("injects design directories for the chapter writer and refreshes plot navigation later", async () => {
    const profile = DEFAULT_LONG_AGENT_PROFILES.find(
      ({ id }) => id === "long"
    )!;
    const navigation = {
      schemaVersion: 1 as const,
      bookId: "longbook_draft_prompt",
      updatedAt: "2026-07-26T10:00:00.000Z",
      counts: {
        worldbuildingCategories: 1,
        characters: 1,
        volumes: 1,
        arcs: 1,
        chapterCards: 1,
        storyEvents: 0,
        storyPlots: 0,
        foreshadowingThreads: 0,
        committedChapters: 0
      },
      worldbuilding: [
        {
          id: "world_rules",
          title: "世界规则",
          order: 1,
          format: "text" as const
        }
      ],
      characterTypes: [{ id: "protagonist", title: "主角", order: 1 }],
      characters: [
        {
          id: "character_lan",
          name: "林岚",
          group: "protagonist",
          order: 1
        }
      ],
      volumes: [{ id: "volume_draft_a", title: "起势", order: 1 }],
      arcs: [
        {
          id: "arc_draft_main",
          volumeId: "volume_draft_a",
          title: "主线",
          order: 1
        }
      ],
      chapterCards: [
        {
          id: "chapter_draft_one",
          volumeId: "volume_draft_a",
          primaryArcId: "arc_draft_main",
          title: "第一章",
          narrativeOrder: 1,
          bodyStatus: "empty" as const
        }
      ],
      committedThroughChapterId: null
    };
    const longWorkspace: LongWorkspaceRuntimeContext = {
      bookId: "longbook_draft_prompt",
      title: "雾港长篇",
      activeRoot: "draft",
      activeAgentId: profile.id,
      activeChapterCardId: "chapter_draft_one",
      agentsMd: "# 长篇上下文\n\n## 正文阶段\n按章写作。",
      worldbuildingDirectory: {
        categories: [
          {
            categoryId: "world_rules",
            title: "世界规则",
            order: 1,
            format: "text"
          }
        ],
        omittedCategoryCount: 0
      },
      navigation
    };
    const runtime = new PiAgentRuntimeAdapter({ tokensPerSecond: 0 });
    for (const [turnIndex, context] of [
      longWorkspace,
      {
        ...longWorkspace,
        navigation: {
          ...navigation,
          updatedAt: "2026-07-26T10:01:00.000Z"
        }
      }
    ].entries()) {
      for await (const _event of runtime.start({
        runId: `run_draft_turn_${turnIndex}`,
        sessionId: "session_draft_turns",
        prompt: `写手请求 ${turnIndex + 1}`,
        thinkingLevel: "off",
        longAgentProfile: profile,
        workspaceContext: { longWorkspace: context }
      })) {
        // Consume every turn before inspecting the cached model transcript.
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
      "session_draft_turns:long:long:longbook_draft_prompt"
    );
    const userMessages = agent?.state.messages.filter(
      (message) => message.role === "user"
    );
    expect(userMessages).toHaveLength(2);
    expect(String(userMessages?.[0]?.content)).toContain(
      "【本次智能体会话固定上下文】"
    );
    expect(String(userMessages?.[0]?.content)).toContain(
      "【世界观条目列表（发送时快照）】"
    );
    expect(String(userMessages?.[0]?.content)).toContain(
      "【人物设计列表（发送时快照）】"
    );
    expect(String(userMessages?.[0]?.content)).toContain(
      "【创作结构导航（发送时快照；条目正文与最新内容请通过工具读取）】"
    );
    expect(String(userMessages?.[0]?.content)).toContain(
      "正文进度：已写 0 章，空白 1 章。"
    );
    expect(String(userMessages?.[0]?.content)).toContain(
      "【章卡目录（由早到晚；共 1 张）】"
    );
    expect(String(userMessages?.[0]?.content)).toContain(
      "1. 「第一章」(chapter_draft_one)；分卷=第 1 卷「起势」(volume_draft_a)；卷内顺序=1；主剧情点=「主线」(arc_draft_main)；正文=空白；当前章=是"
    );
    expect(String(userMessages?.[1]?.content)).toContain(
      "【本轮创作工作区上下文】"
    );
    expect(String(userMessages?.[1]?.content)).toContain(
      "【创作结构导航（本轮发送时快照；条目正文与最新内容请通过工具读取）】"
    );
    expect(String(userMessages?.[1]?.content)).toContain(
      "当前章卡: chapter_draft_one"
    );
    expect(String(userMessages?.[1]?.content)).toContain(
      "1. 「第一章」(chapter_draft_one)；分卷=第 1 卷「起势」(volume_draft_a)；卷内顺序=1；主剧情点=「主线」(arc_draft_main)；正文=空白；当前章=是"
    );
    expect(String(userMessages?.[1]?.content)).not.toContain(
      "【世界观条目列表"
    );
    expect(String(userMessages?.[1]?.content)).not.toContain("【人物设计列表");
    expect(String(userMessages?.[1]?.content)).toContain(
      "【世界观分类入口（本轮发送时快照）】"
    );
    expect(String(userMessages?.[1]?.content)).toContain(
      "【人物类型入口（本轮发送时快照）】"
    );
    expect(String(userMessages?.[1]?.content)).toContain("【list 范围规则】");
    expect(String(userMessages?.[1]?.content)).not.toContain("当前剧情工作区");
  });
});
