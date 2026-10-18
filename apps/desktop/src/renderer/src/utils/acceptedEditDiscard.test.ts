import { describe, expect, it } from "vitest";
import type {
  AgentEditProposal,
  AgentToolTrace,
  ChatMessage
} from "../types/conversation";
import {
  agentApprovalCanDiscard,
  isModificationTool,
  textEditDiscardSnapshot
} from "./acceptedEditDiscard";

function acceptedTextProposal(
  overrides: Partial<AgentEditProposal> = {}
): AgentEditProposal {
  return {
    id: "proposal-1",
    runId: "run-1",
    workspaceId: "book-1",
    stageId: "draft",
    documentId: "document-1",
    title: "第一章",
    summary: "修改正文",
    status: "accepted",
    baseRevision: "before-revision",
    proposedRevision: "after-revision",
    toolCallIds: ["tool-1"],
    additions: 1,
    deletions: 1,
    hunks: [],
    createdAt: "2026-08-25T00:00:00.000Z",
    updatedAt: "2026-08-25T00:00:01.000Z",
    discardSnapshot: {
      beforeText: "修改前",
      beforeTitle: "第一章"
    },
    ...overrides
  };
}

function messageWithTool(name: string): Pick<ChatMessage, "toolCalls"> {
  return {
    toolCalls: [{ id: "tool-1", name } as AgentToolTrace]
  };
}

describe("accepted edit discard eligibility", () => {
  it("recognizes modification tools without treating create as an edit", () => {
    expect(isModificationTool({ name: "edit" })).toBe(true);
    expect(isModificationTool({ name: "edit_document" })).toBe(true);
    expect(isModificationTool({ name: "create" })).toBe(false);
    expect(isModificationTool({ name: "write" })).toBe(false);
  });

  it("shows discard only for an accepted proposal produced by edit", () => {
    const proposal = acceptedTextProposal();

    expect(agentApprovalCanDiscard(messageWithTool("edit"), proposal)).toBe(
      true
    );
    expect(agentApprovalCanDiscard(messageWithTool("create"), proposal)).toBe(
      false
    );
    expect(
      agentApprovalCanDiscard(messageWithTool("edit"), {
        ...proposal,
        status: "pending"
      })
    ).toBe(false);
  });

  it("keeps the original snapshot only while coalescing the same generation", () => {
    const existing = acceptedTextProposal();

    expect(
      textEditDiscardSnapshot(existing, true, "第一版修改后", "第一章")
    ).toEqual(existing.discardSnapshot);
    expect(
      textEditDiscardSnapshot(existing, false, "第一版修改后", "第一章")
    ).toEqual({
      beforeText: "第一版修改后",
      beforeTitle: "第一章"
    });
  });

  it("never enables discard for short-form creation proposals", () => {
    expect(
      agentApprovalCanDiscard(messageWithTool("edit"), {
        ...acceptedTextProposal(),
        libraryTarget: {
          operation: "create",
          domain: "material",
          libraryId: "library-1"
        }
      })
    ).toBe(false);
    expect(
      agentApprovalCanDiscard(messageWithTool("edit"), {
        ...acceptedTextProposal(),
        draftSectionCreationTarget: {
          sections: [
            {
              title: "新章节",
              wordCountRequirement: "1000 字",
              provisionalSectionId: "section-1"
            }
          ]
        }
      })
    ).toBe(false);
  });

  it("never enables discard for any accepted long-form proposal", () => {
    expect(
      agentApprovalCanDiscard(messageWithTool("edit"), {
        ...acceptedTextProposal(),
        stageId: "long-plot-design",
        workspaceId: "long:book-1",
        longPlotDesignTarget: {
          bookId: "book-1",
          batch: {
            updatedAt: "2026-08-25T00:00:00.000Z",
            operations: [{ type: "worldbuilding.delete", id: "world_rules" }],
            documentWrites: []
          }
        }
      })
    ).toBe(false);
  });
});
