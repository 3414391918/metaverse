import { nextTick, ref } from "vue";
import { describe, expect, it, vi } from "vitest";
import {
  LONG_AGENTS_MD_MAX_CHARACTERS,
  LONG_BOOK_LINE_FILE_ID,
  LongWorkspaceIndexSnapshotSchema,
  type LongWorkspaceOperationBatch
} from "@deepwrite/contracts";
import type {
  LongStructureMutationCompletion,
  LongWorldbuildingSyncCompletion,
  LongWorldbuildingSyncPreparedChange,
  LongWorldbuildingSyncRequest
} from "../types/longWorkspace";
import { createLongStructureMutationBuilder } from "../types/longStructureMutations";
import { useLongStructureMutation } from "./useLongStructureMutation";
import { useLongAgentsMdEditor } from "./useLongAgentsMdEditor";
import { useLongWorldbuildingSync } from "./useLongWorldbuildingSync";
import { useLongStructureForm } from "./useLongStructureForm";

const NOW = "2026-08-30T04:00:00.000Z";
function prepared(): LongWorldbuildingSyncPreparedChange {
  return {
    batch: { updatedAt: NOW, operations: [], documentWrites: [] },
    confirmation: {
      impact: {
        createdEntityIds: [],
        updatedEntityIds: [],
        deletedEntityIds: [],
        createdFileIds: [],
        deletedFileIds: [],
        documentWriteProposalIds: []
      },
      entityChanges: [],
      relationshipChanges: [],
      fileIntents: [],
      ledgerRecordEdits: []
    },
    createdCategoryCount: 1,
    deletedCategoryCount: 0,
    writtenFileCount: 1
  };
}
function snapshot() {
  return LongWorkspaceIndexSnapshotSchema.parse({
    schemaVersion: 1,
    bookId: "longbook_novel_one",
    updatedAt: NOW,
    bookLine: {
      id: LONG_BOOK_LINE_FILE_ID,
      path: "long/plot/book-line.md",
      updatedAt: NOW
    },
    worldbuilding: [],
    characters: [],
    characterFiles: [],
    plot: {
      volumes: [],
      arcs: [],
      chapterCards: [],
      storyEvents: [],
      storyPlots: [],
      eventConnections: [],
      narrativePlacements: [],
      foreshadowing: []
    },
    chapters: [],
    ledger: { committedThroughChapterId: null, commits: [] }
  });
}

