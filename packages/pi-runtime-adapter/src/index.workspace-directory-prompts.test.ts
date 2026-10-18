import type { LongWorkspaceRuntimeContext } from "./index.test-support";
import {
  DEFAULT_LONG_AGENT_PROFILES,
  buildEffectiveSystemPrompt,
  buildRuntimeUserPrompt,
  describe,
  expect,
  it
} from "./index.test-support";

describe("creation directory prompts", () => {
  it("keeps worldbuilding prompts on business ids and hides file controls", () => {
    const profile = DEFAULT_LONG_AGENT_PROFILES.find(
      ({ id }) => id === "long"
    )!;
    const longWorkspace: LongWorkspaceRuntimeContext = {
      bookId: "longbook_world_prompt",
      title: "雾港长篇",
      activeRoot: "worldbuilding",
      activeAgentId: profile.id,
      activeFileId: "file_world_rules:content",
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
            itemCount: 2,
            items: [
              {
                itemId: "worlditem_watchers",
                title: "守夜人",
                order: 1
              },
              {
                itemId: "worlditem_harbor",
                title: "港务会",
                order: 2
              }
            ],
            omittedItemCount: 0
          }
        ],
        omittedCategoryCount: 0
      },
      worldbuildingFocus: {
        categoryTitle: "世界规则",
        format: "text",
        currentStage: {
          kind: "text",
          title: "世界规则",
          text: { content: "雾潮期间禁止点燃蓝焰。" }
        }
      },
      navigation: {
        schemaVersion: 1,
        bookId: "longbook_world_prompt",
        updatedAt: "2026-07-26T10:00:00.000Z",
        counts: {
          worldbuildingCategories: 1,
          characters: 0,
          volumes: 1,
          arcs: 0,
          chapterCards: 0,
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
            format: "text"
          }
        ],
        characterTypes: [{ id: "protagonist", title: "主角", order: 1 }],
        characters: [],
        volumes: [{ id: "volume_world_prompt", title: "第一卷", order: 1 }],
        arcs: [],
        chapterCards: [],
        committedThroughChapterId: null
      }
    };
    const input = {
      runId: "run_world_prompt",
      sessionId: "session_world_prompt",
      prompt: "核对世界规则",
      longAgentProfile: profile,
      workspaceContext: { longWorkspace }
    };

    const systemPrompt = buildEffectiveSystemPrompt("DeepWrite base", input);
    expect(systemPrompt).toBe(profile.systemPrompt.trim());
    expect(systemPrompt).toContain("All five stages share the same tools");
    expect(systemPrompt).toContain("list");
    expect(systemPrompt).toContain(
      "Do not request, infer, or repeat implementation details"
    );
    expect(systemPrompt).not.toContain("bookId");
    expect(systemPrompt).not.toContain(" / worldbuilding");
    expect(systemPrompt).toContain(
      "The fixed context already contains the worldbuilding directory, character directory, and creative workspace structure navigation."
    );
    expect(systemPrompt).toContain(
      "worldbuilding categories and character types"
    );

    const userPrompt = buildRuntimeUserPrompt(input);
    expect(userPrompt).toContain("创作作品: 《雾港长篇》");
    expect(userPrompt).toContain("【世界观条目列表（发送时快照）】");
    expect(userPrompt).toContain("【人物设计列表（发送时快照）】");
    expect(userPrompt).toContain(
      "【创作结构导航（发送时快照；条目正文与最新内容请通过工具读取）】"
    );
    expect(userPrompt).toContain("【当前阶段信息与要求】");
    expect(userPrompt.indexOf("【世界观条目列表（发送时快照）】")).toBeLessThan(
      userPrompt.indexOf("【人物设计列表（发送时快照）】")
    );
    expect(userPrompt.indexOf("【人物设计列表（发送时快照）】")).toBeLessThan(
      userPrompt.indexOf(
        "【创作结构导航（发送时快照；条目正文与最新内容请通过工具读取）】"
      )
    );
    expect(
      userPrompt.indexOf(
        "【创作结构导航（发送时快照；条目正文与最新内容请通过工具读取）】"
      )
    ).toBeLessThan(userPrompt.indexOf("【当前阶段信息与要求】"));
    expect(userPrompt).toContain(
      "全书共 1 卷、0 个剧情点、0 张章卡、0 条故事情节、0 个故事事件、0 条伏笔线"
    );
    expect(userPrompt).toContain(
      "- 第 1 卷「第一卷」(volume_world_prompt): 暂无剧情点"
    );
    expect(userPrompt).not.toContain("当前剧情工作区");
    expect(userPrompt).toContain(
      "世界规则（category_id=world_rules；类型=文本）"
    );
    expect(userPrompt).toContain(
      "势力（category_id=world_factions；类型=条目列表；共 2 项）"
    );
    expect(userPrompt).toContain(
      "守夜人（item_id=worlditem_watchers；顺序=1）"
    );
    expect(userPrompt).toContain("主角（type_id=protagonist；共 0 人）");
    expect(userPrompt).toContain("当前智能体: 主智能体");
    expect(userPrompt).toContain(
      "当前用户所处的世界观阶段: 文本型分类「世界规则」（category_id=world_rules）"
    );
    expect(userPrompt).toContain(
      "当前阶段简要信息: 仅定位当前页面，正文未注入；需要时调用 read（id=world_rules）读取。"
    );
    expect(userPrompt).not.toContain("雾潮期间禁止点燃蓝焰。");
    expect(userPrompt).not.toContain("当前阶段信息:");
    expect(userPrompt).not.toContain("当前分类概览");
    expect(userPrompt).not.toContain("另一侧人物");
    expect(userPrompt).not.toContain("当前根节点:");
    expect(userPrompt).not.toContain("(worldbuilding)");
    expect(userPrompt).not.toContain("longbook_world_prompt");
    expect(userPrompt).not.toContain("file_world_rules:content");
    expect(userPrompt).not.toContain("v1:0:00000000");
    expect(userPrompt).not.toContain("session_world_prompt");
    expect(userPrompt).not.toContain("run_world_prompt");

    const listPrompt = buildRuntimeUserPrompt({
      ...input,
      workspaceContext: {
        longWorkspace: {
          ...longWorkspace,
          worldbuildingFocus: {
            categoryTitle: "势力",
            format: "list",
            currentStage: {
              kind: "item",
              title: "守夜人",
              text: { content: "守夜人负责执行宵禁。" }
            },
            overview: { content: "各势力争夺港务权。" }
          }
        }
      }
    });
    expect(listPrompt).toContain(
      "当前用户所处的世界观阶段: 列表型分类「势力」 / 条目「守夜人」（category_id=world_factions；item_id=worlditem_watchers）"
    );
    expect(listPrompt).toContain(
      "当前阶段简要信息: 仅定位当前页面，正文未注入；需要时调用 read（id=worlditem_watchers）读取。"
    );
    expect(listPrompt).not.toContain("守夜人负责执行宵禁。");
    expect(listPrompt).not.toContain("各势力争夺港务权。");
    expect(listPrompt).not.toContain("当前分类概览");
  });

  it("keeps character prompts on business ids and injects a brief focused stage", () => {
    const profile = DEFAULT_LONG_AGENT_PROFILES.find(
      ({ id }) => id === "long"
    )!;
    const longWorkspace: LongWorkspaceRuntimeContext = {
      bookId: "longbook_character_prompt",
      title: "雾港长篇",
      activeRoot: "character_design",
      activeAgentId: profile.id,
      activeFileId: "file_character_lan:relationships",
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
      characterFocus: {
        characterName: "林岚",
        group: "chartype_viewpoint",
        currentDocument: {
          kind: "relationships",
          title: "人物关系",
          text: { content: "与沈砚暂时合作。" }
        },
        coreProfile: { content: "雾港巡夜人，害怕深水。" }
      },
      navigation: {
        schemaVersion: 1,
        bookId: "longbook_character_prompt",
        updatedAt: "2026-07-26T10:00:00.000Z",
        counts: {
          worldbuildingCategories: 0,
          characters: 1,
          volumes: 1,
          arcs: 0,
          chapterCards: 0,
          storyEvents: 0,
          storyPlots: 0,
          foreshadowingThreads: 0,
          committedChapters: 0
        },
        worldbuilding: [],
        characterTypes: [
          { id: "chartype_viewpoint", title: "视角人物", order: 1 }
        ],
        characters: [
          {
            id: "character_lan",
            name: "林岚",
            group: "chartype_viewpoint",
            order: 1
          }
        ],
        volumes: [{ id: "volume_character_prompt", title: "第一卷", order: 1 }],
        arcs: [],
        chapterCards: [],
        committedThroughChapterId: null
      }
    };
    const input = {
      runId: "run_character_prompt",
      sessionId: "session_character_prompt",
      prompt: "完善人物关系",
      longAgentProfile: profile,
      workspaceContext: { longWorkspace }
    };

    const systemPrompt = buildEffectiveSystemPrompt("DeepWrite base", input);
    expect(systemPrompt).toContain("list");
    expect(systemPrompt).toContain("read");
    expect(systemPrompt).toContain(
      "Do not request, infer, or repeat implementation details"
    );
    expect(systemPrompt).toBe(profile.systemPrompt.trim());
    expect(systemPrompt).not.toContain("bookId");

    const userPrompt = buildRuntimeUserPrompt(input);
    expect(userPrompt).toContain("【世界观条目列表（发送时快照）】");
    expect(userPrompt).toContain(
      "世界规则（category_id=world_rules；类型=文本）"
    );
    expect(userPrompt).toContain("【人物设计列表（发送时快照）】");
    expect(userPrompt).toContain(
      "【创作结构导航（发送时快照；条目正文与最新内容请通过工具读取）】"
    );
    expect(userPrompt).toContain("【当前阶段信息与要求】");
    expect(userPrompt.indexOf("【人物设计列表（发送时快照）】")).toBeLessThan(
      userPrompt.indexOf(
        "【创作结构导航（发送时快照；条目正文与最新内容请通过工具读取）】"
      )
    );
    expect(
      userPrompt.indexOf(
        "【创作结构导航（发送时快照；条目正文与最新内容请通过工具读取）】"
      )
    ).toBeLessThan(userPrompt.indexOf("【当前阶段信息与要求】"));
    expect(userPrompt).toContain(
      "全书共 1 卷、0 个剧情点、0 张章卡、0 条故事情节、0 个故事事件、0 条伏笔线"
    );
    expect(userPrompt).not.toContain("当前剧情工作区");
    expect(userPrompt).toContain(
      "视角人物（type_id=chartype_viewpoint；共 1 人）"
    );
    expect(userPrompt).toContain("林岚（id=character_lan；顺序=1）");
    expect(userPrompt).toContain(
      "当前用户所处的人物阶段: 「林岚」 / 人物关系（id=character_lan；document=relationships；type_id=chartype_viewpoint）"
    );
    expect(userPrompt).toContain(
      "当前阶段简要信息: 仅定位当前人物文档，正文未注入；需要时调用 read（id=character_lan, document=relationships）读取。"
    );
    expect(userPrompt).not.toContain("与沈砚暂时合作。");
    expect(userPrompt).not.toContain("雾港巡夜人，害怕深水。");
    expect(userPrompt).not.toContain("人物核心档案:");
    expect(userPrompt).not.toContain("【人物类型目录");
    expect(userPrompt).not.toContain("另一侧世界观");
    expect(userPrompt).not.toContain("当前根节点:");
    expect(userPrompt).not.toContain("longbook_character_prompt");
    expect(userPrompt).not.toContain("file_character_lan:relationships");
    expect(userPrompt).not.toContain("session_character_prompt");
    expect(userPrompt).not.toContain("run_character_prompt");
  });

  it("caps the setting-agent character directory at 50 people per type", () => {
    const profile = DEFAULT_LONG_AGENT_PROFILES.find(
      ({ id }) => id === "long"
    )!;
    const extras = Array.from({ length: 52 }, (_, index) => ({
      id: `character_extra_${String(index + 1).padStart(2, "0")}`,
      name: `配角${index + 1}`,
      group: "supporting",
      order: index + 1
    }));
    const userPrompt = buildRuntimeUserPrompt({
      runId: "run_character_directory_cap",
      sessionId: "session_character_directory_cap",
      prompt: "补充配角",
      longAgentProfile: profile,
      workspaceContext: {
        longWorkspace: {
          bookId: "longbook_character_directory",
          title: "雾港长篇",
          activeRoot: "worldbuilding",
          activeAgentId: profile.id,
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
          navigation: {
            schemaVersion: 1,
            bookId: "longbook_character_directory",
            updatedAt: "2026-07-26T10:00:00.000Z",
            counts: {
              worldbuildingCategories: 0,
              characters: extras.length,
              volumes: 1,
              arcs: 0,
              chapterCards: 0,
              storyEvents: 0,
              storyPlots: 0,
              foreshadowingThreads: 0,
              committedChapters: 0
            },
            worldbuilding: [],
            characterTypes: [{ id: "supporting", title: "配角", order: 1 }],
            characters: extras,
            volumes: [
              { id: "volume_character_directory", title: "第一卷", order: 1 }
            ],
            arcs: [],
            chapterCards: [],
            committedThroughChapterId: null
          }
        }
      }
    });

    expect(userPrompt).toContain("【世界观条目列表（发送时快照）】");
    expect(userPrompt).toContain("【人物设计列表（发送时快照）】");
    expect(userPrompt).toContain("配角（type_id=supporting；共 52 人）");
    expect(userPrompt).toContain("配角1（id=character_extra_01；顺序=1）");
    expect(userPrompt).toContain("配角50（id=character_extra_50；顺序=50）");
    expect(userPrompt).not.toContain("character_extra_51");
    expect(userPrompt).not.toContain("配角51");
    expect(userPrompt).toContain(
      "另有 2 人未进入固定上下文，需要时调用 list（stage=character, scope_id=supporting）查询。"
    );
  });

  it("injects only the nearby chapter-card window around the active chapter", () => {
    const profile = DEFAULT_LONG_AGENT_PROFILES.find(
      ({ id }) => id === "long"
    )!;
    const chapterCards = Array.from({ length: 60 }, (_, index) => ({
      id: `chapter_window_${String(index + 1).padStart(2, "0")}`,
      volumeId: "volume_window",
      primaryArcId: "arc_window",
      title: `第${index + 1}章`,
      narrativeOrder: index + 1,
      bodyStatus: index < 59 ? ("written" as const) : ("empty" as const)
    }));
    const longWorkspace: LongWorkspaceRuntimeContext = {
      bookId: "longbook_chapter_window",
      title: "章卡窗口测试",
      activeRoot: "draft",
      activeAgentId: profile.id,
      activeChapterCardId: "chapter_window_30",
      navigation: {
        schemaVersion: 1,
        bookId: "longbook_chapter_window",
        updatedAt: "2026-08-19T00:00:00.000Z",
        counts: {
          worldbuildingCategories: 0,
          characters: 0,
          volumes: 1,
          arcs: 1,
          chapterCards: chapterCards.length,
          storyEvents: 0,
          storyPlots: 0,
          foreshadowingThreads: 0,
          committedChapters: 0
        },
        worldbuilding: [],
        characterTypes: [{ id: "protagonist", title: "主角", order: 1 }],
        characters: [],
        volumes: [{ id: "volume_window", title: "第一卷", order: 1 }],
        arcs: [
          {
            id: "arc_window",
            volumeId: "volume_window",
            title: "主线",
            order: 1
          }
        ],
        chapterCards,
        committedThroughChapterId: null
      }
    };

    const userPrompt = buildRuntimeUserPrompt({
      runId: "run_chapter_window",
      sessionId: "session_chapter_window",
      prompt: "写当前章",
      longAgentProfile: profile,
      workspaceContext: { longWorkspace }
    });

    expect(userPrompt).toContain("正文进度：已写 59 章，空白 1 章。");
    expect(userPrompt).toContain("27. 「第27章」(chapter_window_27)");
    expect(userPrompt).toContain(
      "30. 「第30章」(chapter_window_30)；分卷=第 1 卷「第一卷」(volume_window)；卷内顺序=30；主剧情点=「主线」(arc_window)；正文=已写；当前章=是"
    );
    expect(userPrompt).toContain("40. 「第40章」(chapter_window_40)");
    expect(userPrompt).toContain(
      "目录窗口：围绕当前章展示第 27-40 张（前最多 3 张、后最多 10 张）；之前省略 26 张，之后省略 20 张。需要完整目录时按上下文中的 volume_id 调用 list（stage=draft, scope_id=<volume_id>）查询。"
    );
    expect(userPrompt).toContain(
      "查连续性：list（stage=continuity, scope_id=chapter_window_30）"
    );
    expect(userPrompt).not.toContain("「第26章」(chapter_window_26)");
    expect(userPrompt).not.toContain("「第41章」(chapter_window_41)");

    const noActiveChapterPrompt = buildRuntimeUserPrompt({
      runId: "run_chapter_window_without_active",
      sessionId: "session_chapter_window_without_active",
      prompt: "规划全书",
      longAgentProfile: profile,
      workspaceContext: {
        longWorkspace: {
          ...longWorkspace,
          activeChapterCardId: undefined
        }
      }
    });

    expect(noActiveChapterPrompt).toContain("1. 「第1章」(chapter_window_01)");
    expect(noActiveChapterPrompt).toContain("3. 「第3章」(chapter_window_03)");
    expect(noActiveChapterPrompt).toContain(
      "51. 「第51章」(chapter_window_51)"
    );
    expect(noActiveChapterPrompt).toContain(
      "60. 「第60章」(chapter_window_60)"
    );
    expect(noActiveChapterPrompt).not.toContain(
      "4. 「第4章」(chapter_window_04)"
    );
    expect(noActiveChapterPrompt).not.toContain(
      "50. 「第50章」(chapter_window_50)"
    );
    expect(noActiveChapterPrompt).toContain(
      "目录窗口：当前未选中章卡，展示最前 3 张与最后 10 张；中间省略 47 张。需要完整目录时按上下文中的 volume_id 调用 list（stage=draft, scope_id=<volume_id>）查询。"
    );
  });
});
