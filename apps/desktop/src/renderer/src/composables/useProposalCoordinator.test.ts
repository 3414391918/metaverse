import { describe, expect, it } from "vitest";
import source from "./useProposalCoordinator.ts?raw";
import lazySource from "./useLazyProposalCoordinator.ts?raw";
import contextSource from "./proposal-coordinator/types.ts?raw";

describe("unified proposal coordinator boundary", () => {
  it("only exposes current novel and library proposal entry points", () => {
    for (const retired of [
      "stageAgentEditProposal",
      "catalogBook",
      "legacyDraftSectionKeys",
      "WorkspaceEditorMutationEvent",
      "ProposalLaneContext"
    ]) {
      expect(source).not.toContain(retired);
      expect(lazySource).not.toContain(retired);
      expect(contextSource).not.toContain(retired);
    }
  });
  it("keeps lazy loading and typed injected services", () => {
    expect(lazySource).toContain('import("./useProposalCoordinator")');
    expect(lazySource).toContain("invocationTail.then");
    expect(contextSource).toContain("api(): DeepWriteApi | undefined");
    expect(contextSource).toContain(
      "notifications: ProposalCoordinatorNotifications"
    );
    expect(source).not.toContain("window.deepwrite");
    expect(source).not.toContain("@ts-nocheck");
  });
});