describe("novel structure editing", () => {
  it("serializes mutations and ignores a stale durable completion", () => {
    const applied = vi.fn();
    const mutations = useLongStructureMutation({
      locked: () => false,
      onApplied: applied
    });
    const first = mutations.begin("form")!;
    expect(mutations.begin("sync")).toBeNull();
    mutations.finish(first, "failed");
    expect(applied).not.toHaveBeenCalled();
    const second = mutations.begin("sync")!;
    expect(mutations.finish(first, "succeeded")).toBe(false);
    expect(mutations.pendingMutation.value?.id).toBe(second);
    mutations.finish(second, "applied-refresh-failed");
    expect(applied).toHaveBeenCalledWith("sync");
    expect(mutations.mutationLocked.value).toBe(false);
  });

  it("waits for agents context persistence and keeps the draft after failure", async () => {
    const content = ref("原有上下文");
    const mutations = useLongStructureMutation({
      locked: () => false,
      onApplied() {}
    });
    const saves: Array<{
      content: string;
      completion: LongStructureMutationCompletion;
    }> = [];
    const editor = useLongAgentsMdEditor({
      content: () => content.value,
      pending: () => false,
      active: () => true,
      mutations,
      save: (value, completion) => saves.push({ content: value, completion }),
      notify: { success: vi.fn(), warning: vi.fn() }
    });
    editor.agentsMdDraft.value = "修改后的上下文";
    let completed = false;
    const first = editor.flushAgentsMdIfNeeded().then((saved) => {
      completed = true;
      return saved;
    });
    await Promise.resolve();
    expect(completed).toBe(false);
    expect(saves[0]?.content).toBe("修改后的上下文");
    content.value = "后台刷新内容";
    await nextTick();
    expect(editor.agentsMdDraft.value).toBe("修改后的上下文");
    saves[0]!.completion.fail();
    expect(await first).toBe(false);
    expect(editor.agentsMdDirty.value).toBe(true);
    const retry = editor.flushAgentsMdIfNeeded();
    saves[1]!.completion.appliedButRefreshFailed();
    expect(await retry).toBe(true);
    expect(mutations.mutationLocked.value).toBe(false);
  });

  it("counts Unicode characters and rejects oversized agents context", () => {
    const mutations = useLongStructureMutation({
      locked: () => false,
      onApplied() {}
    });
    const save = vi.fn();
    const warning = vi.fn();
    const editor = useLongAgentsMdEditor({
      content: () => "",
      pending: () => false,
      active: () => true,
      mutations,
      save,
      notify: { success: vi.fn(), warning }
    });
    editor.agentsMdDraft.value = "🌧️";
    expect(editor.agentsMdCharacterCount.value).toBe(2);
    editor.agentsMdDraft.value = "字".repeat(LONG_AGENTS_MD_MAX_CHARACTERS + 1);
    expect(editor.saveAgentsMd()).toBe(false);
    expect(save).not.toHaveBeenCalled();
    expect(warning).toHaveBeenCalledWith(
      expect.stringContaining("主智能体上下文")
    );
  });

  it("retains plain worldbuilding confirmation and closes only after durable apply", () => {
    const requests: Array<{
      request: LongWorldbuildingSyncRequest;
      completion: LongWorldbuildingSyncCompletion;
    }> = [];
    const mutations = useLongStructureMutation({
      locked: () => false,
      onApplied: () => sync.resetSync()
    });
    const sync = useLongWorldbuildingSync({
      books: () => [
        { id: "current", title: "当前小说", categoryCount: 1 },
        { id: "source", title: "来源小说", categoryCount: 2 }
      ],
      currentBookId: () => "current",
      mutations,
      sync: (request, completion) => requests.push({ request, completion }),
      notify: { warning: vi.fn() }
    });
    sync.openSync();
    expect(sync.selectedSyncBookId.value).toBe("source");
    sync.confirmSync();
    sync.closeSync();
    expect(sync.syncOpen.value).toBe(true);
    const firstPrepared = prepared();
    requests[0]!.completion.review(firstPrepared);
    expect(sync.syncPreparedChange.value).toBe(firstPrepared);
    sync.confirmSync();
    expect(() => structuredClone(requests[1]!.request)).not.toThrow();
    requests[0]!.completion.succeed();
    expect(sync.syncOpen.value).toBe(true);
    requests[1]!.completion.fail();
    expect(sync.syncPreparedChange.value).toBe(firstPrepared);
    sync.confirmSync();
    requests[2]!.completion.succeed();
    expect(sync.syncOpen.value).toBe(false);
    expect(sync.syncPreparedChange.value).toBeNull();
  });

  it("keeps form edits on failure and retries the confirmed impact batch", () => {
    const index = snapshot();
    const batches: LongWorkspaceOperationBatch[] = [];
    const mutations = useLongStructureMutation({
      locked: () => false,
      onApplied: () => form.resetFormAfterApply()
    });
    const form = useLongStructureForm({
      snapshot: () => index,
      section: ref("worldbuilding"),
      mutations,
      emitMutation(build) {
        batches.push(build(createLongStructureMutationBuilder(index)));
        return true;
      },
      applyMutationBatch(batch) {
        batches.push(batch);
        return true;
      },
      notify: { warning: vi.fn(), info: vi.fn() }
    });
    form.openCreate();
    form.draft.title = " 城市设定 ";
    form.submitForm();
    expect(batches[0]!.operations).toEqual([
      expect.objectContaining({
        type: "worldbuilding.create",
        category: expect.objectContaining({ title: "城市设定" })
      })
    ]);
    const request = mutations.begin("form")!;
    form.closeForm();
    expect(form.formOpen.value).toBe(true);
    mutations.finish(request, "failed");
    expect(form.draft.title).toBe(" 城市设定 ");
    form.capturePendingFormImpact(batches[0]!, prepared().confirmation);
    form.submitForm();
    expect(batches[1]!.expectedImpact).toEqual(prepared().confirmation);
    expect(() => structuredClone(batches[1])).not.toThrow();
    const retry = mutations.begin("form")!;
    mutations.finish(retry, "succeeded");
    expect(form.formOpen.value).toBe(false);
  });
});
