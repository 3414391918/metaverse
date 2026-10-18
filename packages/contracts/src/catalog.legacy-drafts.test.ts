import { describe, expect, it } from "vitest";
import {
  BookProjectDraftSectionManifestSchema,
  CatalogDocumentSchema,
  CatalogDraftSectionSchema,
  CatalogDraftRecoverySchema,
  CatalogProjectManifestSchema,
  CatalogSnapshotSchema,
  CreateDraftSectionInputSchema,
  CreateDraftSectionsInputSchema,
  CreateDraftSectionsResultSchema,
  CreateShortBookInputSchema,
  BookPlotStagesSchema,
  CreativePlotStagesSchema,
  MutatePlotStructureInputSchema,
  catalogDraftBodyDocumentId,
  catalogDraftCharacterStateDocumentId,
  createDefaultBookPlotStages,
  createDefaultCreativePlotStages,
  isBuiltinCreativePlotStageId,
  parseCatalogDraftDocumentId
} from "./index";

const now = "2026-07-18T10:00:00.000Z";

describe("legacy catalog draft shapes", () => {
  it("requires versioned plot mutations and enforces stable structure bounds", () => {
    const defaults = createDefaultCreativePlotStages();
    expect(CreativePlotStagesSchema.parse(defaults)).toEqual(defaults);
    expect(
      CreativePlotStagesSchema.safeParse([
        ...defaults,
        ...Array.from({ length: 28 }, (_, index) => ({
          id: `custom_${index}`,
          title: `自定义结构 ${index}`,
          description: "结构说明"
        }))
      ]).success
    ).toBe(false);
    expect(
      CreativePlotStagesSchema.safeParse([
        ...defaults,
        { id: "custom", title: "剧情设计", description: "重名" }
      ]).success
    ).toBe(false);
    expect(
      MutatePlotStructureInputSchema.safeParse({
        bookId: "book_1",
        mutation: {
          type: "create",
          title: "自定义结构",
          description: "结构说明"
        }
      }).success
    ).toBe(false);
    expect(
      MutatePlotStructureInputSchema.safeParse({
        bookId: "book_1",
        baseProjectRevision: 0,
        force: true,
        mutation: {
          type: "create",
          stageId: "plot-stage-agent:stable-1",
          title: "自定义结构",
          description: "结构说明"
        }
      }).success
    ).toBe(true);
    const newBookStages = createDefaultBookPlotStages();
    expect(newBookStages.map(({ id }) => id)).toEqual([
      "worldbuilding",
      "plot_design",
      "intro_design",
      "plot_refine",
      "narrative_perspective",
      "outline"
    ]);
    expect(
      newBookStages.filter((stage) => stage.enabled).map(({ id }) => id)
    ).toEqual(["plot_design", "intro_design", "plot_refine"]);
    expect(
      newBookStages.find((stage) => stage.id === "worldbuilding")?.enabled
    ).toBe(false);
    expect(
      createDefaultBookPlotStages({ enabledStageIds: ["intro_design"] })
        .filter((stage) => stage.enabled)
        .map(({ id }) => id)
    ).toEqual(["intro_design"]);
    expect(BookPlotStagesSchema.parse(newBookStages)).toEqual(newBookStages);
    expect(
      BookPlotStagesSchema.safeParse(
        newBookStages.map((stage) => ({ ...stage, enabled: false }))
      ).success
    ).toBe(false);
    expect(isBuiltinCreativePlotStageId("plot_design")).toBe(true);
    expect(isBuiltinCreativePlotStageId("custom")).toBe(false);
    expect(
      MutatePlotStructureInputSchema.safeParse({
        bookId: "book_1",
        baseProjectRevision: 0,
        mutation: {
          type: "setEnabled",
          stageId: "outline",
          enabled: true
        }
      }).success
    ).toBe(true);
  });

  it("round-trips draft section document ids through parseCatalogDraftDocumentId", () => {
    const sectionId = "pending:section:1";
    expect(
      parseCatalogDraftDocumentId(catalogDraftBodyDocumentId(sectionId))
    ).toEqual({
      sectionId,
      fileKind: "body"
    });
    expect(
      parseCatalogDraftDocumentId(
        catalogDraftCharacterStateDocumentId(sectionId)
      )
    ).toEqual({
      sectionId,
      fileKind: "character-state"
    });
    expect(parseCatalogDraftDocumentId("draft-section:only")).toBeUndefined();
    expect(parseCatalogDraftDocumentId("other:x:body")).toBeUndefined();
  });

  it("keeps draft section ids and titles within the Agent snapshot boundary", () => {
    const sectionId = "s".repeat(120);
    const sectionTitle = "节".repeat(240);
    const catalogDocument = (id: string, title: string) => ({
      id,
      title,
      content: "",
      createdAt: now,
      updatedAt: now
    });
    const manifestDocument = (id: string, title: string, path: string) => ({
      id,
      title,
      path,
      createdAt: now,
      updatedAt: now
    });
    const catalogSection = {
      id: sectionId,
      title: sectionTitle,
      wordCountRequirement: "",
      body: catalogDocument(catalogDraftBodyDocumentId(sectionId), "正文"),
      characterState: catalogDocument(
        catalogDraftCharacterStateDocumentId(sectionId),
        "人物状态"
      ),
      createdAt: now,
      updatedAt: now
    };
    const manifestSection = {
      ...catalogSection,
      body: manifestDocument(
        catalogDraftBodyDocumentId(sectionId),
        "正文",
        "stages/draft/body.md"
      ),
      characterState: manifestDocument(
        catalogDraftCharacterStateDocumentId(sectionId),
        "人物状态",
        "stages/draft/state.md"
      )
    };

    expect(CatalogDraftSectionSchema.safeParse(catalogSection).success).toBe(
      true
    );
    expect(
      BookProjectDraftSectionManifestSchema.safeParse(manifestSection).success
    ).toBe(true);
    expect(
      CatalogDraftSectionSchema.safeParse({
        ...catalogSection,
        body: { ...catalogSection.body, id: "custom-body" }
      }).success
    ).toBe(false);
    expect(
      BookProjectDraftSectionManifestSchema.safeParse({
        ...manifestSection,
        characterState: {
          ...manifestSection.characterState,
          id: "custom-character-state"
        }
      }).success
    ).toBe(false);
    expect(
      CreateDraftSectionInputSchema.safeParse({
        bookId: "book-1",
        afterSectionId: sectionId,
        title: sectionTitle
      }).success
    ).toBe(true);
    expect(
      CreateDraftSectionsInputSchema.safeParse({
        operationId: "run-1:proposal-1:revision-1",
        bookId: "book-1",
        afterSectionId: sectionId,
        sections: [
          {
            clientSectionId: "provisional:section:1",
            title: "第一批新小节"
          },
          {
            clientSectionId: "provisional:section:2",
            title: "第二批新小节"
          }
        ]
      }).success
    ).toBe(true);
    expect(
      CreateDraftSectionsInputSchema.safeParse({
        operationId: "run-1:proposal-1:revision-1",
        bookId: "book-1",
        sections: [
          { clientSectionId: "provisional:section:1" },
          { clientSectionId: "provisional:section:1" }
        ]
      }).success
    ).toBe(false);
    expect(
      CreateDraftSectionsResultSchema.safeParse({
        operationId: "run-1:proposal-1:revision-1",
        bookId: "book-1",
        projectRevision: 3,
        sections: [
          {
            clientSectionId: "provisional:section:1",
            section: catalogSection
          }
        ]
      }).success
    ).toBe(true);

    expect(
      CatalogDraftSectionSchema.safeParse({
        ...catalogSection,
        id: `${sectionId}x`
      }).success
    ).toBe(false);
    expect(
      BookProjectDraftSectionManifestSchema.safeParse({
        ...manifestSection,
        title: `${sectionTitle}节`
      }).success
    ).toBe(false);
    expect(
      CreateDraftSectionInputSchema.safeParse({
        bookId: "book-1",
        title: `${sectionTitle}节`
      }).success
    ).toBe(false);

    expect(
      CatalogDocumentSchema.safeParse(
        catalogDocument("i".repeat(512), "项目标题".repeat(64))
      ).success
    ).toBe(true);
  });

  it("prefers the legacy draft document id over an earlier title-only match", () => {
    const snapshot = CatalogSnapshotSchema.parse({
      schemaVersion: 1,
      revision: 1,
      books: [
        {
          id: "book-draft-priority",
          title: "正文识别优先级",
          bookType: "short",
          genre: "其他",
          status: "editing",
          linkedMaterialIdsByKind: {
            character: [],
            gimmick: [],
            plot: [],
            draft: [],
            other: []
          },
          linkedSkillIdsByKind: {
            general: [],
            plot: [],
            style: [],
            other: []
          },
          documents: [
            {
              id: "notes",
              title: "正文编写",
              content: "同名普通文档",
              createdAt: now,
              updatedAt: now
            },
            {
              id: "draft",
              title: "真正正文",
              content: "必须迁移的正文",
              createdAt: now,
              updatedAt: now
            }
          ],
          createdAt: now,
          updatedAt: now
        }
      ],
      materials: [],
      materialGroups: [],
      skills: [],
      skillGroups: [],
      updatedAt: now
    });

    expect(
      snapshot.books[0]?.documents.find(({ id }) => id === "notes")
    ).toMatchObject({
      id: "notes",
      content: "同名普通文档"
    });
    expect(
      snapshot.books[0]?.draft.sections.find(({ id }) => id === "section-1")
        ?.body.content
    ).toBe("必须迁移的正文");
  });

  it("accepts opaque recovery document keys larger than one catalog id", () => {
    const compositeKey = `catalog:material-entry:${"书".repeat(4_000)}`;
    expect(
      CatalogDraftRecoverySchema.parse({
        [compositeKey]: {
          title: "长标识草稿",
          content: "未保存内容",
          dirty: true
        }
      })[compositeKey]?.content
    ).toBe("未保存内容");
  });

  it("validates the v2 draft directory as paired physical files", () => {
    const manifest = CatalogProjectManifestSchema.parse({
      schemaVersion: 2,
      revision: 4,
      kind: "deepwrite.book",
      id: "book-v2",
      title: "分文件正文",
      bookType: "short",
      genre: "悬疑",
      status: "editing",
      linkedMaterialIdsByKind: {
        character: [],
        gimmick: [],
        plot: [],
        draft: [],
        other: []
      },
      linkedSkillIdsByKind: {
        general: [],
        plot: [],
        style: [],
        other: []
      },
      documents: [],
      draft: {
        id: "draft",
        title: "正文",
        sections: [
          {
            id: "section-1",
            title: "第一节",
            wordCountRequirement: "1200字",
            body: {
              id: "draft-section:section-1:body",
              title: "第一节",
              path: "stages/draft/section-1.body.md",
              createdAt: now,
              updatedAt: now
            },
            characterState: {
              id: "draft-section:section-1:character-state",
              title: "第一节 · 人物状态",
              path: "stages/draft/section-1.state.md",
              createdAt: now,
              updatedAt: now
            },
            createdAt: now,
            updatedAt: now
          }
        ],
        createdAt: now,
        updatedAt: now
      },
      createdAt: now,
      updatedAt: now
    });

    expect(manifest.schemaVersion).toBe(2);
    expect(manifest.kind).toBe("deepwrite.book");
    if (manifest.kind !== "deepwrite.book" || manifest.schemaVersion !== 2) {
      throw new Error("Expected a v2 book manifest.");
    }
    expect(manifest.draft.sections[0]?.body.path).toBe(
      "stages/draft/section-1.body.md"
    );
    expect(() =>
      CatalogProjectManifestSchema.parse({
        ...manifest,
        draft: {
          ...manifest.draft,
          sections: manifest.draft.sections.map((section) => ({
            ...section,
            characterState: {
              ...section.characterState,
              path: section.body.path
            }
          }))
        }
      })
    ).toThrow();
  });

  it("rejects blank titles and duplicate binding ids", () => {
    expect(() =>
      CreateShortBookInputSchema.parse({ title: "  ", genre: "其他" })
    ).toThrow();
    expect(() =>
      CreateShortBookInputSchema.parse({
        title: "重复绑定",
        genre: "其他",
        linkedMaterialIdsByKind: {
          plot: ["material-1", "material-1"]
        }
      })
    ).toThrow();
  });
});
