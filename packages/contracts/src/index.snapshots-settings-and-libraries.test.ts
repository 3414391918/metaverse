import {
  AgentPromptCommandPayloadSchema,
  AppearanceSettingsSchema,
  AppearanceSettingsSnapshotSchema,
  CommandEnvelopeSchema,
  DEFAULT_LIBRARY_AGENT_SETTINGS,
  LIBRARY_AGENT_ENTRY_MAX_CHARACTERS,
  LibraryAgentSettingsInputSchema,
  SystemEventEnvelopeSchema,
  WorkspaceRuntimeContextSchema,
  createDefaultAppearanceSettings,
  createEnvelope,
  createShortWorkspaceContentRevision,
  describe,
  expect,
  it,
  listAppearanceEditorFontFamilyOptions,
  listAppearanceUiFontFamilyOptions,
  resolveAppearanceEditorFontStack,
  resolveAppearanceUiFontStack,
  runtime
} from "./index.test-support";

describe("DeepWrite desktop contracts: snapshots-settings-and-libraries", () => {
  it("does not allow material snapshots in the attached skill list", () => {
    expect(() =>
      WorkspaceRuntimeContextSchema.parse({
        attachedSkills: [
          {
            id: "material_1",
            title: "雨夜声音",
            source: "attached-material",
            content: "雨声素材"
          }
        ]
      })
    ).toThrow();
  });

  it("validates complete library-agent settings and configuration commands", () => {
    expect(
      DEFAULT_LIBRARY_AGENT_SETTINGS.agents.map(({ domain }) => domain)
    ).toEqual(["material", "skill"]);
    const input = {
      agents: DEFAULT_LIBRARY_AGENT_SETTINGS.agents.map((agent) => ({
        domain: agent.domain,
        systemPrompt: agent.systemPrompt,
        readAccess: {
          skills: agent.readAccess.skills.map((skill) => ({ ...skill }))
        }
      }))
    };
    expect(LibraryAgentSettingsInputSchema.parse(input)).toEqual(input);
    expect(
      LibraryAgentSettingsInputSchema.safeParse({
        agents: [input.agents[0], input.agents[0]]
      }).success
    ).toBe(false);
    expect(
      CommandEnvelopeSchema.parse(
        createEnvelope("libraryAgents.save", input, { id: "library-save" })
      ).type
    ).toBe("libraryAgents.save");
    expect(
      CommandEnvelopeSchema.parse(
        createEnvelope(
          "libraryAgents.reset",
          { domain: "skill" },
          { id: "library-reset" }
        )
      ).type
    ).toBe("libraryAgents.reset");
  });

  it("accepts appearance list and save commands with durable settings payloads", () => {
    const settings = createDefaultAppearanceSettings();
    settings.light.uiFontSize = 16.5;
    settings.mode = "dark";

    expect(
      CommandEnvelopeSchema.parse(
        createEnvelope("appearance.list", {}, { id: "appearance-list" })
      ).type
    ).toBe("appearance.list");
    expect(
      CommandEnvelopeSchema.parse(
        createEnvelope("appearance.save", settings, { id: "appearance-save" })
      )
    ).toMatchObject({
      type: "appearance.save",
      payload: {
        mode: "dark",
        light: { uiFontSize: 16.5 }
      }
    });
    expect(
      AppearanceSettingsSnapshotSchema.parse({
        persisted: true,
        settings
      })
    ).toMatchObject({
      persisted: true,
      settings: {
        mode: "dark",
        light: { uiFontSize: 16.5 },
        uiFontFamily: "system",
        editorFontFamily: "song"
      }
    });
  });

  it("defaults missing appearance font families and rejects unknown ids", () => {
    const settings = createDefaultAppearanceSettings();
    const parsed = AppearanceSettingsSchema.parse({
      mode: settings.mode,
      light: settings.light,
      dark: settings.dark
    });
    expect(parsed.uiFontFamily).toBe("system");
    expect(parsed.editorFontFamily).toBe("song");
    expect(resolveAppearanceUiFontStack("sans")).toContain("PingFang SC");
    expect(resolveAppearanceEditorFontStack("kai")).toContain("Kaiti SC");
    expect(resolveAppearanceUiFontStack("missing")).toBe(
      resolveAppearanceUiFontStack("system")
    );
    expect(
      listAppearanceUiFontFamilyOptions().map((option) => option.value)
    ).toEqual(["system", "sans", "yuan"]);
    expect(
      listAppearanceEditorFontFamilyOptions().map((option) => option.value)
    ).toEqual(["song", "kai", "fangsong", "sans", "yuan"]);
    expect(
      AppearanceSettingsSchema.safeParse({
        ...settings,
        uiFontFamily: "comic-sans"
      } as unknown).success
    ).toBe(false);
    expect(
      AppearanceSettingsSchema.safeParse({
        ...settings,
        editorFontFamily: "times"
      } as unknown).success
    ).toBe(false);
  });

  it("keeps library workspaces isolated from retired contexts", () => {
    const body = "人物素材正文";
    const libraryWorkspace = {
      domain: "material" as const,
      libraryId: "material-library-1",
      title: "人物素材",
      libraryType: "short" as const,
      kind: "character" as const,
      overviewDocumentId: "material-overview-1",
      overview: "只用于人物设定",
      overviewRevision: createShortWorkspaceContentRevision("只用于人物设定"),
      readOnly: false,
      activeEntryId: "entry-1",
      projectRevision: 2,
      entries: [
        {
          id: "entry-1",
          documentId: "document-1",
          stageId: "character" as const,
          title: "人物甲",
          content: body,
          revision: createShortWorkspaceContentRevision(body),
          readOnly: false
        }
      ]
    };
    const activeResource = {
      id: "document-1",
      domain: "material" as const,
      title: "人物甲",
      path: ["人物素材", "人物甲"],
      source: "live-editor" as const,
      content: body
    };
    expect(() =>
      WorkspaceRuntimeContextSchema.parse({
        activeResource,
        libraryWorkspace
      })
    ).not.toThrow();
    expect(() =>
      WorkspaceRuntimeContextSchema.parse({
        activeResource: { ...activeResource, content: "过期的编辑器内容" },
        libraryWorkspace
      })
    ).toThrow();
    expect(() =>
      WorkspaceRuntimeContextSchema.parse({
        activeResource: { ...activeResource, domain: "skill" },
        libraryWorkspace
      })
    ).toThrow();
    expect(() =>
      WorkspaceRuntimeContextSchema.parse({
        activeResource,
        libraryWorkspace,
        shortWorkspace: {}
      })
    ).toThrow();

    const profile = DEFAULT_LIBRARY_AGENT_SETTINGS.agents.find(
      ({ domain }) => domain === "material"
    )!;
    expect(() =>
      AgentPromptCommandPayloadSchema.parse({
        sessionId: "session-library",
        message: "整理素材",
        workspaceContext: { activeResource, libraryWorkspace },
        libraryAgentProfile: profile
      })
    ).not.toThrow();
    expect(() =>
      AgentPromptCommandPayloadSchema.parse({
        sessionId: "session-library",
        message: "整理素材",
        workspaceContext: { activeResource, libraryWorkspace }
      })
    ).toThrow();
  });

  it("binds truncated library entry and overview snapshots to the live editor", () => {
    const fullContent = `资料库。${"长".repeat(LIBRARY_AGENT_ENTRY_MAX_CHARACTERS + 10_000)}`;
    const entrySnapshot = fullContent.slice(
      0,
      LIBRARY_AGENT_ENTRY_MAX_CHARACTERS
    );
    const activeSnapshot = fullContent.slice(0, 20_000);
    const commonWorkspace = {
      domain: "material" as const,
      libraryId: "material-library-long",
      title: "长素材库",
      libraryType: "short" as const,
      kind: "character" as const,
      overviewDocumentId: "overview-long",
      overview: "素材库概览",
      overviewRevision: createShortWorkspaceContentRevision("素材库概览"),
      readOnly: false,
      activeEntryId: "entry-long",
      entries: [
        {
          id: "entry-long",
          documentId: "document-long",
          stageId: "character" as const,
          title: "长人物资料",
          content: entrySnapshot,
          revision: createShortWorkspaceContentRevision(entrySnapshot),
          readOnly: false,
          truncated: true,
          originalLength: fullContent.length
        }
      ]
    };
    const activeResource = {
      id: "document-long",
      domain: "material" as const,
      title: "长人物资料",
      path: ["长素材库", "长人物资料"],
      source: "live-editor" as const,
      content: activeSnapshot,
      truncated: true as const,
      originalLength: fullContent.length
    };

    expect(() =>
      WorkspaceRuntimeContextSchema.parse({
        activeResource,
        libraryWorkspace: commonWorkspace
      })
    ).not.toThrow();

    const overviewWorkspace = {
      ...commonWorkspace,
      overview: entrySnapshot,
      overviewRevision: createShortWorkspaceContentRevision(entrySnapshot),
      overviewTruncated: true as const,
      overviewOriginalLength: fullContent.length,
      activeEntryId: undefined
    };
    expect(() =>
      WorkspaceRuntimeContextSchema.parse({
        activeResource: { ...activeResource, id: "overview-long" },
        libraryWorkspace: overviewWorkspace
      })
    ).not.toThrow();
    expect(() =>
      WorkspaceRuntimeContextSchema.parse({
        activeResource: { ...activeResource, id: "wrong-overview" },
        libraryWorkspace: overviewWorkspace
      })
    ).toThrow();
  });

  it("validates create and edit library mutation events", () => {
    const base = {
      sessionId: "session-library-edit",
      runId: "run-library-edit",
      toolCallId: "tool-library-edit",
      domain: "material" as const,
      libraryId: "material-library-1",
      stageId: "character",
      title: "人物甲",
      text: "更新后正文",
      baseRevision: createShortWorkspaceContentRevision("更新前正文"),
      baseProjectRevision: 3,
      summary: "已生成条目修改。",
      runtime
    };
    const context = {
      sessionId: base.sessionId,
      runId: base.runId
    };
    expect(
      SystemEventEnvelopeSchema.parse(
        createEnvelope(
          "library.editor_mutation",
          {
            ...base,
            operation: "edit" as const,
            entryId: "entry-1",
            documentId: "document-1"
          },
          { id: "library-edit-event", context }
        )
      ).type
    ).toBe("library.editor_mutation");
    expect(
      SystemEventEnvelopeSchema.parse(
        createEnvelope(
          "library.editor_mutation",
          { ...base, operation: "create" as const },
          { id: "library-create-event", context }
        )
      ).type
    ).toBe("library.editor_mutation");
    const { stageId: _stageId, ...overviewBase } = base;
    expect(
      SystemEventEnvelopeSchema.parse(
        createEnvelope(
          "library.editor_mutation",
          {
            ...overviewBase,
            operation: "edit-overview" as const,
            documentId: "material-overview-1",
            title: "人物素材 · 库介绍",
            text: "更新后的库介绍"
          },
          { id: "library-overview-event", context }
        )
      ).type
    ).toBe("library.editor_mutation");
    expect(() =>
      SystemEventEnvelopeSchema.parse(
        createEnvelope(
          "library.editor_mutation",
          { ...base, operation: "edit" as const },
          { id: "library-bad-edit-event", context }
        )
      )
    ).toThrow();
  });
});
