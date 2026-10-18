import {
  ActiveResourceSnapshotSchema,
  ExpertDraftFileSnapshotSchema,
  ExpertDraftSchema,
  SHORT_WORKSPACE_FILE_MAX_CHARACTERS,
  ShortCharacterItemSnapshotSchema,
  ShortWorkspaceStageSnapshotSchema,
  PromptTextAttachmentSchema,
  WorkspaceEditorMutationPayloadSchema,
  createShortWorkspaceContentRevision,
  describe,
  expect,
  it,
  runtime
} from "./index.test-support";

describe("desktop contracts: text snapshot bounds", () => {
  it("requires truthful truncation metadata for a shortened live snapshot", () => {
    const snapshot = {
      id: "chapter_long",
      domain: "creation" as const,
      title: "长章节",
      path: ["作品", "长章节"],
      source: "live-editor" as const,
      content: "字".repeat(20_000),
      truncated: true,
      originalLength: 20_010
    };

    expect(ActiveResourceSnapshotSchema.parse(snapshot).originalLength).toBe(
      20_010
    );
    expect(() =>
      ActiveResourceSnapshotSchema.parse({
        ...snapshot,
        originalLength: 20_000
      })
    ).toThrow();
    expect(() =>
      ActiveResourceSnapshotSchema.parse({
        ...snapshot,
        truncated: false,
        originalLength: 20_010
      })
    ).toThrow();
    const { truncated: _truncated, ...withoutTruncated } = snapshot;
    expect(() =>
      ActiveResourceSnapshotSchema.parse(withoutTruncated)
    ).toThrow();
  });

  it("uses one 32 MiB character boundary across stored and runtime text files", () => {
    const atLimit = "a".repeat(SHORT_WORKSPACE_FILE_MAX_CHARACTERS);
    const overLimit = `${atLimit}a`;
    const revision = "v1:0:811c9dc5";
    const draftSection = {
      id: "section-1",
      title: "第一节",
      wordCountRequirement: "",
      body: atLimit,
      characterState: ""
    };
    const draftFile = {
      documentId: "d".repeat(4_096),
      title: "第一节·正文",
      content: atLimit,
      revision
    };
    const activeResource = {
      id: "draft:section-1:body",
      domain: "creation" as const,
      title: "第一节·正文",
      path: ["正文", "第一节", "正文"],
      source: "live-editor" as const,
      content: atLimit
    };
    const stage = {
      stageId: "outline" as const,
      title: "大纲",
      content: atLimit,
      revision
    };
    const mutation = {
      sessionId: "session-boundary",
      runId: "run-boundary",
      toolCallId: "tool-boundary",
      workspaceId: "book-boundary",
      stageId: "draft" as const,
      text: atLimit,
      mutationTarget: {
        kind: "expert-draft-file" as const,
        documentId: "d".repeat(4_096),
        sectionId: "section-1",
        fileKind: "body" as const
      },
      baseRevision: revision,
      summary: "边界写入",
      runtime
    };

    expect(
      ExpertDraftSchema.safeParse({ sections: [draftSection] }).success
    ).toBe(true);
    expect(ExpertDraftFileSnapshotSchema.safeParse(draftFile).success).toBe(
      true
    );
    expect(
      ExpertDraftFileSnapshotSchema.safeParse({
        ...draftFile,
        title: "节".repeat(256),
        content: ""
      }).success
    ).toBe(true);
    expect(ActiveResourceSnapshotSchema.safeParse(activeResource).success).toBe(
      true
    );
    expect(
      ActiveResourceSnapshotSchema.safeParse({
        ...activeResource,
        content: "",
        truncated: true,
        originalLength: SHORT_WORKSPACE_FILE_MAX_CHARACTERS
      }).success
    ).toBe(true);
    expect(ShortWorkspaceStageSnapshotSchema.safeParse(stage).success).toBe(
      true
    );
    expect(
      WorkspaceEditorMutationPayloadSchema.safeParse(mutation).success
    ).toBe(true);

    expect(
      ExpertDraftSchema.safeParse({
        sections: [{ ...draftSection, body: overLimit }]
      }).success
    ).toBe(false);
    expect(
      ExpertDraftFileSnapshotSchema.safeParse({
        ...draftFile,
        content: overLimit
      }).success
    ).toBe(false);
    expect(
      ExpertDraftFileSnapshotSchema.safeParse({
        ...draftFile,
        documentId: "d".repeat(4_097),
        content: ""
      }).success
    ).toBe(false);
    expect(
      ExpertDraftFileSnapshotSchema.safeParse({
        ...draftFile,
        title: "节".repeat(257),
        content: ""
      }).success
    ).toBe(false);
    expect(
      ActiveResourceSnapshotSchema.safeParse({
        ...activeResource,
        content: "",
        originalLength: SHORT_WORKSPACE_FILE_MAX_CHARACTERS + 1
      }).success
    ).toBe(false);
    expect(
      ShortWorkspaceStageSnapshotSchema.safeParse({
        ...stage,
        content: overLimit
      }).success
    ).toBe(false);
    expect(
      WorkspaceEditorMutationPayloadSchema.safeParse({
        ...mutation,
        text: overLimit
      }).success
    ).toBe(false);
    expect(
      WorkspaceEditorMutationPayloadSchema.safeParse({
        ...mutation,
        text: "",
        mutationTarget: {
          ...mutation.mutationTarget,
          documentId: "d".repeat(4_097)
        }
      }).success
    ).toBe(false);
  });
  it("requires truthful truncation metadata across bounded text snapshots", () => {
    const revision = createShortWorkspaceContentRevision("前段");
    const bounded = { content: "前段", truncated: true, originalLength: 10 };
    expect(() =>
      ShortWorkspaceStageSnapshotSchema.parse({
        stageId: "outline",
        title: "大纲",
        revision,
        ...bounded
      })
    ).not.toThrow();
    expect(() =>
      ShortWorkspaceStageSnapshotSchema.parse({
        stageId: "outline",
        title: "大纲",
        revision,
        content: "前段",
        originalLength: 10
      })
    ).toThrow();
    expect(() =>
      ShortCharacterItemSnapshotSchema.parse({
        id: "character-1",
        title: "林默",
        order: 1,
        revision,
        ...bounded
      })
    ).not.toThrow();
    expect(() =>
      ShortCharacterItemSnapshotSchema.parse({
        id: "character-1",
        title: "林默",
        order: 1,
        revision,
        content: "前段",
        truncated: true
      })
    ).toThrow();
    expect(() =>
      PromptTextAttachmentSchema.parse({
        id: "attachment-1",
        kind: "text",
        name: "资料.txt",
        mediaType: "text/plain",
        size: 10,
        content: "前段",
        originalLength: 10
      })
    ).toThrow();
  });
});
