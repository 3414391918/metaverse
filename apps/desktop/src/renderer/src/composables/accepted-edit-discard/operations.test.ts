import { ref } from "vue";
import { describe, expect, it, vi } from "vitest";
import { createShortWorkspaceContentRevision } from "@deepwrite/contracts";
import type { AgentEditProposal } from "../../types/conversation";
import { AcceptedEditDiscardConflictError } from "../../utils/acceptedEditDiscard";
import type { ProposalCoordinatorContext } from "../proposal-coordinator/types";
import { discardAcceptedLibraryTextEdit } from "./library";

function acceptedProposal(): AgentEditProposal {
  return {
    id: "proposal-1",
    runId: "run-1",
    workspaceId: "library:material:library-1",
    stageId: "library",
    documentId: "document-1",
    title: "第一章",
    summary: "修改正文",
    status: "accepted",
    baseRevision: createShortWorkspaceContentRevision("修改前"),
    proposedRevision: createShortWorkspaceContentRevision("修改后"),
    toolCallIds: ["tool-1"],
    additions: 1,
    deletions: 1,
    hunks: [],
    createdAt: "2026-08-25T00:00:00.000Z",
    updatedAt: "2026-08-25T00:00:01.000Z",
    libraryTarget: {
      operation: "edit",
      domain: "material",
      libraryId: "library-1",
      entryId: "entry-1",
      stageId: "character"
    },
    discardSnapshot: {
      beforeText: "修改前",
      beforeTitle: "第一章"
    }
  };
}

function libraryContext(options: { dirty?: boolean; content?: string } = {}) {
  const applyAcceptedDocumentLocally = vi.fn();
  const saveLibraryEntry = vi.fn(async () => ({
    id: "entry-1",
    title: "第一章",
    body: "修改前",
    revision: "saved"
  }));
  const context = {
    api: () => ({ catalog: { saveLibraryEntry } }),
    editor: {
      documents: ref([
        {
          id: "document-1",
          title: "第一章",
          content: options.content ?? "修改后",
          domain: "material",
          libraryId: "library-1",
          catalogEntryId: "entry-1"
        }
      ]),
      drafts: ref(
        options.dirty
          ? {
              "document-1": {
                title: "第一章",
                content: "本地未保存编辑",
                dirty: true
              }
            }
          : {}
      )
    },
    catalog: {
      applyAcceptedDocumentLocally,
      findCatalogLibrary: () => ({ projectRevision: 4 }),
      applySavedLibraryEntry: vi.fn(async () => 5)
    }
  } as unknown as ProposalCoordinatorContext;
  return { context, applyAcceptedDocumentLocally, saveLibraryEntry };
}

describe("accepted edit discard operations", () => {
  it("restores the library document snapshot when the accepted content is current", async () => {
    const { context, applyAcceptedDocumentLocally } = libraryContext();

    await discardAcceptedLibraryTextEdit(context, acceptedProposal());

    expect(applyAcceptedDocumentLocally).toHaveBeenCalledWith(
      { id: "document-1", title: "第一章", content: "修改前" },
      5,
      undefined
    );
  });

  it("does not overwrite later or unsaved library-document edits", async () => {
    const later = libraryContext({ content: "后续修改" });
    const dirty = libraryContext({ dirty: true });

    await expect(
      discardAcceptedLibraryTextEdit(later.context, acceptedProposal())
    ).rejects.toBeInstanceOf(AcceptedEditDiscardConflictError);
    await expect(
      discardAcceptedLibraryTextEdit(dirty.context, acceptedProposal())
    ).rejects.toBeInstanceOf(AcceptedEditDiscardConflictError);
    expect(later.applyAcceptedDocumentLocally).not.toHaveBeenCalled();
    expect(dirty.applyAcceptedDocumentLocally).not.toHaveBeenCalled();
  });
});
