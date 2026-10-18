import { describe, expect, it } from "vitest";
import {
  BOOK_CHARACTER_OVERVIEW_TITLE,
  CurrentBookProjectManifestSchema,
  CatalogProjectManifestSchema,
  CatalogSnapshotSchema,
  MATERIAL_KINDS,
  SKILL_KINDS,
  createDefaultBookPlotStages
} from "./index";

const now = "2026-07-18T10:00:00.000Z";

describe("legacy catalog manifests and snapshots", () => {
  it("validates a normalized catalog snapshot", () => {
    const snapshot = CatalogSnapshotSchema.parse({
      schemaVersion: 1,
      revision: 3,
      books: [
        {
          id: "book-1",
          title: "雨夜来信",
          bookType: "short",
          genre: "悬疑",
          status: "editing",
          linkedMaterialIdsByKind: {
            character: ["material-1"],
            gimmick: [],
            plot: [],
            draft: [],
            other: []
          },
          linkedSkillIdsByKind: {
            general: ["skill-1"],
            plot: [],
            style: [],
            other: []
          },
          documents: [
            {
              id: "draft",
              title: "正文编写",
              content: "窗外正在下雨。",
              createdAt: now,
              updatedAt: now
            }
          ],
          createdAt: now,
          updatedAt: now
        }
      ],
      materials: [
        {
          id: "material-1",
          title: "人物素材",
          materialType: "short",
          materialKind: "character",
          parentGenre: "悬疑",
          subGenre: "",
          overview: "",
          entries: [
            {
              id: "material-entry-1",
              stageId: "character",
              title: "守夜人",
              body: "沉默寡言。",
              createdAt: now,
              updatedAt: now
            }
          ],
          createdAt: now,
          updatedAt: now
        }
      ],
      materialGroups: [],
      skills: [
        {
          id: "skill-1",
          title: "通用技能",
          skillType: "short",
          skillKind: "general",
          overview: "",
          isBuiltin: false,
          entries: [],
          createdAt: now,
          updatedAt: now
        }
      ],
      skillGroups: [],
      updatedAt: now
    });

    expect(snapshot.books[0]?.linkedMaterialIdsByKind.character).toEqual([
      "material-1"
    ]);
    expect(snapshot.books[0]?.plotStages.map(({ id }) => id)).toEqual([
      "worldbuilding",
      "plot_design",
      "intro_design",
      "plot_refine",
      "narrative_perspective",
      "outline"
    ]);
    expect(snapshot.books[0]?.documents.map(({ id }) => id)).toEqual([
      "worldbuilding",
      "plot_design",
      "intro_design",
      "plot_refine",
      "narrative_perspective",
      "outline",
      "character_design"
    ]);
    expect(
      snapshot.books[0]?.draft.sections.find((section) => section.body.content)
        ?.body.content
    ).toBe("窗外正在下雨。");
    expect(snapshot.books[0]?.draft.sections[0]?.characterState.content).toBe(
      ""
    );
    expect(MATERIAL_KINDS).toHaveLength(5);
    expect(SKILL_KINDS).toHaveLength(4);
  });

  it("validates folder manifests that reference external Markdown content", () => {
    const common = {
      schemaVersion: 1 as const,
      revision: 2,
      id: "project-1",
      title: "雨夜来信",
      createdAt: now,
      updatedAt: now
    };
    const manifests = [
      {
        ...common,
        kind: "deepwrite.book" as const,
        bookType: "short" as const,
        genre: "悬疑" as const,
        status: "editing" as const,
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
            id: "draft",
            title: "正文编写",
            path: "stages/draft.md",
            createdAt: now,
            updatedAt: now
          }
        ]
      },
      {
        ...common,
        kind: "deepwrite.material-library" as const,
        materialType: "short" as const,
        materialKind: "character" as const,
        parentGenre: "悬疑",
        subGenre: "",
        overview: "",
        entries: [
          {
            id: "material-entry-1",
            stageId: "character" as const,
            title: "守夜人",
            path: "entries/守夜人.md",
            createdAt: now,
            updatedAt: now
          }
        ]
      },
      {
        ...common,
        kind: "deepwrite.skill-library" as const,
        skillType: "short" as const,
        skillKind: "general" as const,
        overview: "",
        isBuiltin: false,
        entries: [
          {
            id: "skill-entry-1",
            stageId: "draft" as const,
            title: "正文技能",
            path: "entries/正文技能.md",
            createdAt: now,
            updatedAt: now
          }
        ]
      },
      {
        ...common,
        kind: "deepwrite.material-group" as const,
        members: { character: "material-1" }
      },
      {
        ...common,
        kind: "deepwrite.skill-group" as const,
        members: { general: "skill-1" }
      }
    ];

    expect(
      manifests.map(
        (manifest) => CatalogProjectManifestSchema.parse(manifest).kind
      )
    ).toEqual([
      "deepwrite.book",
      "deepwrite.material-library",
      "deepwrite.skill-library",
      "deepwrite.material-group",
      "deepwrite.skill-group"
    ]);
  });

  it("rejects unsafe project paths and inline project content", () => {
    const bookManifest = {
      schemaVersion: 1,
      revision: 0,
      kind: "deepwrite.book",
      id: "book-1",
      title: "越界测试",
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
          id: "draft",
          title: "正文编写",
          path: "../draft.md",
          content: "不应写进清单",
          createdAt: now,
          updatedAt: now
        }
      ],
      createdAt: now,
      updatedAt: now
    };

    expect(() => CatalogProjectManifestSchema.parse(bookManifest)).toThrow();
    expect(() =>
      CatalogProjectManifestSchema.parse({
        ...bookManifest,
        documents: [{ ...bookManifest.documents[0], path: "stages/draft.md" }]
      })
    ).toThrow();
  });

  it("migrates legacy list character overview title to 概览", () => {
    const plotStages = createDefaultBookPlotStages();
    const parsed = CurrentBookProjectManifestSchema.parse({
      schemaVersion: 4,
      revision: 1,
      kind: "deepwrite.book",
      id: "book-overview-title",
      title: "概览标题迁移",
      bookType: "short",
      genre: "悬疑",
      status: "editing",
      characterStructure: { format: "list", items: [] },
      plotStages,
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
          id: "character_design",
          title: "人物概览",
          path: "stages/character_design.md",
          createdAt: now,
          updatedAt: now
        },
        ...plotStages.map((stage) => ({
          id: stage.id,
          title: stage.title,
          path: `stages/${stage.id}.md`,
          createdAt: now,
          updatedAt: now
        }))
      ],
      draft: {
        id: "draft",
        title: "正文编写",
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
    expect(
      parsed.documents.find(({ id }) => id === "character_design")?.title
    ).toBe(BOOK_CHARACTER_OVERVIEW_TITLE);
  });
});
