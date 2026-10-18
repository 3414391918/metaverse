import type { LongWorkspaceRuntimeContext } from "./index.test-support";

import {
  DEFAULT_LONG_AGENT_PROFILES,
  PiAgentRuntimeAdapter,
  buildRuntimeUserPrompt,
  describe,
  expect,
  it
} from "./index.test-support";

describe("creation teams and project rules", () => {
  it("injects AGENTS.md into every long agent and later plot-design turns", () => {
    const agentsMd = "# 长篇上下文\n\n## 世界观阶段\n维护设定。";
    const navigation = {
      schemaVersion: 1 as const,
      bookId: "longbook_agents_md",
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
      volumes: [{ id: "volume_agents", title: "第一卷", order: 1 }],
      arcs: [],
      chapterCards: [],
      committedThroughChapterId: null
    };

    for (const profile of DEFAULT_LONG_AGENT_PROFILES) {
      const prompt = buildRuntimeUserPrompt({
        runId: `run_${profile.id}`,
        sessionId: `session_${profile.id}`,
        prompt: "继续",
        longAgentProfile: profile,
        workspaceContext: {
          longWorkspace: {
            bookId: "longbook_agents_md",
            title: "雾港长篇",
            activeRoot: "plot_design",
            activeAgentId: profile.id,
            navigation,
            agentsMd
          }
        }
      });
      expect(prompt).toContain("【创作上下文（AGENTS.md）】");
      expect(prompt).toContain("## 世界观阶段");
    }

    const emptyPrompt = buildRuntimeUserPrompt({
      runId: "run_empty_agents",
      sessionId: "session_empty_agents",
      prompt: "继续",
      longAgentProfile: DEFAULT_LONG_AGENT_PROFILES.find(
        ({ id }) => id === "long"
      )!,
      workspaceContext: {
        longWorkspace: {
          bookId: "longbook_agents_md",
          title: "雾港长篇",
          activeRoot: "draft",
          activeAgentId: "long",
          navigation,
          agentsMd: "   "
        }
      }
    });
    expect(emptyPrompt).not.toContain("【创作上下文（AGENTS.md）】");
  });

  it("lets configured long-form teams delegate with the same bounded tools", async () => {
    const profile = DEFAULT_LONG_AGENT_PROFILES.find(
      ({ id }) => id === "long"
    )!;
    const longWorkspace: LongWorkspaceRuntimeContext = {
      bookId: "longbook_subagents",
      title: "雾港长篇",
      activeRoot: "plot_design",
      activeAgentId: profile.id,
      navigation: {
        schemaVersion: 1,
        bookId: "longbook_subagents",
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
        volumes: [{ id: "volume_subagents", title: "第一卷", order: 1 }],
        arcs: [],
        chapterCards: [],
        committedThroughChapterId: null
      }
    };
    const runtime = new PiAgentRuntimeAdapter({ tokensPerSecond: 0 });
    for await (const _event of runtime.start({
      runId: "run_long_subagents",
      sessionId: "session_long_subagents",
      prompt: "委派检查时间线",
      thinkingLevel: "off",
      longAgentProfile: profile,
      subagentDefinitions: [
        {
          id: "timeline_reviewer",
          name: "时间线审阅",
          description: "核对事件顺序与叙事落点。",
          systemPrompt: "只检查时间线并把结论交还主智能体。",
          enabled: true,
          modelMode: "inherit"
        }
      ],
      workspaceContext: { longWorkspace }
    })) {
      // Consume the local run before inspecting the cached parent agent.
    }

    const cache = (
      runtime as unknown as {
        conversationAgents: Map<
          string,
          { state: { tools: Array<{ name: string }> } }
        >;
      }
    ).conversationAgents;
    const names =
      cache
        .get("session_long_subagents:long:long:longbook_subagents")
        ?.state.tools.map(({ name }) => name) ?? [];
    expect(names).toContain("spawn_subagent");
    expect(names).toContain("list");
    expect(names).toContain("read");
    expect(names).not.toContain("get_long_workspace_index");
    expect(names).toContain("create");
  });
});
