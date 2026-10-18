import {
  LONG_BOOK_LINE_FILE_ID,
  LongWorkspaceIndexSnapshotSchema,
  type LongBookSummary,
  type LongListBooksResult,
  type LongWorkspaceFeatureSettings,
  type LongWorkspaceIndexSnapshot
} from "@deepwrite/contracts";
import { ref, shallowRef } from "vue";
import { describe, expect, it, vi } from "vitest";
import type { CatalogWorkspaceProjection } from "../data/catalogWorkspace";
import type { ResourceTreeNode, ResourceTreeSection } from "../types/workspace";
import {
  longBookResourceId,
  type LongWorkspaceSelection
} from "../types/longWorkspace";
import { longNavigationNodeId } from "../utils/longWorkspaceResourceTree";
import {
  useWorkspaceResourceTreeCoordinator,
  type WorkspaceResourceTreeCoordinatorOptions,
  type WorkspaceResourceTreeStorage
} from "./useWorkspaceResourceTreeCoordinator";

const NOW = "2026-08-14T08:00:00.000Z";

function resourceSections(
  creationNodes: ResourceTreeNode[] = []
): ResourceTreeSection[] {
  return [
    {
      id: "creation",
      label: "创作空间",
      icon: "book",
      nodes: creationNodes
    },
    {
      id: "skill",
      label: "技能库",
      icon: "library",
      nodes: []
    },
    {
      id: "material",
      label: "素材库",
      icon: "archive",
      nodes: []
    }
  ];
}

function projection(
  creationNodes: ResourceTreeNode[] = []
): CatalogWorkspaceProjection {
  return {
    resourceSections: resourceSections(creationNodes),
    workspaceDocuments: [],
    draftDirectories: [],
    index: {
      resourceNodeById: new Map(),
      workspaceDocumentById: new Map(),
      resourceIdByDocumentId: new Map(),
      resourceTargetDocumentIdById: new Map(),
      draftDirectoryById: new Map(),
      draftDirectoryByWorkspaceId: new Map(),
      preferredResourceIdByWorkspaceId: new Map(),
      workspaceIdByResourceId: new Map()
    }
  };
}

function bookSummary(id = "longbook_tree"): LongBookSummary {
  return {
    schemaVersion: 1,
    kind: "deepwrite.long-book",
    id,
    title: "资源树小说",
    bookType: "long",
    genre: "测试",
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
    createdAt: NOW,
    updatedAt: NOW,
    navigation: {
      schemaVersion: 1,
      bookId: id,
      updatedAt: NOW,
      worldbuilding: [],
      characterTypes: [{ id: "protagonist", title: "主角", order: 1 }],
      characters: [],
      volumes: [{ id: "volume_one", title: "第一卷", order: 1 }],
      arcs: [],
      chapterCards: [],
      committedThroughChapterId: null,
      counts: {
        worldbuildingCategories: 0,
        characters: 0,
        arcs: 0,
        volumes: 1,
        chapterCards: 0,
        storyEvents: 0,
        storyPlots: 0,
        foreshadowingThreads: 0,
        committedChapters: 0
      }
    }
  };
}

function workspaceIndex(
  featureSettings: LongWorkspaceFeatureSettings
): LongWorkspaceIndexSnapshot {
  return LongWorkspaceIndexSnapshotSchema.parse({
    schemaVersion: 1,
    bookId: "longbook_tree",
    updatedAt: NOW,
    featureSettings,
    bookLine: {
      id: LONG_BOOK_LINE_FILE_ID,
      path: "long/plot/book-line.md",
      updatedAt: NOW
    },
    worldbuilding: [],
    characters: [],
    characterFiles: [],
    plot: {
      volumes: [
        {
          id: "volume_one",
          title: "第一卷",
          order: 1,
          summary: ""
        }
      ],
      arcs: [],
      chapterCards: [],
      storyEvents: [],
      storyPlots: [],
      eventConnections: [],
      narrativePlacements: [],
      foreshadowing: []
    },
    chapters: [],
    ledger: {
      committedThroughChapterId: null,
      commits: []
    }
  });
}

