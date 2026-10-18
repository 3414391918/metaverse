import { describe, expect, it } from "vitest";
import {
  createDefaultCreativePlotStages,
  type ChatAssistantRuntimeContext
} from "@deepwrite/contracts";
import { buildChatAssistantSystemPrompt } from "./chat-assistant";
import { buildChatAssistantTools } from "./chat-assistant-tools";
import { buildEffectiveSystemPrompt } from "./prompts";

const NOW = "2026-08-17T08:00:00.000Z";

function dashboard() {
  return {
    generatedAt: NOW,
    totals: {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      totalTokens: 0,
      requestCount: 0
    },
    trendGranularity: "day" as const,
    trend: [],
    models: [],
    modules: [],
    recentCalls: []
  };
}

function baseContext() {
  const usage = dashboard();
  return {
    software: {
      name: "DeepWrite" as const,
      version: "1.0.0",
      platform: "darwin",
      arch: "arm64",
      currentTime: NOW,
      timezone: "Asia/Shanghai"
    },
    catalog: {
      schemaVersion: 1 as const,
      revision: 1,
      creativePlotStages: createDefaultCreativePlotStages(),
      books: [],
      materials: [],
      materialGroups: [],
      skills: [],
      skillGroups: [],
      updatedAt: NOW
    },
    longBooks: [],
    models: [
      {
        id: "model-1",
        label: "测试模型",
        provider: "example",
        modelId: "example-chat",
        api: "openai-completions" as const,
        reasoning: false,
        defaultThinkingLevel: "off" as const,
        thinkingLevelOptions: ["off"],
        temperatureOptions: [0.7],
        credentialConfigured: true
      }
    ],
    defaultModelId: "model-1",
    usage: { today: usage, "7d": usage, "30d": usage, all: usage }
  };
}

function normalContext(): ChatAssistantRuntimeContext {
  return {
    mode: "normal",
    ...baseContext()
  } as unknown as ChatAssistantRuntimeContext;
}

function projectContext(): ChatAssistantRuntimeContext {
  const projectBook = {
    id: "short-a",
    title: "只读短篇",
    bookType: "short" as const,
    genre: "悬疑",
    status: "editing" as const,
    linkedMaterialIdsByKind: {},
    linkedSkillIdsByKind: {},
    characterStructure: {
      format: "list" as const,
      items: [{ id: "character-alice", title: "林岚", order: 1 }]
    },
    plotStages: [{ id: "outline", title: "大纲", enabled: true, order: 1 }],
    documents: [
      {
        id: "outline",
        title: "大纲",
        content: "林岚在雨夜发现线索。",
        createdAt: NOW,
        updatedAt: NOW
      },
      {
        id: "character-alice",
        title: "林岚",
        content: "林岚是一名调查员。",
        createdAt: NOW,
        updatedAt: NOW
      }
    ],
    draft: {
      id: "draft",
      title: "正文",
      sections: [
        {
          id: "section-1",
          title: "第一节",
          wordCountRequirement: "1000 字",
          body: {
            id: "draft:section-1:body",
            title: "第一节",
            content: "雨落在旧码头。",
            createdAt: NOW,
            updatedAt: NOW
          },
          characterState: {
            id: "draft:section-1:state",
            title: "人物状态",
            content: "林岚保持警觉。",
            createdAt: NOW,
            updatedAt: NOW
          },
          createdAt: NOW,
          updatedAt: NOW
        }
      ],
      createdAt: NOW,
      updatedAt: NOW
    },
    createdAt: NOW,
    updatedAt: NOW
  };
  return {
    mode: "project",
    ...baseContext(),
    project: { projectType: "short", projectId: "short-a" },
    projectPrompt: "优先核对人物动机。",
    projectBook
  } as unknown as ChatAssistantRuntimeContext;
}

function longProjectContext(): ChatAssistantRuntimeContext {
  const navigation = {
    schemaVersion: 1,
    bookId: "long-a",
    updatedAt: NOW,
    counts: {
      worldbuildingCategories: 0,
      characters: 0,
      volumes: 1,
      arcs: 0,
      chapterCards: 0,
      committedChapters: 0
    },
    worldbuilding: [],
    characterTypes: [{ id: "protagonist", title: "主角", order: 1 }],
    characters: [],
    volumes: [{ id: "volume-1", title: "第一卷", order: 1 }],
    arcs: [],
    chapterCards: [],
    committedThroughChapterId: null
  };
  const projectBook = {
    schemaVersion: 1,
    kind: "deepwrite.long-book",
    id: "long-a",
    title: "只读长篇",
    bookType: "long",
    genre: "悬疑",
    status: "editing",
    linkedMaterialIdsByKind: {},
    linkedSkillIdsByKind: {},
    navigation,
    createdAt: NOW,
    updatedAt: NOW
  };
  return {
    mode: "project",
    ...baseContext(),
    longBooks: [projectBook],
    project: { projectType: "long", projectId: "long-a" },
    projectPrompt: "先核对连续性。",
    projectBook
  } as unknown as ChatAssistantRuntimeContext;
}

