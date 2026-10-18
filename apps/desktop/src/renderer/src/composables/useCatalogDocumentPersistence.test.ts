import {
  createShortWorkspaceContentRevision,
  type CatalogLibrary,
  type CatalogLibraryEntry,
  type DeepWriteApi,
  type SaveDocumentResult
} from "@deepwrite/contracts";
import { shallowRef } from "vue";
import { describe, expect, it, vi } from "vitest";
import type { EditorDraftState, WorkspaceDocument } from "../types/workspace";
import type {
  CatalogDocumentLoadResult,
  CatalogDocumentsLoadResult
} from "./useCatalogDocumentLoader";
import { useCatalogDocumentPersistence } from "./useCatalogDocumentPersistence";

const NOW = "2026-08-14T00:00:00.000Z";

interface Deferred<Value> {
  promise: Promise<Value>;
  resolve(value: Value): void;
}

function deferred<Value>(): Deferred<Value> {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function workspaceDocument(
  content = "磁盘初始正文",
  patch: Partial<WorkspaceDocument> = {}
): WorkspaceDocument {
  return {
    id: "body-1",
    domain: "material",
    title: "第一节",
    eyebrow: "素材 · 条目",
    path: ["测试作品", "正文", "第一节", "正文"],
    content,
    libraryId: "library-1",
    stageId: "character",
    catalogEntryId: "entry-1",
    catalogProjectRevision: 1,
    catalogContentLoaded: true,
    ...patch
  };
}

function editorDraft(content: string): EditorDraftState {
  return {
    title: "第一节",
    content,
    dirty: true,
    recoveryUpdatedAt: NOW,
    baseRevision: createShortWorkspaceContentRevision("磁盘初始正文"),
    baseProjectRevision: 1
  };
}

function savedDocument(
  content: string,
  projectRevision = 2
): SaveDocumentResult {
  return {
    id: "draft-section:section-1:body",
    title: "第一节",
    content,
    createdAt: NOW,
    updatedAt: NOW,
    projectRevision
  };
}

function oneResult(document: WorkspaceDocument): CatalogDocumentLoadResult {
  return {
    ok: true,
    requestedIds: [document.id],
    loadedIds: [document.id],
    alreadyLoadedIds: [],
    skippedIds: [],
    retriedIds: [],
    failures: [],
    published: true,
    documents: [document],
    document
  };
}

function manyResult(
  documents: readonly WorkspaceDocument[]
): CatalogDocumentsLoadResult {
  return {
    ok: true,
    requestedIds: documents.map(({ id }) => id),
    loadedIds: documents.map(({ id }) => id),
    alreadyLoadedIds: [],
    skippedIds: [],
    retriedIds: [],
    failures: [],
    published: documents.length > 0,
    documents
  };
}

function createHarness(
  options: {
    saveDocument?: DeepWriteApi["catalog"]["saveDocument"];
    ensureOne?: (
      document: string | WorkspaceDocument
    ) => Promise<CatalogDocumentLoadResult>;
    refreshIndex?: () => Promise<boolean>;
  } = {}
) {
  const documents = shallowRef<WorkspaceDocument[]>([workspaceDocument()]);
  const drafts = shallowRef<Record<string, EditorDraftState>>({
    "body-1": editorDraft("提交 A")
  });
  let timestamp = 0;
  let projectRevision = 1;
  const scheduleAutoSave = vi.fn();
  const notifications = {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn()
  };
  const saveDocument = vi.fn(
    options.saveDocument ??
      (async (input) =>
        savedDocument(input.content, (input.baseProjectRevision ?? 1) + 1))
  );
  const catalogApi = {
    saveLibraryEntry: async (input: {
      content: string;
      title: string;
      baseProjectRevision?: number;
      baseRevision: string;
      force?: boolean;
    }) => {
      const result = await saveDocument({
        bookId: "library-1",
        documentId: "entry-1",
        content: input.content,
        title: input.title,
        baseRevision: input.baseRevision,
        ...(input.baseProjectRevision === undefined
          ? {}
          : { baseProjectRevision: input.baseProjectRevision }),
        ...(input.force ? { force: true } : {})
      });
      projectRevision = result.projectRevision ?? projectRevision + 1;
      return {
        id: "entry-1",
        stageId: "character",
        title: result.title,
        body: result.content,
        createdAt: NOW,
        updatedAt: NOW
      };
    }
  } as unknown as DeepWriteApi["catalog"];
  const ensureOne = vi.fn(
    options.ensureOne ??
      (async (target: string | WorkspaceDocument) => {
        const id = typeof target === "string" ? target : target.id;
        return oneResult(
          documents.value.find((document) => document.id === id)!
        );
      })
  );
  const loader = {
    preserveAuthoritativeBodyForNextProjection: vi.fn(),
    ensureOne,
    ensureLoaded: vi.fn(
      async (
        targets: readonly (string | WorkspaceDocument)[] = documents.value
      ) =>
        manyResult(
          targets.map((target) =>
            typeof target === "string"
              ? documents.value.find((document) => document.id === target)!
              : target
          )
        )
    ),
    invalidate: vi.fn(() => false)
  };
  const refreshIndex = vi.fn(
    options.refreshIndex ??
      (async () => {
        return true;
      })
  );
  const persistence = useCatalogDocumentPersistence({
    api: () => catalogApi,
    documents,
    drafts,
    loader,
    catalog: {
      refreshIndex,
      findLibrary: () =>
        ({
          id: "library-1",
          projectRevision,
          entries: []
        }) as unknown as CatalogLibrary
    },
    nextRecoveryTimestamp: () => `${NOW}:${++timestamp}`,
    scheduleAutoSave,
    notifications
  });
  return {
    persistence,
    documents,
    drafts,
    saveDocument,
    ensureOne,
    ensureLoaded: loader.ensureLoaded,
    preserveAuthoritativeBodyForNextProjection:
      loader.preserveAuthoritativeBodyForNextProjection,
    refreshIndex,
    scheduleAutoSave,
    notifications
  };
}

describe("catalog document persistence", () => {
  it("pauses an editable empty title without entering the retry lane", async () => {
    const harness = createHarness();

    await expect(
      harness.persistence.persistEditorDocumentWithOutcome(
        { id: "body-1", title: "   ", content: "未保存正文" },
        true
      )
    ).resolves.toBe("paused");
    expect(harness.saveDocument).not.toHaveBeenCalled();
    expect(harness.notifications.warning).toHaveBeenCalledWith(
      "请输入文档标题后再保存"
    );
  });

  it("keeps newer typing while save A is in flight and advances only its disk base", async () => {
    const pending = deferred<SaveDocumentResult>();
    const harness = createHarness({
      saveDocument: async () => pending.promise
    });

    const operation = harness.persistence.persistEditorDocument(
      { id: "body-1", title: "第一节", content: "提交 A" },
      false
    );
    await vi.waitFor(() => expect(harness.saveDocument).toHaveBeenCalledOnce());
    harness.drafts.value = {
      "body-1": editorDraft("保存期间继续输入 B")
    };
    pending.resolve(savedDocument("提交 A"));

    await expect(operation).resolves.toBe(true);
    expect(harness.documents.value[0]?.content).toBe("提交 A");
    expect(
      harness.preserveAuthoritativeBodyForNextProjection
    ).toHaveBeenCalledWith("body-1", "提交 A", 2);
    expect(harness.drafts.value["body-1"]).toMatchObject({
      content: "保存期间继续输入 B",
      dirty: true,
      baseRevision: createShortWorkspaceContentRevision("提交 A"),
      baseProjectRevision: 2
    });
    expect(harness.persistence.savingDocumentIds.value.size).toBe(0);
  });

  it("re-arms auto-save when disk already contains A but a newer draft B survived", async () => {
    const diskA = workspaceDocument("提交 A", {
      catalogProjectRevision: 2
    });
    const harness = createHarness({
      saveDocument: async () => {
        throw new Error("catalog.conflict: stale base");
      },
      ensureOne: async () => oneResult(diskA)
    });
    harness.drafts.value = {
      "body-1": editorDraft("保存期间继续输入 B")
    };

    await expect(
      harness.persistence.persistEditorDocument(
        { id: "body-1", title: "第一节", content: "提交 A" },
        false
      )
    ).resolves.toBe(false);

    expect(harness.persistence.saveConflict.value).toBeNull();
    expect(harness.drafts.value["body-1"]).toMatchObject({
      content: "保存期间继续输入 B",
      dirty: true,
      baseRevision: createShortWorkspaceContentRevision("提交 A"),
      baseProjectRevision: 2
    });
    expect(harness.scheduleAutoSave).toHaveBeenCalledOnce();
    expect(harness.scheduleAutoSave).toHaveBeenCalledWith("body-1");
  });

  it("keeps the first conflict stable and resumes other drafts only after it is handled", async () => {
    const harness = createHarness({
      saveDocument: async () => {
        throw new Error("catalog.conflict: stale base");
      },
      ensureOne: async () =>
        oneResult(
          workspaceDocument("外部版本 C", { catalogProjectRevision: 2 })
        )
    });

    await harness.persistence.persistEditorDocument(
      { id: "body-1", title: "第一节", content: "提交 A" },
      false
    );
    expect(harness.persistence.saveConflict.value?.documentId).toBe("body-1");

    harness.documents.value = [
      ...harness.documents.value,
      workspaceDocument("第二份磁盘正文", {
        id: "body-2",
        title: "第二节",
        catalogDocumentId: "draft-section:section-2:body"
      })
    ];
    harness.drafts.value = {
      ...harness.drafts.value,
      "body-2": {
        ...editorDraft("第二份草稿 B"),
        title: "第二节"
      }
    };

    await expect(
      harness.persistence.persistEditorDocument(
        { id: "body-2", title: "第二节", content: "第二份草稿 B" },
        true
      )
    ).resolves.toBe(false);
    expect(harness.saveDocument).toHaveBeenCalledOnce();
    expect(harness.persistence.saveConflict.value?.documentId).toBe("body-1");
    expect(harness.notifications.info).toHaveBeenCalledWith(
      "请先处理当前保存冲突，再保存其他文稿"
    );

    harness.persistence.keepSaveConflictDraft();
    expect(harness.scheduleAutoSave).toHaveBeenCalledWith("body-2");
    expect(harness.scheduleAutoSave).not.toHaveBeenCalledWith("body-1");
  });

  it("does not delete a replacement draft while reloading a conflict", async () => {
    const reloadRead = deferred<CatalogDocumentLoadResult>();
    let reads = 0;
    const harness = createHarness({
      saveDocument: async () => {
        throw new Error("catalog.conflict: stale base");
      },
      ensureOne: async () => {
        reads += 1;
        if (reads === 1) {
          return oneResult(
            workspaceDocument("外部版本 C", {
              catalogProjectRevision: 2
            })
          );
        }
        return reloadRead.promise;
      }
    });

    await harness.persistence.persistEditorDocument(
      { id: "body-1", title: "第一节", content: "提交 A" },
      false
    );
    expect(harness.persistence.saveConflict.value?.diskContent).toBe(
      "外部版本 C"
    );

    const reload = harness.persistence.reloadSaveConflictFromDisk();
    await vi.waitFor(() => expect(harness.ensureOne).toHaveBeenCalledTimes(2));
    harness.drafts.value = {
      "body-1": editorDraft("读取期间新输入 D")
    };
    reloadRead.resolve(
      oneResult(
        workspaceDocument("最新磁盘版本", {
          catalogProjectRevision: 3
        })
      )
    );
    await reload;

    expect(harness.drafts.value["body-1"]?.content).toBe("读取期间新输入 D");
    expect(harness.persistence.saveConflict.value).toBeNull();
    expect(harness.notifications.info).toHaveBeenCalledWith(
      "读取期间检测到新的编辑，已保留当前草稿"
    );
  });

  it("re-reads the latest descriptor before a forced conflict overwrite", async () => {
    let writes = 0;
    let reads = 0;
    const harness = createHarness({
      saveDocument: async (input) => {
        writes += 1;
        if (writes === 1) {
          throw new Error("catalog.conflict: stale base");
        }
        return savedDocument(
          input.content,
          (input.baseProjectRevision ?? 1) + 1
        );
      },
      ensureOne: async () => {
        reads += 1;
        return oneResult(
          workspaceDocument(reads === 1 ? "外部版本 C" : "更新后的外部版本 D", {
            catalogProjectRevision: reads + 1
          })
        );
      }
    });

    await harness.persistence.persistEditorDocument(
      { id: "body-1", title: "第一节", content: "提交 A" },
      false
    );
    expect(harness.persistence.saveConflict.value).not.toBeNull();

    await harness.persistence.overwriteSaveConflictOnDisk();

    expect(harness.ensureOne).toHaveBeenCalledTimes(2);
    expect(harness.saveDocument).toHaveBeenCalledTimes(2);
    expect(harness.saveDocument.mock.calls[1]?.[0]).toMatchObject({
      bookId: "library-1",
      documentId: "entry-1",
      content: "提交 A",
      baseProjectRevision: 3,
      force: true
    });
    expect(harness.persistence.saveConflict.value).toBeNull();
  });

  it("applies an accepted agent edit only to the exact draft identity reviewed", () => {
    const harness = createHarness();
    const reviewedDraft = harness.drafts.value["body-1"];
    harness.drafts.value = {
      "body-1": editorDraft("审阅期间出现的新草稿")
    };

    harness.persistence.applyAcceptedAgentDocumentLocally(
      { id: "body-1", title: "智能体标题", content: "智能体正文" },
      2,
      reviewedDraft
    );

    expect(harness.documents.value[0]).toMatchObject({
      title: "智能体标题",
      content: "智能体正文",
      catalogProjectRevision: 2
    });
    expect(harness.drafts.value["body-1"]).toMatchObject({
      title: "第一节",
      content: "审阅期间出现的新草稿",
      dirty: true,
      baseRevision: createShortWorkspaceContentRevision("智能体正文")
    });
  });

  it("waits for an in-flight direct save before disposal completes", async () => {
    const pending = deferred<SaveDocumentResult>();
    const harness = createHarness({
      saveDocument: async () => pending.promise
    });

    const save = harness.persistence.persistEditorDocument(
      { id: "body-1", title: "第一节", content: "提交 A" },
      false
    );
    await vi.waitFor(() => expect(harness.saveDocument).toHaveBeenCalledOnce());

    let disposed = false;
    const disposal = harness.persistence.dispose().then(() => {
      disposed = true;
    });
    await Promise.resolve();
    expect(disposed).toBe(false);

    pending.resolve(savedDocument("提交 A"));
    await expect(save).resolves.toBe(true);
    await disposal;
    expect(disposed).toBe(true);

    await expect(
      harness.persistence.persistEditorDocument(
        { id: "body-1", title: "第一节", content: "关闭后的修改" },
        false
      )
    ).resolves.toBe(false);
    expect(harness.saveDocument).toHaveBeenCalledOnce();
  });

  it("keeps the authoritative library revision and normalized saved entry after force overwrite", async () => {
    const document: WorkspaceDocument = {
      id: "material-entry-1",
      domain: "material",
      title: "旧标题",
      eyebrow: "素材 · 条目",
      path: ["测试素材库", "旧标题"],
      content: "旧正文",
      libraryId: "library-1",
      catalogEntryId: "entry-1",
      catalogProjectRevision: 1,
      catalogContentLoaded: true
    };
    const diskDocument: WorkspaceDocument = {
      ...document,
      title: "外部标题",
      content: "外部正文",
      catalogProjectRevision: 5
    };
    const normalizedEntry: CatalogLibraryEntry = {
      id: "entry-1",
      stageId: "character",
      title: "规范标题",
      body: "规范正文",
      createdAt: NOW,
      updatedAt: NOW
    };
    const documents = shallowRef<WorkspaceDocument[]>([document]);
    const drafts = shallowRef<Record<string, EditorDraftState>>({
      "material-entry-1": {
        title: " 规范标题 ",
        content: "规范正文",
        dirty: true,
        recoveryUpdatedAt: NOW,
        baseRevision: createShortWorkspaceContentRevision("旧正文"),
        baseProjectRevision: 1
      }
    });
    let writeCount = 0;
    let refreshCount = 0;
    const saveLibraryEntry = vi.fn(async () => {
      writeCount += 1;
      if (writeCount === 1) {
        throw new Error("catalog.conflict: stale base");
      }
      return normalizedEntry;
    });
    const catalogApi = {
      saveLibraryEntry
    } as unknown as DeepWriteApi["catalog"];
    const persistence = useCatalogDocumentPersistence({
      api: () => catalogApi,
      documents,
      drafts,
      loader: {
        preserveAuthoritativeBodyForNextProjection: vi.fn(),
        ensureOne: vi.fn(async () => oneResult(diskDocument)),
        ensureLoaded: vi.fn(async () => manyResult([])),
        invalidate: vi.fn(() => false)
      },
      catalog: {
        refreshIndex: vi.fn(async () => {
          refreshCount += 1;
          return true;
        }),
        findLibrary: () =>
          ({
            id: "library-1",
            title: "测试素材库",
            materialType: "short",
            materialKind: "character",
            parentGenre: "测试",
            subGenre: "测试",
            overview: "",
            entries: [normalizedEntry],
            projectRevision: refreshCount >= 3 ? 6 : 5,
            createdAt: NOW,
            updatedAt: NOW
          }) satisfies CatalogLibrary
      },
      nextRecoveryTimestamp: () => NOW,
      scheduleAutoSave: vi.fn(),
      notifications: {
        error: vi.fn(),
        info: vi.fn(),
        success: vi.fn(),
        warning: vi.fn()
      }
    });

    await persistence.persistEditorDocument(
      {
        id: "material-entry-1",
        title: " 规范标题 ",
        content: "规范正文"
      },
      false
    );
    expect(persistence.saveConflict.value).not.toBeNull();

    await persistence.overwriteSaveConflictOnDisk();

    expect(saveLibraryEntry).toHaveBeenLastCalledWith(
      expect.objectContaining({
        baseProjectRevision: 5,
        force: true
      })
    );
    expect(documents.value[0]).toMatchObject({
      title: "规范标题",
      content: "规范正文",
      catalogProjectRevision: 6
    });
    expect(drafts.value["material-entry-1"]).toBeUndefined();
  });
});
