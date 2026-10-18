import { describe, expect, it } from "vitest";
import {
  CATALOG_LIBRARY_ENTRY_MAX_CHARACTERS,
  CATALOG_LIBRARY_OVERVIEW_MAX_CHARACTERS,
  CommandEnvelopeSchema,
  CreateLibraryInputSchema,
  UpdateLibraryInputSchema,
  MoveLibraryEntryInputSchema,
  CreateLibraryEntryInputSchema,
  CreateLibraryGroupInputSchema,
  ImportLegacyLibraryResultSchema,
  SaveDocumentResultSchema,
  SaveLibraryEntryInputSchema,
  UpdateLibraryGroupInputSchema,
  createEnvelope
} from "./index";

const now = "2026-07-18T10:00:00.000Z";

describe("shared catalog commands and libraries", () => {
  it("requires a classification when creating material and skill libraries", () => {
    expect(
      CreateLibraryInputSchema.parse({
        domain: "material",
        name: "人物素材",
        materialKind: "character"
      })
    ).toMatchObject({ materialKind: "character" });
    expect(
      CreateLibraryInputSchema.parse({
        domain: "skill",
        name: "剧情技能",
        skillKind: "plot"
      })
    ).toMatchObject({ skillKind: "plot" });
    expect(() =>
      CreateLibraryInputSchema.parse({ domain: "material", name: "未分类素材" })
    ).toThrow();
    expect(() =>
      CreateLibraryInputSchema.parse({
        domain: "material",
        name: "综合素材",
        materialKind: "mixed"
      })
    ).toThrow();
  });

  it("returns an authoritative nonnegative project revision after saving a document", () => {
    const result = {
      id: "draft-section:section-1:body",
      title: "第一节",
      content: "新的正文",
      createdAt: now,
      updatedAt: now,
      projectRevision: 7
    };

    expect(SaveDocumentResultSchema.parse(result)).toEqual(result);
    expect(
      SaveDocumentResultSchema.safeParse({ ...result, projectRevision: -1 })
        .success
    ).toBe(false);
    expect(
      SaveDocumentResultSchema.safeParse({
        ...result,
        unexpected: "must not cross the IPC boundary"
      }).success
    ).toBe(false);
  });

  it("validates multi-archive legacy library import results", () => {
    const result = ImportLegacyLibraryResultSchema.parse({
      imported: [],
      failures: [
        { fileName: "损坏素材库.zip", message: "缺少 metadata.json。" }
      ]
    });

    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]?.fileName).toBe("损坏素材库.zip");
  });

  it("accepts optional library selections when creating groups", () => {
    expect(
      CreateLibraryGroupInputSchema.parse({
        domain: "material",
        name: "空素材分组",
        members: {}
      }).members
    ).toEqual({});
    expect(
      CommandEnvelopeSchema.parse(
        createEnvelope(
          "catalog.createLibraryGroup",
          {
            domain: "skill",
            name: "写作技能组",
            members: { general: "skill-general" }
          },
          { id: "catalog-create-library-group" }
        )
      ).type
    ).toBe("catalog.createLibraryGroup");
    expect(
      UpdateLibraryGroupInputSchema.parse({
        domain: "skill",
        groupId: "skill-group",
        title: "已重命名的技能组",
        members: { plot: "skill-plot" },
        baseProjectRevision: 2
      })
    ).toMatchObject({
      groupId: "skill-group",
      title: "已重命名的技能组",
      baseProjectRevision: 2
    });
    expect(
      CommandEnvelopeSchema.parse(
        createEnvelope(
          "catalog.updateLibraryGroup",
          {
            domain: "material",
            groupId: "material-group",
            members: {}
          },
          { id: "catalog-update-library-group" }
        )
      ).type
    ).toBe("catalog.updateLibraryGroup");
  });

  it("accepts semantic catalog command envelopes", () => {
    const commands = [
      createEnvelope("catalog.snapshot", {}, { id: "catalog-snapshot" }),
      createEnvelope(
        "catalog.createLibrary",
        {
          domain: "material" as const,
          name: "人物素材",
          materialKind: "character" as const
        },
        { id: "catalog-create-library" }
      ),
      createEnvelope(
        "catalog.openProject",
        { domain: "book" as const },
        { id: "catalog-open" }
      ),
      createEnvelope(
        "catalog.importLegacyLibrary",
        { domain: "material" as const },
        { id: "catalog-import-legacy-library" }
      ),
      createEnvelope(
        "catalog.createLibraryAtPath",
        {
          domain: "skill" as const,
          name: "剧情技能",
          skillKind: "plot" as const,
          parentDirectory: "/Users/writer/Skills"
        },
        { id: "catalog-create-library-at-path" }
      ),
      createEnvelope(
        "catalog.openProjectAtPath",
        {
          projectDirectory: "/Users/writer/Books/本地短篇",
          domain: "book" as const
        },
        { id: "catalog-open-at-path" }
      ),
      createEnvelope(
        "catalog.importLegacyLibraryAtPath",
        {
          domain: "skill" as const,
          archivePath: "/Users/writer/Exports/旧技能.zip",
          parentDirectory: "/Users/writer/Skills"
        },
        { id: "catalog-import-legacy-library-at-path" }
      ),
      createEnvelope(
        "catalog.updateBook",
        {
          bookId: "book-1",
          status: "completed" as const,
          baseProjectRevision: 2
        },
        { id: "catalog-update" }
      ),
      createEnvelope(
        "catalog.deleteBook",
        { bookId: "book-1" },
        { id: "catalog-delete" }
      ),
      createEnvelope(
        "catalog.saveDocument",
        {
          bookId: "book-1",
          documentId: "draft",
          content: "新正文",
          baseRevision: "revision-3",
          baseProjectRevision: 2
        },
        { id: "catalog-save-document" }
      ),
      createEnvelope(
        "catalog.saveLibraryEntry",
        {
          domain: "material" as const,
          libraryId: "material-1",
          entryId: "entry-1",
          content: "更新后的素材",
          baseRevision: "revision-2",
          baseProjectRevision: 4
        },
        { id: "catalog-save-library-entry" }
      ),
      createEnvelope(
        "catalog.createLibraryEntry",
        {
          domain: "material" as const,
          libraryId: "material-1",
          title: "新人物",
          content: "人物设定",
          stageId: "character" as const
        },
        { id: "catalog-create-library-entry" }
      ),
      createEnvelope(
        "catalog.chooseExternalLibraryEntries",
        { sourceKind: "directory" as const },
        { id: "catalog-choose-external-library-entries" }
      ),
      createEnvelope(
        "catalog.importLibraryEntries",
        {
          domain: "skill" as const,
          libraryId: "skill-1",
          baseProjectRevision: 2,
          entries: [{ title: "节奏检查", content: "检查正文节奏。" }]
        },
        { id: "catalog-import-library-entries" }
      ),
      createEnvelope(
        "catalog.updateLibrary",
        {
          domain: "material" as const,
          libraryId: "material-1",
          title: "新名称",
          baseProjectRevision: 1
        },
        { id: "catalog-update-library" }
      ),
      createEnvelope(
        "catalog.moveLibraryEntry",
        {
          domain: "material" as const,
          sourceLibraryId: "material-1",
          targetLibraryId: "material-2",
          entryId: "entry-1",
          targetStageId: "plot_refine" as const
        },
        { id: "catalog-move-library-entry" }
      ),
      createEnvelope(
        "catalog.removeLibraryEntry",
        {
          domain: "skill" as const,
          libraryId: "skill-1",
          entryId: "entry-1",
          baseProjectRevision: 5
        },
        { id: "catalog-remove-library-entry" }
      ),
      createEnvelope(
        "catalog.unregisterProject",
        { domain: "material" as const, projectId: "material-1" },
        { id: "catalog-unregister-project" }
      ),
      createEnvelope(
        "catalog.deleteProject",
        { domain: "skill" as const, projectId: "skill-1" },
        { id: "catalog-delete-project" }
      )
    ];

    expect(
      commands.map((command) => CommandEnvelopeSchema.parse(command).type)
    ).toEqual([
      "catalog.snapshot",
      "catalog.createLibrary",
      "catalog.openProject",
      "catalog.importLegacyLibrary",
      "catalog.createLibraryAtPath",
      "catalog.openProjectAtPath",
      "catalog.importLegacyLibraryAtPath",
      "catalog.updateBook",
      "catalog.deleteBook",
      "catalog.saveDocument",
      "catalog.saveLibraryEntry",
      "catalog.createLibraryEntry",
      "catalog.chooseExternalLibraryEntries",
      "catalog.importLibraryEntries",
      "catalog.updateLibrary",
      "catalog.moveLibraryEntry",
      "catalog.removeLibraryEntry",
      "catalog.unregisterProject",
      "catalog.deleteProject"
    ]);
  });

  it("constrains new entry stages to the selected library domain", () => {
    expect(
      CreateLibraryEntryInputSchema.parse({
        domain: "skill",
        libraryId: "skill-1",
        title: "正文写作",
        content: "技能正文",
        stageId: "draft"
      }).stageId
    ).toBe("draft");

    expect(() =>
      CreateLibraryEntryInputSchema.parse({
        domain: "skill",
        libraryId: "skill-1",
        title: "错误阶段",
        content: "技能正文",
        stageId: "character"
      })
    ).toThrow();
  });

  it("accepts library metadata updates and entry move payloads", () => {
    expect(
      UpdateLibraryInputSchema.parse({
        domain: "skill",
        libraryId: "skill-1",
        title: "新技能库"
      })
    ).toMatchObject({ title: "新技能库" });
    expect(
      UpdateLibraryInputSchema.parse({
        domain: "material",
        libraryId: "material-1",
        overview: "新的库介绍"
      })
    ).toMatchObject({ overview: "新的库介绍" });
    expect(() =>
      UpdateLibraryInputSchema.parse({
        domain: "material",
        libraryId: "material-1"
      })
    ).toThrow();
    expect(
      UpdateLibraryInputSchema.parse({
        domain: "material",
        libraryId: "material-1",
        overview: "字".repeat(CATALOG_LIBRARY_OVERVIEW_MAX_CHARACTERS + 1)
      }).overview
    ).toHaveLength(CATALOG_LIBRARY_OVERVIEW_MAX_CHARACTERS + 1);
    expect(
      MoveLibraryEntryInputSchema.parse({
        domain: "material",
        sourceLibraryId: "material-1",
        targetLibraryId: "material-2",
        entryId: "entry-1",
        beforeEntryId: "entry-2",
        targetStageId: "pacing"
      })
    ).toMatchObject({ targetStageId: "pacing" });
  });

  it("accepts library entries longer than the 40,000-character recommendation", () => {
    const common = {
      domain: "material" as const,
      libraryId: "material-1",
      title: "人物素材"
    };
    expect(
      CreateLibraryEntryInputSchema.parse({
        ...common,
        content: "字".repeat(CATALOG_LIBRARY_ENTRY_MAX_CHARACTERS)
      }).content
    ).toHaveLength(CATALOG_LIBRARY_ENTRY_MAX_CHARACTERS);
    expect(
      SaveLibraryEntryInputSchema.parse({
        ...common,
        entryId: "entry-1",
        content: "字".repeat(CATALOG_LIBRARY_ENTRY_MAX_CHARACTERS + 1)
      }).content
    ).toHaveLength(CATALOG_LIBRARY_ENTRY_MAX_CHARACTERS + 1);
  });
});