function selection(
  key: string,
  root: LongWorkspaceSelection["root"],
  patch: Partial<LongWorkspaceSelection> = {}
): LongWorkspaceSelection {
  return {
    key,
    root,
    title: key,
    breadcrumbs: [key],
    files: [],
    preferredRole: "content",
    ...patch
  };
}

function createHarness(
  options: {
    projection?: CatalogWorkspaceProjection | null;
    longBooks?: readonly LongBookSummary[];
    diagnostics?: NonNullable<LongListBooksResult["diagnostics"]>;
    index?: LongWorkspaceIndexSnapshot | null;
    selection?: LongWorkspaceSelection | null;
    selectedResourceId?: string;
    storage?: WorkspaceResourceTreeCoordinatorOptions["storage"];
  } = {}
) {
  const catalogProjection = shallowRef<CatalogWorkspaceProjection | null>(
    options.projection ?? null
  );
  const longBooks = shallowRef<readonly LongBookSummary[]>(
    options.longBooks ?? []
  );
  const longCatalogDiagnostics = shallowRef<
    NonNullable<LongListBooksResult["diagnostics"]>
  >(options.diagnostics ?? []);
  const activeLongBookId = ref<string | null>(options.index?.bookId ?? null);
  const activeLongWorkspaceIndex =
    shallowRef<LongWorkspaceIndexSnapshot | null>(options.index ?? null);
  const activeLongSelection = shallowRef<LongWorkspaceSelection | null>(
    options.selection ?? null
  );
  const selectedResourceId = ref(options.selectedResourceId ?? "");
  const defaultStorage: WorkspaceResourceTreeStorage = {
    getItem: vi.fn(() => null),
    setItem: vi.fn()
  };
  const notifications = { warning: vi.fn() };
  const coordinator = useWorkspaceResourceTreeCoordinator({
    catalogProjection,
    fallbackSections: resourceSections(),
    longBooks,
    longCatalogDiagnostics,
    activeLongBookId,
    activeLongWorkspaceIndex,
    activeLongSelection,
    selectedResourceId,
    storage: options.storage ?? (() => defaultStorage),
    notifications
  });
  return {
    ...coordinator,
    activeLongBookId,
    activeLongSelection,
    activeLongWorkspaceIndex,
    catalogProjection,
    defaultStorage,
    longBooks,
    notifications,
    selectedResourceId
  };
}

