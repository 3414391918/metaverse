import {
  SystemEventEnvelopeSchema,
  WorkspaceEditorMutationPayloadSchema,
  createEnvelope,
  describe,
  expect,
  it,
  runtime
} from "./index.test-support";

describe("desktop contracts: historical draft mutation payloads", () => {
  it("validates targeted expert-draft file mutations", () => {
    const event = createEnvelope(
      "workspace.editor_mutation",
      {
        sessionId: "session_section_mutation",
        runId: "run_section_mutation",
        toolCallId: "tool_section_mutation",
        workspaceId: "book-1",
        stageId: "draft" as const,
        text: "第三节的新正文。",
        mutationTarget: {
          kind: "expert-draft-file" as const,
          documentId: "draft:section-3:body",
          sectionId: "section-3",
          fileKind: "body" as const
        },
        baseRevision: "v1:100:1234abcd",
        summary: "已生成第三节正文变更。",
        runtime
      },
      {
        id: "event_section_mutation",
        context: {
          sessionId: "session_section_mutation",
          runId: "run_section_mutation"
        }
      }
    );

    expect(SystemEventEnvelopeSchema.parse(event)).toMatchObject({
      payload: {
        mutationTarget: {
          documentId: "draft:section-3:body",
          sectionId: "section-3",
          fileKind: "body"
        }
      }
    });
    expect(() =>
      SystemEventEnvelopeSchema.parse({
        ...event,
        payload: { ...event.payload, stageId: "outline" }
      })
    ).toThrow();
    expect(() =>
      SystemEventEnvelopeSchema.parse({
        ...event,
        payload: { ...event.payload, mutationTarget: undefined }
      })
    ).toThrow();
  });

  it("validates batch expert-draft section creation mutations", () => {
    const payload = {
      sessionId: "session_section_creation",
      runId: "run_section_creation",
      toolCallId: "tool_section_creation",
      workspaceId: "book-1",
      stageId: "draft" as const,
      text: "1. 第二章（1200 字）\n2. 第三章",
      mutationTarget: {
        kind: "expert-draft-section-creation" as const,
        sections: [
          {
            title: "第二章",
            wordCountRequirement: "1200 字",
            provisionalSectionId: "pending:section:1",
            bodyContent: "第二章正文。",
            characterStateContent: "人物在章末掌握了新线索。"
          },
          {
            title: "第三章",
            wordCountRequirement: "",
            provisionalSectionId: "pending:section:2"
          }
        ],
        afterSectionId: "section-1"
      },
      baseRevision: "v1:100:1234abcd",
      summary: "已生成创建 2 个空白章节文件的变更。",
      runtime
    };

    expect(WorkspaceEditorMutationPayloadSchema.parse(payload)).toMatchObject({
      mutationTarget: {
        kind: "expert-draft-section-creation",
        sections: [
          {
            title: "第二章",
            provisionalSectionId: "pending:section:1",
            bodyContent: "第二章正文。",
            characterStateContent: "人物在章末掌握了新线索。"
          },
          { title: "第三章", provisionalSectionId: "pending:section:2" }
        ]
      }
    });
    expect(
      WorkspaceEditorMutationPayloadSchema.safeParse({
        ...payload,
        mutationTarget: { ...payload.mutationTarget, sections: [] }
      }).success
    ).toBe(false);
    expect(
      WorkspaceEditorMutationPayloadSchema.safeParse({
        ...payload,
        stageId: "outline"
      }).success
    ).toBe(false);
  });

  it("validates create-with-content targets for characters and plot stages", () => {
    const base = {
      sessionId: "session_structure_creation",
      runId: "run_structure_creation",
      toolCallId: "tool_structure_creation",
      workspaceId: "book-1",
      baseRevision: "v1:100:1234abcd",
      summary: "创建结构与正文。",
      runtime
    };
    expect(
      WorkspaceEditorMutationPayloadSchema.safeParse({
        ...base,
        stageId: "character_design",
        text: "创建：林默",
        mutationTarget: {
          kind: "character-structure",
          initialContent: "林默是守夜人。",
          mutation: {
            type: "createItem",
            title: "林默",
            provisionalItemId: "character_pending_1"
          }
        }
      }).success
    ).toBe(true);
    expect(
      WorkspaceEditorMutationPayloadSchema.safeParse({
        ...base,
        stageId: "plot_design",
        text: "失踪名单记录了旧船员。",
        mutationTarget: {
          kind: "plot-structure",
          mutation: {
            type: "create",
            title: "真相回收",
            description: "回收线索并揭示真相。",
            provisionalStageId: "pending:plot-stage:1",
            content: "失踪名单记录了旧船员。"
          }
        }
      }).success
    ).toBe(true);
    expect(
      WorkspaceEditorMutationPayloadSchema.safeParse({
        ...base,
        stageId: "draft",
        text: "失踪名单记录了旧船员。",
        mutationTarget: {
          kind: "plot-structure",
          mutation: {
            type: "create",
            title: "真相回收",
            description: "回收线索并揭示真相。",
            provisionalStageId: "pending:plot-stage:1",
            content: "失踪名单记录了旧船员。"
          }
        }
      }).success
    ).toBe(false);
  });

  it("validates expert-draft section rename mutations", () => {
    const payload = {
      sessionId: "session_section_rename",
      runId: "run_section_rename",
      toolCallId: "tool_section_rename",
      workspaceId: "book-1",
      stageId: "draft" as const,
      text: "旧章名 → 新章名",
      mutationTarget: {
        kind: "expert-draft-section-rename" as const,
        sectionId: "section-1",
        previousTitle: "旧章名",
        title: "新章名"
      },
      baseRevision: "v1:100:1234abcd",
      summary: "已生成章节改名变更。",
      runtime
    };

    expect(WorkspaceEditorMutationPayloadSchema.parse(payload)).toMatchObject({
      mutationTarget: {
        kind: "expert-draft-section-rename",
        sectionId: "section-1",
        previousTitle: "旧章名",
        title: "新章名"
      }
    });
    expect(
      WorkspaceEditorMutationPayloadSchema.safeParse({
        ...payload,
        mutationTarget: {
          ...payload.mutationTarget,
          title: ""
        }
      }).success
    ).toBe(false);
  });

  it("validates expert-draft section deletion mutations", () => {
    const payload = {
      sessionId: "session_section_deletion",
      runId: "run_section_deletion",
      toolCallId: "tool_section_deletion",
      workspaceId: "book-1",
      stageId: "draft" as const,
      text: "删除：旧章名",
      mutationTarget: {
        kind: "expert-draft-section-deletion" as const,
        sectionId: "section-1",
        title: "旧章名"
      },
      baseRevision: "v1:100:1234abcd",
      summary: "已生成章节删除变更。",
      runtime
    };

    expect(WorkspaceEditorMutationPayloadSchema.parse(payload)).toMatchObject({
      mutationTarget: {
        kind: "expert-draft-section-deletion",
        sectionId: "section-1",
        title: "旧章名"
      }
    });
    expect(
      WorkspaceEditorMutationPayloadSchema.safeParse({
        ...payload,
        mutationTarget: {
          ...payload.mutationTarget,
          title: ""
        }
      }).success
    ).toBe(false);
  });
});
