import { computed, ref, shallowRef } from "vue";
import { describe, expect, it, vi } from "vitest";
import {
  createShortWorkspaceContentRevision,
  type CatalogLibrary
} from "@deepwrite/contracts";
import type { AgentEditProposal } from "../../types/conversation";
import type {
  EditorDraftState,
  WorkspaceDocument
} from "../../types/workspace";
import type { AgentConversationController } from "../useAgentConversation";
import type { ProposalCoordinatorContext } from "./types";
import { createLibraryCreationCommit } from "./library-creation-commit";
import { createLibraryTextCommit } from "./library-text-commit";

function fixture() {
  const document: WorkspaceDocument = {
    id: "entry_document",
    domain: "material",
    title: "人物素材",
    eyebrow: "素材库",
    path: ["素材库", "人物素材"],
    content: "原有内容",
    libraryId: "library_material",
    catalogEntryId: "entry_material",
    catalogProjectRevision: 7
  };
  const proposal: AgentEditProposal = {
    id: "proposal_edit",
    runId: "run_edit",
    workspaceId: "library_material",
    stageId: "library",
    documentId: document.id,
    title: "更新人物素材",
    summary: "更新素材",
    status: "pending",
    baseRevision: createShortWorkspaceContentRevision(document.content),
    proposedRevision: createShortWorkspaceContentRevision("更新内容"),
    proposedText: "更新内容",
    toolCallIds: ["tool_edit"],
    additions: 1,
    deletions: 1,
    hunks: [],
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    libraryTarget: {
      domain: "material",
      libraryId: "library_material",
      operation: "edit",
      entryId: "entry_material",
      baseProjectRevision: 7,
      managementScope: {
        bookId: "longbook_library_owner",
        bookType: "long"
      }
    }
  };
  const library = {
    id: "library_material",
    projectRevision: 7
  } as CatalogLibrary;
  const saveLibraryEntry = vi.fn(async () => ({
    id: "entry_material",
    title: "更新人物素材",
    body: "更新内容"
  }));
  const updateLibrary = vi.fn(async () => ({
    ...library,
    overview: "更新内容",
    projectRevision: 8
  }));
  const drafts = ref<Record<string, EditorDraftState>>({});
  const documents = shallowRef([document]);
  const applyAcceptedDocumentLocally = vi.fn();
  const setDocumentAccepting = vi.fn();
  const setWorkspaceAccepting = vi.fn();
  const updateEditProposal = vi.fn();
  const conversation = {
    updateEditProposal
  } as unknown as AgentConversationController;
  const context = {
    api: () => ({ catalog: { saveLibraryEntry, updateLibrary } }),
    notifications: {
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
      success: vi.fn()
    },
    catalog: {
      findCatalogLibrary: () => library,
      loadSnapshot: vi.fn(),
      applyAcceptedDocumentLocally,
      applySavedLibraryEntry: vi.fn(async () => 8),
      applyUpdatedLibrary: vi.fn(async () => {}),
      isConflict: () => false
    },
    editor: {
      documents,
      drafts,
      liveDocuments: computed(() => documents.value),
      acceptingWorkspaceIds: ref(new Set<string>()),
      savingDocumentIds: ref(new Set<string>()),
      setDocumentAccepting,
      setWorkspaceAccepting
    },
    navigation: { selectedResourceId: ref(""), rightCollapsed: ref(false) }
  } as unknown as ProposalCoordinatorContext;
  const accept = createLibraryTextCommit(
    context,
    createLibraryCreationCommit(context)
  );
  const request = {
    runId: proposal.runId,
    proposalId: proposal.id,
    decision: "accept" as const
  };
  return {
    accept,
    request,
    proposal,
    document,
    library,
    drafts,
    saveLibraryEntry,
    updateLibrary,
    applyAcceptedDocumentLocally,
    setDocumentAccepting,
    setWorkspaceAccepting,
    conversation,
    updateEditProposal
  };
}

describe("library text proposal commit", () => {
  it("saves the scoped revision and preserves a newer draft while accepting", async () => {
    const state = fixture();
    let resolve!: (entry: { id: string; title: string; body: string }) => void;
    state.saveLibraryEntry.mockImplementationOnce(
      () =>
        new Promise((finish) => {
          resolve = finish;
        })
    );
    const originalDraft = {
      title: state.document.title,
      content: state.document.content,
      dirty: false,
      baseRevision: state.proposal.baseRevision!
    };
    state.drafts.value[state.document.id] = originalDraft;
    const originalDraftAtAccept = state.drafts.value[state.document.id];
    const pending = state.accept(
      state.conversation,
      state.request,
      state.proposal,
      false
    );
    state.drafts.value[state.document.id] = {
      title: "新草稿",
      content: "保存期间手动更新",
      dirty: true
    };
    resolve({
      id: "entry_material",
      title: state.proposal.title,
      body: "更新内容"
    });
    await pending;
    expect(state.saveLibraryEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        managementScope: state.proposal.libraryTarget!.managementScope,
        baseRevision: state.proposal.baseRevision,
        baseProjectRevision: 7,
        content: "更新内容"
      })
    );
    expect(state.applyAcceptedDocumentLocally).toHaveBeenCalledWith(
      {
        id: state.document.id,
        title: state.proposal.title,
        content: "更新内容"
      },
      8,
      originalDraftAtAccept
    );
    expect(state.drafts.value[state.document.id]?.content).toBe(
      "保存期间手动更新"
    );
    expect(state.updateEditProposal).toHaveBeenLastCalledWith(
      state.proposal.runId,
      state.proposal.id,
      expect.objectContaining({
        status: "accepted",
        statusMessage: expect.stringContaining("更新草稿已保留")
      })
    );
    expect(state.setDocumentAccepting).toHaveBeenLastCalledWith(
      state.document.id,
      false
    );
    expect(state.setWorkspaceAccepting).toHaveBeenLastCalledWith(
      state.proposal.workspaceId,
      false
    );
  });

  it("does not overwrite an entry after its project revision changes", async () => {
    const state = fixture();
    state.library.projectRevision = 8;
    await state.accept(state.conversation, state.request, state.proposal, true);
    expect(state.saveLibraryEntry).not.toHaveBeenCalled();
    expect(state.updateEditProposal).toHaveBeenCalledWith(
      state.proposal.runId,
      state.proposal.id,
      expect.objectContaining({ status: "conflict" })
    );
  });

  it("writes a library overview with the original title and management scope", async () => {
    const state = fixture();
    state.document.catalogLibraryField = "overview";
    delete state.document.catalogEntryId;
    state.proposal.libraryTarget!.operation = "edit-overview";
    await state.accept(
      state.conversation,
      state.request,
      state.proposal,
      false
    );
    expect(state.saveLibraryEntry).not.toHaveBeenCalled();
    expect(state.updateLibrary).toHaveBeenCalledWith({
      domain: "material",
      libraryId: "library_material",
      overview: "更新内容",
      baseProjectRevision: 7,
      managementScope: state.proposal.libraryTarget!.managementScope
    });
    expect(state.applyAcceptedDocumentLocally).toHaveBeenCalledWith(
      {
        id: state.document.id,
        title: state.document.title,
        content: "更新内容"
      },
      8,
      undefined
    );
  });
});
