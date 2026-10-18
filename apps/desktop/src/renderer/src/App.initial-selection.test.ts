import { describe, expect, it } from "vitest";
import appSource from "./test-support/workspaceShellSource";
import resourceSource from "./composables/useWorkspaceResourceCoordinator.ts?raw";

describe("initial workspace selection", () => {
  it("keeps the workspace unselected until the user opens a resource", () => {
    expect(appSource).toContain('const selectedResourceId = ref("");');
    expect(appSource).toContain('const activeCreationResourceId = ref("");');
    expect(resourceSource).toContain(
      "documentForResourceId(state.selectedResourceId.value)"
    );
  });

  it("shows the empty workspace instead of falling back to the first book", () => {
    expect(resourceSource).toContain(
      "documentForResourceId(state.selectedResourceId.value)"
    );
    expect(resourceSource).not.toContain("books[0]");
    expect(resourceSource).toContain("options.emptyDocument");
  });
});