function resultText(result: {
  content: Array<{ type: string; text?: string }>;
}) {
  const first = result.content[0];
  return first?.type === "text" ? first.text : "";
}

describe("chat assistant read-only runtime", () => {
  it("uses the current brand even when software metadata has the legacy identifier", () => {
    const prompt = buildChatAssistantSystemPrompt(normalContext());
    expect(prompt).not.toMatch(/deepwrite/i);
    expect(prompt).toContain("当前软件：虚拟世界 1.0.0");
  });

  it("keeps the prompt order and appends immutable boundaries after custom text", () => {
    const prompt = buildChatAssistantSystemPrompt(projectContext());
    expect(prompt.indexOf("虚拟世界软件基础情况")).toBeLessThan(
      prompt.indexOf("项目聊天模式")
    );
    expect(prompt.indexOf("优先核对人物动机")).toBeLessThan(
      prompt.indexOf("不可编辑的安全与工具边界")
    );
    expect(prompt).not.toContain("雨落在旧码头");
  });

  it("describes DeepSeek server-side search only when the runtime enables it", () => {
    const disabledPrompt = buildEffectiveSystemPrompt("ignored", {
      runId: "run-search-disabled",
      sessionId: "session-search-disabled",
      prompt: "今天有什么热点？",
      mode: "chat-assistant",
      chatAssistantRuntimeContext: normalContext()
    });
    expect(disabledPrompt).toContain("Shell、网络、浏览器");
    expect(disabledPrompt).not.toContain("本轮已启用 DeepSeek 服务端智能搜索");

    const enabledPrompt = buildEffectiveSystemPrompt("ignored", {
      runId: "run-search-enabled",
      sessionId: "session-search-enabled",
      prompt: "今天有什么热点？",
      mode: "chat-assistant",
      chatAssistantRuntimeContext: normalContext(),
      webSearchEnabled: true
    });
    expect(enabledPrompt).toContain("本轮已启用 DeepSeek 服务端智能搜索");
    expect(enabledPrompt).toContain(
      "网络能力仅限本轮列出的 DeepSeek 服务端 web_search"
    );
    expect(enabledPrompt).not.toContain("Shell、网络、浏览器");
  });

  it("keeps project read-only boundaries while enabling server-side search", () => {
    const prompt = buildChatAssistantSystemPrompt(projectContext(), true);
    expect(prompt).toContain("本轮已启用 DeepSeek 服务端智能搜索");
    expect(prompt).toContain("不能创建、保存、编辑、删除、审批或覆盖书籍");
    expect(prompt).toContain("优先核对人物动机");
  });

  it("normal mode exposes summaries and sanitized model/usage queries only", async () => {
    const tools = buildChatAssistantTools({
      runId: "run-normal",
      sessionId: "session-normal",
      context: normalContext()
    });
    const names = tools.map(({ name }) => name);
    expect(names).toEqual(
      expect.arrayContaining([
        "list_creation_projects",
        "get_material_library_summary",
        "get_skill_library_summary",
        "query_model_configs",
        "query_model_usage"
      ])
    );
    expect(
      names.some((name) => /write|edit|delete|propos|approv/u.test(name))
    ).toBe(false);
    expect(names).not.toContain("read_workspace_content");

    const modelTool = tools.find(({ name }) => name === "query_model_configs")!;
    const output = resultText(await modelTool.execute("model", {}));
    expect(output).toContain("credentialConfigured");
    expect(output).not.toMatch(/apiKey|baseUrl|requestModelId|\/Users\//u);
  });

  it("project tools are locked to the selected book and page content on demand", async () => {
    const tools = buildChatAssistantTools({
      runId: "run-project",
      sessionId: "session-project",
      context: projectContext()
    });
    const names = tools.map(({ name }) => name);
    expect(names).toEqual(
      expect.arrayContaining([
        "list_workspace_content",
        "search_workspace_text",
        "read_workspace_content",
        "list_characters",
        "search_characters",
        "read_character",
        "read_draft_sections"
      ])
    );
    const read = tools.find(({ name }) => name === "read_workspace_content")!;
    expect(
      Object.keys((read.parameters as { properties: object }).properties)
    ).not.toContain("project_id");
    expect(
      resultText(
        await read.execute("read-ok", {
          document_id: "draft:section-1:body",
          offset: 0,
          max_characters: 4
        })
      )
    ).toContain("雨落在旧");
    expect(
      resultText(
        await read.execute("read-other", {
          document_id: "another-book-document"
        })
      )
    ).toContain("不属于当前项目");
  });

  it("long project mode retains only the unified list and read query tools", () => {
    const tools = buildChatAssistantTools({
      runId: "run-long-project",
      sessionId: "session-long-project",
      context: longProjectContext()
    });
    const projectNames = tools
      .map(({ name }) => name)
      .filter((name) => name === "list" || name === "read");
    expect(projectNames).toEqual(["list", "read"]);
    expect(
      tools.some(({ name }) =>
        /create|write|edit|delete|propos|approv/u.test(name)
      )
    ).toBe(false);
    const list = tools.find(({ name }) => name === "list")!;
    expect(
      Object.keys((list.parameters as { properties: object }).properties)
    ).not.toContain("book_id");
  });
});
