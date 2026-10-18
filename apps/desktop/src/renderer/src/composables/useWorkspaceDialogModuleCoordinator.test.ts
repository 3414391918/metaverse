import { shallowRef, type Ref } from "vue";
import { describe, expect, it, vi } from "vitest";
import {
  WORKSPACE_DIALOG_KINDS,
  type WorkspaceDialogKind
} from "../components/WorkspaceDialogLayer.types";
import coordinatorSource from "./useWorkspaceDialogModuleCoordinator.ts?raw";
import {
  WORKSPACE_DIALOG_PRIORITY,
  useWorkspaceDialogModuleCoordinator,
  type WorkspaceDialogLongLifecycleState,
  type WorkspaceDialogModuleCoordinatorOptions
} from "./useWorkspaceDialogModuleCoordinator";

function fixture<Value>(value: unknown): Value {
  return value as Value;
}

function createHarness() {
  const startupMessages = shallowRef<readonly string[]>([]);
  const conflict =
    shallowRef<
      WorkspaceDialogModuleCoordinatorOptions["save"]["conflict"]["value"]
    >(null);
  const saveSubmitting = shallowRef(false);

  const characterCreation =
    shallowRef<
      WorkspaceDialogModuleCoordinatorOptions["longStructure"]["characterCreation"]["value"]
    >(null);
  const worldbuildingItemCreation =
    shallowRef<
      WorkspaceDialogModuleCoordinatorOptions["longStructure"]["worldbuildingItemCreation"]["value"]
    >(null);
  const plotPointCreation =
    shallowRef<
      WorkspaceDialogModuleCoordinatorOptions["longStructure"]["plotPointCreation"]["value"]
    >(null);
  const chapterCardCreation =
    shallowRef<
      WorkspaceDialogModuleCoordinatorOptions["longStructure"]["chapterCardCreation"]["value"]
    >(null);
  const draftDeletion =
    shallowRef<
      WorkspaceDialogModuleCoordinatorOptions["longStructure"]["draftDeletion"]["value"]
    >(null);
  const treeDeletion =
    shallowRef<
      WorkspaceDialogModuleCoordinatorOptions["longStructure"]["treeDeletion"]["value"]
    >(null);
  const ledgerCommitDeletion =
    shallowRef<
      WorkspaceDialogModuleCoordinatorOptions["longStructure"]["ledgerCommitDeletion"]["value"]
    >(null);
  const volumeCreation =
    shallowRef<
      WorkspaceDialogModuleCoordinatorOptions["longStructure"]["volumeCreation"]["value"]
    >(null);
  const longStructureDialogOpen = shallowRef(false);
  const syncBookOptions = shallowRef<
    WorkspaceDialogModuleCoordinatorOptions["longStructure"]["syncBookOptions"]["value"]
  >([]);

  const continuationPreview =
    shallowRef<
      WorkspaceDialogLongLifecycleState["continuationPreview"]["value"]
    >(null);
  const legacyPreview =
    shallowRef<WorkspaceDialogLongLifecycleState["legacyPreview"]["value"]>(
      null
    );
  const legacyResult =
    shallowRef<WorkspaceDialogLongLifecycleState["legacyResult"]["value"]>(
      null
    );
  const longMutationPending = shallowRef(false);
  const activeBookSummary =
    shallowRef<WorkspaceDialogLongLifecycleState["activeBookSummary"]["value"]>(
      null
    );
  const activeBookId = shallowRef<string | null>(null);
  const workspaceIndex =
    shallowRef<WorkspaceDialogLongLifecycleState["workspaceIndex"]["value"]>(
      null
    );
  const bindingsMode = shallowRef<"skill" | "material" | null>(null);
  const bookActionPending = shallowRef(false);
  const renameTarget =
    shallowRef<WorkspaceDialogLongLifecycleState["renameTarget"]["value"]>(
      null
    );
  const removalTarget =
    shallowRef<WorkspaceDialogLongLifecycleState["removalTarget"]["value"]>(
      null
    );
  const longExportTarget =
    shallowRef<WorkspaceDialogLongLifecycleState["exportTarget"]["value"]>(
      null
    );
  const longManuscriptExportPending = shallowRef(false);
  const createDialogOpen = shallowRef(false);
  const transferMode = shallowRef<"open" | "import" | null>(null);

  const removalDialog =
    shallowRef<
      WorkspaceDialogModuleCoordinatorOptions["library"]["removalDialog"]["value"]
    >(null);
  const projectDialog =
    shallowRef<
      WorkspaceDialogModuleCoordinatorOptions["library"]["projectDialog"]["value"]
    >(null);
  const externalLibraryImportDialog =
    shallowRef<
      WorkspaceDialogModuleCoordinatorOptions["library"]["externalLibraryImportDialog"]["value"]
    >(null);
  const entryMove =
    shallowRef<
      WorkspaceDialogModuleCoordinatorOptions["library"]["entryMove"]["value"]
    >(null);
  const groupDialog =
    shallowRef<
      WorkspaceDialogModuleCoordinatorOptions["library"]["groupDialog"]["value"]
    >(null);
  const activeGroup =
    shallowRef<
      WorkspaceDialogModuleCoordinatorOptions["library"]["activeGroup"]["value"]
    >(null);

  const catalogSnapshot =
    shallowRef<
      WorkspaceDialogModuleCoordinatorOptions["catalog"]["snapshot"]["value"]
    >(null);
  const catalogLoading = shallowRef(false);
  const catalogMutationPending = shallowRef(false);
  const materialStageOptions = vi.fn(
    () => [{ value: "other", label: "其他" }] as const
  );

  const options = {
    startup: { messages: startupMessages },
    save: { conflict, submitting: saveSubmitting },
    longStructure: {
      characterCreation,
      worldbuildingItemCreation,
      plotPointCreation,
      chapterCardCreation,
      draftDeletion,
      treeDeletion,
      ledgerCommitDeletion,
      volumeCreation,
      dialogOpen: longStructureDialogOpen,
      agentsMd: shallowRef<string | null>(null),
      agentsMdPending: shallowRef(false),
      syncBookOptions
    },
    longLifecycle: {
      continuationPreview,
      legacyPreview,
      legacyResult,
      mutationPending: longMutationPending,
      activeBookSummary,
      activeBookId,
      workspaceIndex,
      bindingsMode,
      bookActionPending,
      renameTarget,
      removalTarget,
      exportTarget: longExportTarget,
      manuscriptExportPending: longManuscriptExportPending
    },
    creation: { createDialogOpen, transferMode },
    library: {
      removalDialog,
      projectDialog,
      externalLibraryImportDialog,
      entryMove,
      groupDialog,
      activeGroup
    },
    catalog: {
      snapshot: catalogSnapshot,
      loading: catalogLoading,
      mutationPending: catalogMutationPending,
      materialStageOptions
    }
  } satisfies WorkspaceDialogModuleCoordinatorOptions;

  return {
    options,
    refs: {
      startupMessages,
      conflict,
      saveSubmitting,
      characterCreation,
      worldbuildingItemCreation,
      plotPointCreation,
      chapterCardCreation,
      draftDeletion,
      treeDeletion,
      ledgerCommitDeletion,
      volumeCreation,
      longStructureDialogOpen,
      syncBookOptions,
      continuationPreview,
      legacyPreview,
      legacyResult,
      longMutationPending,
      activeBookSummary,
      activeBookId,
      workspaceIndex,
      bindingsMode,
      bookActionPending,
      renameTarget,
      removalTarget,
      longExportTarget,
      longManuscriptExportPending,
      createDialogOpen,
      transferMode,
      removalDialog,
      projectDialog,
      externalLibraryImportDialog,
      entryMove,
      groupDialog,
      activeGroup,
      catalogSnapshot,
      catalogLoading,
      catalogMutationPending,
      materialStageOptions
    }
  };
}

