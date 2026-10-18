import { describe, expect, it } from "vitest";
// @ts-expect-error Loaded as source text by the Vitest-only virtual module.
import rendererStyles from "virtual:deepwrite-renderer-styles";
import workspaceSource from "../test-support/workspaceShellSource";

describe("agent activity floating panel", () => {
  it("injects one workspace-level coordinator without changing IPC", () => {
    expect(workspaceSource).toContain("useAgentActivityCoordinator({");
    expect(workspaceSource).toContain(
      "provide(AGENT_ACTIVITY_CONTEXT_KEY, agentActivity.context)"
    );
    expect(workspaceSource).toContain(
      "resolveAgentActivityDescriptor(conversationKey"
    );
    expect(workspaceSource).toContain(
      "resolveAgentActivityNavigationNode(item"
    );
    expect(workspaceSource).toContain(
      "selectLongChapterCardTab(item.chapterCardId)"
    );
    expect(workspaceSource).toContain('return "missing"');
  });

  it("honors reduced-motion preferences for the running spinner", () => {
    expect(rendererStyles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(rendererStyles).toContain(".agent-activity-spinner {");
  });
});
