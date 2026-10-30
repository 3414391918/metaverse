import { describe, expect, it } from "vitest";
import { sessionListStyle } from "../integrations/harness/plugin/session-list-style.js";

describe("Metaverse session-only navigation", () => {
  it("hides the workspace folder row and standalone composer trigger", () => {
    expect(sessionListStyle).toContain('[class$="_projectRow"]');
    expect(sessionListStyle).toContain(
      '[class$="_heroWorkspaceRow"] > button[aria-haspopup="menu"]'
    );
    expect(sessionListStyle).not.toContain(
      '[class$="_heroWorkspaceRow"] {\n  display: none'
    );
  });

  it("gives conversation titles space without showing directory or time labels", () => {
    expect(sessionListStyle).toContain("min-height: 42px");
    expect(sessionListStyle).toContain('[class$="_time"]');
    expect(sessionListStyle).toContain('[class$="_searchResultWorkspace"]');
    expect(sessionListStyle).toContain("box-shadow: inset 2px 0 0 #6fa8ff");
  });
});