type Harness = ReturnType<typeof createHarness>;

function setKindActive(
  harness: Harness,
  kind: WorkspaceDialogKind,
  active: boolean
): void {
  const state = harness.refs;
  switch (kind) {
    case "startup-alert":
      state.startupMessages.value = active ? ["启动告警"] : [];
      return;
    case "save-conflict":
      state.conflict.value = active
        ? {
            documentId: "document-1",
            payload: {
              id: "document-1",
              title: "冲突文档",
              content: "草稿"
            },
            diskTitle: "磁盘文档",
            diskContent: "磁盘内容"
          }
        : null;
      return;
    case "continuation-import":
      state.continuationPreview.value = active
        ? fixture<
            NonNullable<
              WorkspaceDialogLongLifecycleState["continuationPreview"]["value"]
            >
          >({
            sourcePath: "/example.test/continuation"
          })
        : null;
      return;
    case "legacy-sync":
      state.legacyPreview.value = active
        ? fixture<
            NonNullable<
              WorkspaceDialogLongLifecycleState["legacyPreview"]["value"]
            >
          >({
            sourcePath: "/example.test/legacy"
          })
        : null;
      state.legacyResult.value = null;
      return;
    case "create-long-character":
      state.characterCreation.value = active
        ? fixture({ groupLabel: "主角组" })
        : null;
      return;
    case "create-long-worldbuilding-item":
      state.worldbuildingItemCreation.value = active
        ? fixture({ categoryTitle: "势力" })
        : null;
      return;
    case "create-long-plot-point":
      state.plotPointCreation.value = active
        ? fixture({ volumeTitle: "第一卷" })
        : null;
      return;
    case "create-long-chapter-card":
      state.chapterCardCreation.value = active
        ? fixture({
            volumeTitle: "第一卷",
            arcOptions: [],
            source: "chapter-card"
          })
        : null;
      return;
    case "delete-long-draft":
      state.draftDeletion.value = active
        ? fixture({ title: "待删除草稿" })
        : null;
      return;
    case "delete-long-tree":
      state.treeDeletion.value = active
        ? fixture({
            title: "待删除条目",
            label: "条目",
            description: "删除说明"
          })
        : null;
      return;
    case "delete-long-ledger-commit":
      state.ledgerCommitDeletion.value = active
        ? {
            bookId: "long-1",
            commitId: "ledger-commit-1",
            title: "第 2 章提交",
            chapterCardIds: ["chapter-2"]
          }
        : null;
      return;
    case "create-long-volume":
      state.volumeCreation.value = active
        ? { bookId: "long-1", source: "book-line" }
        : null;
      return;
    case "long-bindings":
      state.bindingsMode.value = active ? "skill" : null;
      state.activeBookSummary.value = active
        ? fixture({
            title: "小说测试书",
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
            }
          })
        : state.activeBookSummary.value;
      return;
    case "long-rename":
      state.renameTarget.value = active
        ? { bookId: "long-1", title: "小说测试书" }
        : null;
      return;
    case "long-removal":
      state.removalTarget.value = active
        ? {
            bookId: "long-1",
            title: "小说测试书",
            action: "unregister"
          }
        : null;
      return;
    case "long-structure":
      state.longStructureDialogOpen.value = active;
      return;
    case "export-long":
      state.longExportTarget.value = active
        ? { bookId: "long-1", title: "小说测试书" }
        : null;
      return;
    case "library-removal":
      state.removalDialog.value = active
        ? {
            action: "remove",
            payload: {
              domain: "material",
              action: "unregister-library",
              node: { id: "material-1", label: "素材库" }
            }
          }
        : null;
      return;
    case "library-project":
      state.projectDialog.value = active
        ? { operation: "create-library", domain: "material" }
        : null;
      return;
    case "external-library-import":
      state.externalLibraryImportDialog.value = active
        ? { domain: "skill", preselectedLibraryId: "skill-1" }
        : null;
      return;
    case "library-entry-move":
      state.entryMove.value = active
        ? {
            domain: "material",
            sourceLibraryId: "material-source",
            entryId: "entry-1",
            targetLibraryId: "material-target",
            entryTitle: "素材条目",
            targetLibraryTitle: "目标素材库",
            targetMaterialKind: "mixed",
            initialStageId: "other"
          }
        : null;
      return;
    case "library-group":
      state.groupDialog.value = active ? { domain: "material" } : null;
      return;
    case "create-book":
      state.createDialogOpen.value = active;
      return;
    case "book-transfer":
      state.transferMode.value = active ? "open" : null;
      return;
    default: {
      const exhaustiveKind: never = kind;
      return exhaustiveKind;
    }
  }
}

