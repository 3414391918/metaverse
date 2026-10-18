import { describe, expect, it } from "vitest";
import source from "./test-support/workspaceShellSource";
import longWorkspaceSource from "./components/LongWorkspaceModule.vue?raw";
import writingWorkspaceSource from "./components/WritingWorkspaceModule.vue?raw";
import autoSaveSource from "./composables/useEditorAutoSaveCoordinator.ts?raw";
import presentationCoordinatorSource from "./composables/useLongWorkspacePresentationCoordinator.ts?raw";
import coordinatorSource from "./test-support/proposalCoordinatorSource";
import worldbuildingLaneSource from "./composables/proposal-coordinator/long-worldbuilding-lane.ts?raw";
import longImpactApprovalSource from "./composables/proposal-coordinator/long-impact-approval.ts?raw";
import eventRoutesSource from "./events/registerWorkspaceSystemEventRoutes.ts?raw";

describe("App agent realtime auto persistence", () => {
  it("keeps editor writes behind the active run and review write barrier", () => {
    expect(presentationCoordinatorSource).toContain(
      "function agentRunScopeHasWriteBarrier"
    );
    expect(presentationCoordinatorSource).toContain(
      "conversation.isBusy.value"
    );
    expect(presentationCoordinatorSource).toContain(
      "conversation.hasPendingEditReview.value"
    );
    expect(presentationCoordinatorSource).toContain(
      "agentRunScopeHasWriteBarrier(agentRunScopeForDocument(document))"
    );
    expect(source).toContain("useLongWorkspacePresentationCoordinator({");
    expect(source).not.toContain("function agentRunScopeHasWriteBarrier");
    expect(autoSaveSource).toContain("options.isWriteBlocked(document)");
    expect(presentationCoordinatorSource).toContain("请先接受或拒绝待审阅变更");
  });

  it("routes long chapter drafts into the standard conversation approval flow", () => {
    expect(eventRoutesSource).toContain(
      '} else if (event.type === "long.chapter_write_proposal")'
    );
    expect(eventRoutesSource).toContain(
      "dependencies.stageLongDraftEditProposal(event)"
    );
    expect(source).toContain("stageLongDraftEditProposal,");
    expect(coordinatorSource).toContain('stageId: "long-draft"');
    expect(coordinatorSource).toContain(
      "async function acceptLongDraftProposal"
    );
    expect(coordinatorSource).toContain("await acceptLongDraftProposal(");
    const acceptance =
      coordinatorSource
        .split("async function acceptLongDraftProposal(")[1]
        ?.split("async function applyAgentEdit(")[0] ?? "";
    expect(acceptance).toContain("await previewLongProposalImpact(");
    expect(acceptance).toContain("await api.applyOperations(");
    expect(longImpactApprovalSource).toContain(
      "const preview = await api.previewOperations({ bookId, batch })"
    );
    expect(longImpactApprovalSource).toContain(
      "return preview.preview.confirmation"
    );
    expect(acceptance).not.toContain("api.writeChapter(");
  });

  it("routes long worldbuilding files into the standard conversation approval flow", () => {
    expect(eventRoutesSource).toContain(
      'if (event.type === "long.worldbuilding_file_proposal")'
    );
    expect(eventRoutesSource).toContain(
      "dependencies.stageLongWorldbuildingEditProposal(event)"
    );
    expect(source).toContain("stageLongWorldbuildingEditProposal,");
    expect(coordinatorSource).toContain('stageId: "long-worldbuilding"');
    expect(worldbuildingLaneSource).toContain(
      "async function acceptLongWorldbuildingFileProposal"
    );
    expect(coordinatorSource).toContain(
      "await acceptLongWorldbuildingFileProposal("
    );
  });

  it("routes long character files into the standard conversation approval flow", () => {
    expect(eventRoutesSource).toContain(
      '} else if (event.type === "long.character_file_proposal")'
    );
    expect(eventRoutesSource).toContain(
      "dependencies.stageLongCharacterEditProposal(event)"
    );
    expect(source).toContain("stageLongCharacterEditProposal,");
    expect(coordinatorSource).toContain('stageId: "long-character"');
    expect(coordinatorSource).toContain(
      "async function acceptLongCharacterFileProposal"
    );
    expect(coordinatorSource).toContain(
      "await acceptLongCharacterFileProposal("
    );
  });

  it("routes plot design mutations into the standard conversation approval flow only", () => {
    expect(eventRoutesSource).toContain(
      'event.type === "long.mutation_proposal"'
    );
    expect(eventRoutesSource).not.toContain(
      'event.payload.agentId === "plot_design"'
    );
    expect(eventRoutesSource).toContain(
      "dependencies.stageLongPlotDesignEditProposal(event)"
    );
    expect(source).toContain("stageLongPlotDesignEditProposal,");
    expect(coordinatorSource).toContain('stageId: "long-plot-design"');
    expect(coordinatorSource).toContain(
      "async function acceptLongPlotDesignProposal"
    );
    expect(coordinatorSource).toContain("await acceptLongPlotDesignProposal(");

    const eventRouting = eventRoutesSource.slice(
      eventRoutesSource.indexOf(
        "export function registerWorkspaceSystemEventRoutes"
      )
    );
    expect(eventRouting).toMatch(
      /dependencies\.stageLongPlotDesignEditProposal\(event\);\s*} else if/s
    );
  });

  it("does not mount live proposal handling in manual editors", () => {
    expect(writingWorkspaceSource).not.toContain(
      'v-bind="conversationContext"'
    );
    expect(longWorkspaceSource).not.toContain("allow-live-edit-review");
  });
});
