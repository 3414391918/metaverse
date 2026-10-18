import { describe, expect, it } from "vitest";
import {
  CatalogIndexSnapshotSchema,
  CatalogSnapshotSchema,
  catalogDraftBodyDocumentId,
  catalogDraftCharacterStateDocumentId,
  type CatalogSnapshot
} from "@deepwrite/contracts";
import type { ResourceTreeNode } from "../types/workspace";
import { projectCatalogWorkspace } from "./catalogWorkspace";

const NOW = "2026-07-18T08:00:00.000Z";

function fixture(): CatalogSnapshot {
  return CatalogSnapshotSchema.parse({
    schemaVersion: 1,
    revision: 7,
    updatedAt: NOW,
    books: [
      {
        id: "book-short",
        title: "迁移短篇",
        bookType: "short",
        genre: "悬疑",
        status: "editing",
        linkedMaterialIdsByKind: {
          character: ["material-mixed"],
          gimmick: [],
          plot: ["material-plot"],
          draft: ["material-mixed"],
          other: []
        },
        linkedSkillIdsByKind: {
          general: ["skill-general"],
          plot: [],
          style: [],
          other: []
        },
        documents: [
          {
            id: "character_design",
            title: "人物设计",
            content: "人物",
            createdAt: NOW,
            updatedAt: NOW
          },
          {
            id: "plot_design",
            title: "剧情设计",
            content: "剧情",
            createdAt: NOW,
            updatedAt: NOW
          },
          {
            id: "intro_design",
            title: "导语设计",
            content: "导语",
            createdAt: NOW,
            updatedAt: NOW
          },
          {
            id: "plot_refine",
            title: "剧情细化",
            content: "细化",
            createdAt: NOW,
            updatedAt: NOW
          },
          {
            id: "outline",
            title: "大纲",
            content: "大纲",
            createdAt: NOW,
            updatedAt: NOW
          },
          {
            id: "notes",
            title: "迁移备注",
            content: "备注",
            createdAt: NOW,
            updatedAt: NOW
          }
        ],
        draft: {
          id: "draft",
          title: "正文",
          sections: [
            {
              id: "intro",
              title: "导语",
              wordCountRequirement: "300 字",
              body: {
                id: catalogDraftBodyDocumentId("intro"),
                title: "导语",
                content: "导语正文",
                createdAt: NOW,
                updatedAt: NOW
              },
              characterState: {
                id: catalogDraftCharacterStateDocumentId("intro"),
                title: "导语 · 人物状态",
                content: "导语状态",
                createdAt: NOW,
                updatedAt: NOW
              },
              createdAt: NOW,
              updatedAt: NOW
            },
            {
              id: "section-1",
              title: "第一节",
              wordCountRequirement: "1000 字",
              body: {
                id: catalogDraftBodyDocumentId("section-1"),
                title: "第一节",
                content: "正文",
                createdAt: NOW,
                updatedAt: NOW
              },
              characterState: {
                id: catalogDraftCharacterStateDocumentId("section-1"),
                title: "第一节 · 人物状态",
                content: "人物状态",
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
      }
    ],
    materials: [
      {
        id: "material-plot",
        title: "世情剧情素材",
        materialType: "short",
        materialKind: "plot",
        parentGenre: "世情",
        subGenre: "家庭",
        overview: "剧情素材说明",
        entries: [
          {
            id: "material-pacing",
            stageId: "pacing",
            title: "剧情节拍",
            body: "节拍正文",
            createdAt: NOW,
            updatedAt: NOW
          },
          {
            id: "material-intro",
            stageId: "intro",
            title: "导语钩子",
            body: "钩子正文",
            createdAt: NOW,
            updatedAt: NOW
          }
        ],
        createdAt: NOW,
        updatedAt: NOW
      },
      {
        id: "material-mixed",
        title: "综合素材",
        materialType: "short",
        materialKind: "mixed",
        parentGenre: "追妻",
        subGenre: "重生",
        overview: "综合素材说明",
        entries: [
          {
            id: "material-character",
            stageId: "character",
            title: "人物反差",
            body: "人物正文",
            createdAt: NOW,
            updatedAt: NOW
          },
          {
            id: "material-draft",
            stageId: "draft_excerpt",
            title: "正文片段",
            body: "片段正文",
            createdAt: NOW,
            updatedAt: NOW
          }
        ],
        createdAt: NOW,
        updatedAt: NOW
      }
    ],
    materialGroups: [
      {
        id: "material-group",
        title: "追妻素材套装",
        members: {
          character: "material-mixed",
          plot: "material-plot",
          draft: "missing-material"
        },
        createdAt: NOW,
        updatedAt: NOW
      }
    ],
    skills: [
      {
        id: "skill-general",
        title: "通用短篇技能",
        skillType: "short",
        skillKind: "general",
        overview: "技能说明",
        isBuiltin: false,
        entries: [
          {
            id: "skill-character",
            stageId: "character_design",
            title: "人物方法",
            body: "人物技能正文",
            createdAt: NOW,
            updatedAt: NOW
          },
          {
            id: "skill-draft",
            stageId: "draft",
            title: "正文方法",
            body: "正文技能正文",
            createdAt: NOW,
            updatedAt: NOW
          }
        ],
        createdAt: NOW,
        updatedAt: NOW
      },
      {
        id: "skill-plot",
        title: "剧情设计方法",
        skillType: "short",
        skillKind: "plot",
        overview: "剧情技能说明",
        isBuiltin: false,
        entries: [],
        createdAt: NOW,
        updatedAt: NOW
      }
    ],
    skillGroups: [
      {
        id: "skill-group",
        title: "短篇技能套装",
        members: { general: "skill-general", style: "missing-skill" },
        createdAt: NOW,
        updatedAt: NOW
      }
    ]
  });
}

function flattenNodes(nodes: readonly ResourceTreeNode[]): ResourceTreeNode[] {
  return nodes.flatMap((node) => [node, ...flattenNodes(node.children ?? [])]);
}

describe("catalog workspace projection", () => {
  it("projects a metadata-only index without treating unloaded bodies as empty", () => {
    const source = fixture();
    const byteLength = (value: string): number =>
      new TextEncoder().encode(value).byteLength;
    const fileStamp = (value: string): string =>
      `fs-v1:${byteLength(value)}:1:1`;
    const manifestStamp = (value: string): string =>
      `manifest-v1:${byteLength(value)}:${NOW}`;
    const index = CatalogIndexSnapshotSchema.parse({
      ...source,
      books: source.books.map((book) => ({
        ...book,
        documents: book.documents.map((document) => ({
          ...document,
          content: "",
          contentBytes: byteLength(document.content),
          contentStamp: fileStamp(document.content)
        })),
        draft: {
          ...book.draft,
          sections: book.draft.sections.map((section) => ({
            ...section,
            body: {
              ...section.body,
              content: "",
              contentBytes: byteLength(section.body.content),
              contentStamp: fileStamp(section.body.content)
            },
            characterState: {
              ...section.characterState,
              content: "",
              contentBytes: byteLength(section.characterState.content),
              contentStamp: fileStamp(section.characterState.content)
            }
          }))
        }
      })),
      materials: source.materials.map((library) => ({
        ...library,
        overview: "",
        overviewContentBytes: byteLength(library.overview),
        overviewContentStamp: manifestStamp(library.overview),
        entries: library.entries.map((entry) => ({
          ...entry,
          body: "",
          contentBytes: byteLength(entry.body),
          contentStamp: fileStamp(entry.body)
        }))
      })),
      skills: source.skills.map((library) => ({
        ...library,
        overview: "",
        overviewContentBytes: byteLength(library.overview),
        overviewContentStamp: manifestStamp(library.overview),
        entries: library.entries.map((entry) => ({
          ...entry,
          body: "",
          contentBytes: byteLength(entry.body),
          contentStamp: fileStamp(entry.body)
        }))
      }))
    });

    const projection = projectCatalogWorkspace(index);
    const materialOverview = projection.workspaceDocuments.find(
      (document) =>
        document.libraryId === "material-plot" &&
        document.catalogLibraryField === "overview"
    )!;
    const overviewResourceId = projection.index.resourceIdByDocumentId.get(
      materialOverview.id
    )!;

    expect(projection.resourceSections[0]?.nodes).toEqual([]);
    expect(
      projection.workspaceDocuments.some(
        (document) => document.domain === "creation"
      )
    ).toBe(false);
    expect(materialOverview).toMatchObject({
      content: "",
      catalogContentBytes: byteLength("剧情素材说明"),
      catalogContentLoaded: false
    });
    expect(
      projection.index.resourceNodeById.get(overviewResourceId)?.muted
    ).toBe(false);
  });

  it("moves grouped material libraries out of their purpose categories", () => {
    const source = fixture();
    const projection = projectCatalogWorkspace(source);
    const materialSection = projection.resourceSections.find(
      (section) => section.id === "material"
    )!;
    const nodes = flattenNodes(materialSection.nodes);

    expect(materialSection.nodes.map((node) => node.label)).toEqual([
      "追妻素材套装"
    ]);

    const materialGroup = materialSection.nodes[0];
    expect(materialGroup).toMatchObject({
      label: "追妻素材套装",
      catalogNodeType: "group"
    });
    expect(materialGroup?.badge).toBeUndefined();
    expect(materialGroup?.children?.map((node) => node.label)).toEqual([
      "综合素材",
      "世情剧情素材",
      "已丢失的素材库（missing-material）"
    ]);
    expect(materialGroup?.children?.map((node) => node.categoryTag)).toEqual([
      "人设",
      "剧情",
      "正文"
    ]);

    const plotCategory = materialSection.nodes.find(
      (node) => node.label === "剧情"
    );
    const otherCategory = materialSection.nodes.find(
      (node) => node.label === "其他"
    );
    expect(plotCategory).toBeUndefined();
    expect(otherCategory).toBeUndefined();
    expect(nodes.filter((node) => node.id === "material-plot")).toHaveLength(1);
    expect(nodes.filter((node) => node.id === "material-mixed")).toHaveLength(
      1
    );
    expect(nodes.some((node) => node.label === "世情")).toBe(false);
    expect(nodes.some((node) => node.label === "家庭")).toBe(false);
    expect(nodes.some((node) => node.label === "综合素材库")).toBe(false);
    expect(
      nodes.some(
        (node) => node.catalogNodeType === "category" && node.stageCategoryId
      )
    ).toBe(false);
    expect(
      nodes.some(
        (node) => node.label === "剧情节拍" && node.stageCategoryId === "pacing"
      )
    ).toBe(true);
    expect(
      nodes.some(
        (node) => node.label.includes("missing-material") && node.muted
      )
    ).toBe(true);

    const entryDocuments = projection.workspaceDocuments.filter(
      (document) => document.domain === "material" && document.catalogEntryId
    );
    expect(entryDocuments).toHaveLength(
      source.materials.reduce(
        (count, library) => count + library.entries.length,
        0
      )
    );
    expect(
      entryDocuments.find(
        (document) => document.catalogEntryId === "material-pacing"
      )
    ).toMatchObject({
      libraryId: "material-plot",
      materialKind: "plot",
      stageCategoryId: "pacing",
      parentGenre: "世情",
      subGenre: "家庭",
      content: "节拍正文"
    });
    expect(
      entryDocuments.find(
        (document) => document.catalogEntryId === "material-pacing"
      )?.path
    ).toContain("家庭");
    const materialOverview = projection.workspaceDocuments.find(
      (document) =>
        document.domain === "material" &&
        document.libraryId === "material-plot" &&
        document.catalogLibraryField === "overview"
    );
    expect(materialOverview).toMatchObject({
      content: "剧情素材说明",
      catalogLibraryField: "overview"
    });
    expect(materialOverview?.readOnly).toBeUndefined();
  });

  it("shows skill groups directly and moves their libraries out of kind categories", () => {
    const source = fixture();
    const projection = projectCatalogWorkspace(source);
    const skillSection = projection.resourceSections.find(
      (section) => section.id === "skill"
    )!;
    const nodes = flattenNodes(skillSection.nodes);

    expect(skillSection.nodes.map((node) => node.label)).toEqual([
      "短篇技能套装",
      "剧情设计技能库"
    ]);
    expect(nodes.some((node) => node.label === "技能库分组")).toBe(false);
    expect(
      nodes.some(
        (node) =>
          node.label === "短篇技能套装" && node.catalogNodeType === "group"
      )
    ).toBe(true);
    expect(
      nodes.some(
        (node) => node.label === "通用技能库" && node.skillKind === "general"
      )
    ).toBe(false);
    expect(
      nodes.some(
        (node) =>
          node.label === "人物方法" &&
          node.stageCategoryId === "character_design"
      )
    ).toBe(true);
    expect(
      nodes.some(
        (node) => node.label === "正文方法" && node.stageCategoryId === "draft"
      )
    ).toBe(true);
    expect(
      nodes.some((node) => node.label.includes("missing-skill") && node.muted)
    ).toBe(true);

    const skillGroup = nodes.find(
      (node) =>
        node.label === "短篇技能套装" && node.catalogNodeType === "group"
    );
    expect(skillGroup?.badge).toBeUndefined();
    expect(skillGroup?.children?.map((node) => node.label)).toEqual([
      "通用短篇技能",
      "已丢失的技能库（missing-skill）"
    ]);
    expect(skillGroup?.children?.map((node) => node.categoryTag)).toEqual([
      "通用",
      "文风"
    ]);

    const generalKind = skillSection.nodes.find(
      (node) => node.skillKind === "general"
    );
    const plotKind = skillSection.nodes.find(
      (node) => node.skillKind === "plot"
    );
    const generalLibrary = skillGroup?.children?.find(
      (node) => node.id === "skill-general"
    );
    expect(generalKind).toBeUndefined();
    expect(plotKind?.children?.map((node) => node.id)).toEqual(["skill-plot"]);
    expect(nodes.filter((node) => node.id === "skill-general")).toHaveLength(1);
    expect(generalLibrary?.categoryTag).toBe("通用");
    expect(generalLibrary?.badge).toBeUndefined();
    expect(generalLibrary?.children?.map((node) => node.label)).toEqual([
      "库说明",
      "人物方法",
      "正文方法"
    ]);
    expect(
      generalLibrary?.children?.some(
        (node) => node.catalogNodeType === "category"
      )
    ).toBe(false);

    const skillDocuments = projection.workspaceDocuments.filter(
      (document) => document.domain === "skill" && document.catalogEntryId
    );
    expect(skillDocuments).toHaveLength(
      source.skills.reduce(
        (count, library) => count + library.entries.length,
        0
      )
    );
    expect(skillDocuments[0]).toMatchObject({
      libraryId: "skill-general",
      skillKind: "general",
      stageCategoryId: "character_design",
      content: "人物技能正文"
    });
    const skillOverview = projection.workspaceDocuments.find(
      (document) =>
        document.domain === "skill" &&
        document.libraryId === "skill-general" &&
        document.catalogLibraryField === "overview"
    );
    expect(skillOverview).toMatchObject({
      content: "技能说明",
      catalogLibraryField: "overview"
    });
    expect(skillOverview?.readOnly).toBeUndefined();
  });

  it("keeps builtin skill-library overviews read-only", () => {
    const source = fixture();
    source.skills[0] = { ...source.skills[0]!, isBuiltin: true };
    const overview = projectCatalogWorkspace(source).workspaceDocuments.find(
      (document) =>
        document.domain === "skill" &&
        document.libraryId === "skill-general" &&
        document.catalogLibraryField === "overview"
    );
    expect(overview?.readOnly).toBe(true);
  });

  it("generates collision-free editor ids across books and libraries", () => {
    const projection = projectCatalogWorkspace(fixture());
    const ids = projection.workspaceDocuments.map((document) => document.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