function trackedRef<Value>(
  value: Value,
  onRead: () => void
): Readonly<Ref<Value>> {
  return {
    get value() {
      onRead();
      return value;
    }
  } as unknown as Readonly<Ref<Value>>;
}

describe("useWorkspaceDialogModuleCoordinator", () => {
  it("covers every dialog kind and preserves the complete strict priority", () => {
    expect(WORKSPACE_DIALOG_PRIORITY).toHaveLength(24);
    expect(new Set(WORKSPACE_DIALOG_PRIORITY).size).toBe(24);
    expect(new Set(WORKSPACE_DIALOG_PRIORITY)).toEqual(
      new Set(WORKSPACE_DIALOG_KINDS)
    );

    const harness = createHarness();
    for (const kind of WORKSPACE_DIALOG_PRIORITY) {
      setKindActive(harness, kind, true);
    }
    const module = useWorkspaceDialogModuleCoordinator(harness.options);

    for (const expectedKind of WORKSPACE_DIALOG_PRIORITY) {
      expect(module.value?.kind).toBe(expectedKind);
      setKindActive(harness, expectedKind, false);
    }
    expect(module.value).toBeNull();
  });

  it("returns null when no dialog intent is active", () => {
    const harness = createHarness();
    expect(
      useWorkspaceDialogModuleCoordinator(harness.options).value
    ).toBeNull();
  });

  it("stops at the first match and does not read lower-priority intents", () => {
    const harness = createHarness();
    const conflictRead = vi.fn();
    harness.options.save.conflict = trackedRef(null, conflictRead);
    harness.refs.startupMessages.value = ["启动告警"];

    expect(
      useWorkspaceDialogModuleCoordinator(harness.options).value?.kind
    ).toBe("startup-alert");
    expect(conflictRead).not.toHaveBeenCalled();
  });

  it("does not read inactive high-frequency payload refs", () => {
    const harness = createHarness();
    const reads = {
      saveSubmitting: vi.fn(),
      syncBookOptions: vi.fn(),
      longMutationPending: vi.fn(),
      activeBookSummary: vi.fn(),
      activeBookId: vi.fn(),
      workspaceIndex: vi.fn(),
      bookActionPending: vi.fn(),
      longExportPending: vi.fn(),
      activeGroup: vi.fn(),
      catalogSnapshot: vi.fn(),
      catalogLoading: vi.fn(),
      catalogMutationPending: vi.fn()
    };
    harness.options.save.submitting = trackedRef(false, reads.saveSubmitting);
    harness.options.longStructure.syncBookOptions = trackedRef(
      [],
      reads.syncBookOptions
    );
    harness.options.longLifecycle.mutationPending = trackedRef(
      false,
      reads.longMutationPending
    );
    harness.options.longLifecycle.activeBookSummary = trackedRef(
      null,
      reads.activeBookSummary
    );
    harness.options.longLifecycle.activeBookId = trackedRef(
      null,
      reads.activeBookId
    );
    harness.options.longLifecycle.workspaceIndex = trackedRef(
      null,
      reads.workspaceIndex
    );
    harness.options.longLifecycle.bookActionPending = trackedRef(
      false,
      reads.bookActionPending
    );
    harness.options.longLifecycle.manuscriptExportPending = trackedRef(
      false,
      reads.longExportPending
    );
    harness.options.library.activeGroup = trackedRef(null, reads.activeGroup);
    harness.options.catalog.snapshot = trackedRef(null, reads.catalogSnapshot);
    harness.options.catalog.loading = trackedRef(false, reads.catalogLoading);
    harness.options.catalog.mutationPending = trackedRef(
      false,
      reads.catalogMutationPending
    );

    expect(
      useWorkspaceDialogModuleCoordinator(harness.options).value
    ).toBeNull();
    for (const read of Object.values(reads)) {
      expect(read).not.toHaveBeenCalled();
    }
    expect(harness.refs.materialStageOptions).not.toHaveBeenCalled();
  });

  it("passes the long-form export book id into the export-long module", () => {
    const harness = createHarness();
    harness.refs.longExportTarget.value = {
      bookId: "long-1",
      title: "小说测试书"
    };
    const module = useWorkspaceDialogModuleCoordinator(harness.options).value;
    expect(module?.kind).toBe("export-long");
    if (module?.kind === "export-long") {
      expect(module.bookTitle).toBe("小说测试书");
      expect(module.bookId).toBe("long-1");
    }
  });

  it("keeps nullable targets and conditional gates compatible with fallback", () => {
    const bindings = createHarness();
    bindings.refs.bindingsMode.value = "skill";
    bindings.refs.renameTarget.value = {
      bookId: "long-1",
      title: "回退重命名"
    };
    expect(
      useWorkspaceDialogModuleCoordinator(bindings.options).value?.kind
    ).toBe("long-rename");

    const legacy = createHarness();
    legacy.refs.legacyResult.value = fixture<
      NonNullable<WorkspaceDialogLongLifecycleState["legacyResult"]["value"]>
    >({ applied: true });
    expect(
      useWorkspaceDialogModuleCoordinator(legacy.options).value?.kind
    ).toBe("legacy-sync");
  });

  it("stays static-safe for the app-ready graph", () => {
    expect(coordinatorSource).not.toContain("lazyAppComponents");
    expect(coordinatorSource).not.toContain("$attrs");
    expect(coordinatorSource).not.toMatch(/\bany\b/);
    expect(coordinatorSource).not.toMatch(
      /(?:from|import\()\s*["'][^"']*\.vue/
    );
    expect(coordinatorSource.match(/^import (?!type).*$/gm)).toEqual([
      'import { computed, type Ref } from "vue";'
    ]);
    expect(coordinatorSource).toContain(
      "Readonly<Ref<WorkspaceDialogModule | null>>"
    );
  });
});