describe("useWorkspaceResourceTreeCoordinator", () => {
  it("adds available and unavailable long books to the final tree without duplicate diagnostics", () => {
    const available = bookSummary("longbook_available");
    const harness = createHarness({
      projection: projection(),
      longBooks: [available],
      diagnostics: [
        {
          bookId: available.id,
          code: "invalid",
          message: "已由可用摘要覆盖"
        },
        {
          bookId: "longbook_missing",
          code: "unavailable",
          message: "本次读取暂不可用"
        }
      ]
    });

    const creation = harness.resourceTreeSections.value.find(
      ({ id }) => id === "creation"
    );
    expect(creation?.nodes.map(({ id }) => id)).toEqual([
      longBookResourceId(available.id),
      longBookResourceId("longbook_missing")
    ]);
    expect(
      harness.resourceTreeLookup.value.nodeById.get(
        longBookResourceId("longbook_missing")
      )
    ).toMatchObject({ unavailable: true, muted: true });
    expect(
      harness.resourceTreeLookup.value.nodeById.has(
        longNavigationNodeId(available.id, "root:worldbuilding")
      )
    ).toBe(true);
  });

  it("maps each long-form selection to its left-tree node and keeps top-tab layouts on their branch", () => {
    const leftTreeIndex = workspaceIndex({
      worldbuildingItemLayout: "left-tree",
      characterAndContinuityItemLayout: "left-tree",
      plotItemLayout: "left-tree"
    });
    const topTabIndex = workspaceIndex({
      worldbuildingItemLayout: "top-tabs",
      characterAndContinuityItemLayout: "top-tabs",
      plotItemLayout: "top-tabs"
    });
    const harness = createHarness();
    const cases: Array<{
      value: LongWorkspaceSelection;
      leftTreeKey: string;
      branchKey: string;
    }> = [
      {
        value: selection("worldbuilding:geography", "worldbuilding", {
          worldbuildingItemId: "harbor"
        }),
        leftTreeKey: "worldbuilding:geography:item:harbor",
        branchKey: "worldbuilding:geography"
      },
      {
        value: selection("worldbuilding:geography", "worldbuilding", {
          worldbuildingItemId: null
        }),
        leftTreeKey: "worldbuilding:geography:overview",
        branchKey: "worldbuilding:geography"
      },
      {
        value: selection("character-group:protagonist", "character_design", {
          characterId: "character_one"
        }),
        leftTreeKey: "character:character_one",
        branchKey: "character-group:protagonist"
      },
      {
        value: selection("plot-design:book-line", "plot_design", {
          bookLineVolumeId: "volume_one"
        }),
        leftTreeKey: "plot-design:book-line:volume:volume_one",
        branchKey: "plot-design:book-line"
      },
      {
        value: selection("plot-design:plot-points:volume_one", "plot_design", {
          plotPointId: "arc_one"
        }),
        leftTreeKey: "plot-design:plot-point:arc_one",
        branchKey: "plot-design:plot-points:volume_one"
      },
      {
        value: selection(
          "plot-design:chapter-cards:volume_one",
          "plot_design",
          {
            chapterCardId: "chapter_one"
          }
        ),
        leftTreeKey: "plot-design:chapter-card:chapter_one",
        branchKey: "plot-design:chapter-cards:volume_one"
      },
      {
        value: selection("continuity:snapshot", "continuity_ledger", {
          preferredFileId: "file_snapshot"
        }),
        leftTreeKey: "continuity:snapshot:file:file_snapshot",
        branchKey: "continuity:snapshot"
      },
      {
        value: selection("chapter:chapter_one", "draft", {
          chapterCardId: "chapter_one"
        }),
        leftTreeKey: "chapter:chapter_one",
        branchKey: "chapter:chapter_one"
      }
    ];

    for (const testCase of cases) {
      expect(
        harness.preferredLongResourceIdForSelection(
          "longbook_tree",
          leftTreeIndex,
          testCase.value
        )
      ).toBe(longNavigationNodeId("longbook_tree", testCase.leftTreeKey));
      expect(
        harness.preferredLongResourceIdForSelection(
          "longbook_tree",
          topTabIndex,
          testCase.value
        )
      ).toBe(longNavigationNodeId("longbook_tree", testCase.branchKey));
    }

    expect(
      harness.preferredLongResourceIdForSelection(
        "longbook_tree",
        leftTreeIndex,
        selection("worldbuilding:reveals", "worldbuilding")
      )
    ).toBeUndefined();
  });

  it("keeps novel layout selection independent of legacy catalog creation nodes", () => {
    const index = workspaceIndex({
      worldbuildingItemLayout: "left-tree",
      characterAndContinuityItemLayout: "left-tree",
      plotItemLayout: "left-tree"
    });
    const activeSelection = selection("plot-design:book-line", "plot_design", {
      bookLineVolumeId: "volume_one"
    });
    const preferredId = longNavigationNodeId(
      "longbook_tree",
      "plot-design:book-line:volume:volume_one"
    );
    const harness = createHarness({
      projection: projection([
        { id: preferredId, label: "港口", icon: "file" }
      ]),
      index,
      longBooks: [bookSummary()],
      selection: activeSelection,
      selectedResourceId: "before-refresh"
    });

    harness.synchronizeSelectedLongResourceForLayout("longbook_tree");
    expect(harness.selectedResourceId.value).toBe(preferredId);

    harness.catalogProjection.value = projection([
      { id: "replacement", label: "新节点", icon: "file" }
    ]);
    harness.selectedResourceId.value = "after-refresh";
    harness.synchronizeSelectedLongResourceForLayout("longbook_tree");
    expect(harness.selectedResourceId.value).toBe(preferredId);

    harness.catalogProjection.value = projection([
      { id: preferredId, label: "恢复后的港口", icon: "file" }
    ]);
    harness.synchronizeSelectedLongResourceForLayout("longbook_tree");
    expect(harness.selectedResourceId.value).toBe(preferredId);
  });
});
