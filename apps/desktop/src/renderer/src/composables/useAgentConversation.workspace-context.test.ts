import type { WorkspaceDocument } from "./useAgentConversation.test-support";
import {
  createDeferredApi,
  createEnvelope,
  createShortWorkspaceContentRevision,
  describe,
  document,
  eventOptions,
  expect,
  it,
  runtime,
  useAgentConversation
} from "./useAgentConversation.test-support";

describe("agent conversation controller: workspace-context", () => {
  it("tracks a requested tool as running and updates it when completed", async () => {
    const deferred = createDeferredApi();
    const controller = useAgentConversation({
      api: () => deferred.api,
      idleTimeoutMs: 10_000
    });
    controller.draft.value = "读取人物内容";
    const sessionId = controller.sessionId.value;
    const sending = controller.sendMessage(document);
    deferred.resolveAccepted(0, {
      sessionId,
      runId: "run_tools",
      acceptedAt: new Date().toISOString(),
      runtime
    });
    await sending;

    controller.handleEvent(
      createEnvelope(
        "tool.call_requested",
        {
          sessionId,
          runId: "run_tools",
          toolCallId: "tool_read_character",
          toolName: "read_workspace_content",
          args: { stage_ids: ["character_design"] },
          runtime
        },
        eventOptions(sessionId, "run_tools", "evt_tool_requested")
      )
    );

    expect(controller.messages.value.at(-1)).toMatchObject({
      id: "run_tools_assistant",
      role: "assistant",
      status: "streaming",
      tools: [
        {
          id: "tool_read_character",
          name: "read_workspace_content",
          status: "running"
        }
      ]
    });

    controller.handleEvent(
      createEnvelope(
        "tool.execution_completed",
        {
          sessionId,
          runId: "run_tools",
          toolCallId: "tool_read_character",
          toolName: "read_workspace_content",
          resultSummary: "已读取人物阶段",
          isError: false,
          runtime
        },
        eventOptions(sessionId, "run_tools", "evt_tool_completed")
      )
    );

    expect(controller.messages.value.at(-1)?.tools).toEqual([
      {
        id: "tool_read_character",
        name: "read_workspace_content",
        status: "completed",
        summary: "已读取人物阶段"
      }
    ]);
    expect(controller.isBusy.value).toBe(true);
    expect(controller.acceptsRunEvent(sessionId, "run_tools")).toBe(true);
    controller.markToolConflict(
      "run_tools",
      "tool_read_character",
      "文稿版本已变化，未应用。"
    );
    expect(controller.messages.value.at(-1)?.tools?.[0]).toMatchObject({
      status: "error",
      summary: "文稿版本已变化，未应用。"
    });

    controller.handleEvent(
      createEnvelope(
        "agent.message_completed",
        {
          sessionId,
          runId: "run_tools",
          messageId: "run_tools_assistant",
          role: "assistant" as const,
          content: "检查完成。",
          runtime
        },
        eventOptions(sessionId, "run_tools", "evt_tools_completed")
      )
    );
    expect(controller.acceptsRunEvent(sessionId, "run_tools")).toBe(false);
    controller.dispose();
  });

  it("forwards only the explicitly selected library workspace for library management", async () => {
    const deferred = createDeferredApi();
    const controller = useAgentConversation({
      api: () => deferred.api,
      idleTimeoutMs: 10_000
    });
    const activeDocument: WorkspaceDocument = {
      id: "material-document-1",
      domain: "material",
      title: "人物甲",
      eyebrow: "短篇素材",
      path: ["人物素材", "人物甲"],
      content: "人物正文",
      libraryId: "material-library-1",
      catalogEntryId: "entry-1",
      stageCategoryId: "character"
    };
    const content = "人物正文";
    controller.draft.value = "整理当前素材";
    const sending = controller.sendMessage(activeDocument, [], {
      libraryWorkspace: {
        domain: "material",
        libraryId: "material-library-1",
        title: "人物素材",
        libraryType: "short",
        kind: "character",
        overviewDocumentId: "material-overview-1",
        overview: "人物素材边界",
        overviewRevision: createShortWorkspaceContentRevision("人物素材边界"),
        readOnly: false,
        activeEntryId: "entry-1",
        projectRevision: 7,
        entries: [
          {
            id: "entry-1",
            documentId: activeDocument.id,
            stageId: "character",
            title: activeDocument.title,
            content,
            revision: createShortWorkspaceContentRevision(content),
            readOnly: false
          }
        ]
      }
    });
    const sessionId = controller.sessionId.value;
    deferred.resolveAccepted(0, {
      sessionId,
      runId: "run_material_library",
      acceptedAt: new Date().toISOString(),
      runtime
    });
    await sending;

    expect(deferred.prompts[0]).not.toHaveProperty("agentTeamMode");

    expect(deferred.prompts[0]?.workspaceContext).toMatchObject({
      activeResource: {
        id: activeDocument.id,
        domain: "material"
      },
      libraryWorkspace: {
        domain: "material",
        libraryId: "material-library-1",
        activeEntryId: "entry-1",
        entries: [{ id: "entry-1", content }]
      }
    });
    expect(deferred.prompts[0]?.workspaceContext).not.toHaveProperty(
      "shortWorkspace"
    );
    expect(() =>
      structuredClone(deferred.prompts[0]?.workspaceContext?.libraryWorkspace)
    ).not.toThrow();
    controller.dispose();
  });

  it("records truncation metadata for a document over the context limit", () => {
    const deferred = createDeferredApi();
    const controller = useAgentConversation({
      api: () => deferred.api,
      idleTimeoutMs: 10_000
    });
    controller.draft.value = "验证长文快照";
    void controller.sendMessage({ ...document, content: "长".repeat(20_010) });

    expect(deferred.prompts[0]?.workspaceContext?.activeResource).toMatchObject(
      {
        truncated: true,
        originalLength: 20_010
      }
    );
    expect(
      deferred.prompts[0]?.workspaceContext?.activeResource?.content
    ).toHaveLength(20_000);
    controller.dispose();
  });

  it("sends long-form prompts with an exclusive long workspace context", () => {
    const deferred = createDeferredApi();
    const controller = useAgentConversation({
      api: () => deferred.api,
      idleTimeoutMs: 10_000
    });
    controller.draft.value = "检查当前世界规则";
    void controller.sendLongMessage(
      {
        bookId: "longbook_context",
        title: "雾港来信",
        activeRoot: "worldbuilding",
        activeAgentId: "long",
        activeFileId: "file_world_rules:content",
        navigation: {
          schemaVersion: 1,
          bookId: "longbook_context",
          updatedAt: "2026-07-26T12:00:00.000Z",
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
          volumes: [{ id: "volume_one", title: "第一卷", order: 1 }],
          arcs: [],
          chapterCards: [],
          committedThroughChapterId: null
        }
      },
      {
        attachedSkills: [
          {
            id: "skill:long:world",
            title: "小说世界构建",
            source: "attached-skill",
            kind: "general",
            content: "先建立规则边界。"
          }
        ],
        attachedMaterials: [
          {
            id: "material:long:world",
            title: "雾港地理",
            source: "attached-material",
            kind: "other",
            content: "港口终年有雾。"
          }
        ]
      }
    );

    expect(deferred.prompts[0]?.workspaceContext).toEqual({
      longWorkspace: expect.objectContaining({
        bookId: "longbook_context",
        activeRoot: "worldbuilding",
        activeAgentId: "long",
        activeFileId: "file_world_rules:content"
      }),
      attachedSkills: [
        expect.objectContaining({
          id: "skill:long:world",
          source: "attached-skill",
          kind: "general"
        })
      ],
      attachedMaterials: [
        expect.objectContaining({
          id: "material:long:world",
          source: "attached-material",
          kind: "other"
        })
      ]
    });
    expect(deferred.prompts[0]?.agentTeamMode).toBe("normal");
    expect(deferred.prompts[0]?.workspaceContext).not.toHaveProperty(
      "activeResource"
    );
    expect(deferred.prompts[0]?.workspaceContext).not.toHaveProperty(
      "shortWorkspace"
    );
    expect(deferred.prompts[0]?.workspaceContext).not.toHaveProperty(
      "scriptWorkspace"
    );
    controller.dispose();
  });
});
