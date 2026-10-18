import { describe, expect, it } from "vitest";
import { expectSourceToContain } from "../../test-utils/sourceText";
import source from "./test-support/workspaceShellSource";
import resourceSource from "./composables/useWorkspaceResourceCoordinator.ts?raw";
import layoutSource from "./stores/layoutStore.ts?raw";

describe("App right pane preference integration", () => {
  it("restores an area-specific width and persists explicit resize actions", () => {
    expect(resourceSource).toContain(
      "const activeRightPanePreferenceKey = computed"
    );
    expect(resourceSource).toContain('workspaceType: "long"');
    expect(resourceSource).toContain(
      "stageId: longNavigation.activeRoot.value"
    );
    expect(source).toContain(
      "layoutStore.setActiveRightPanePreferenceKey(key)"
    );
    expect(layoutSource).toContain("restoreRightPaneWidthForNavigation(key)");
    expect(layoutSource).toContain(
      "persistActiveRightPaneWidth(rightPaneWidth.value)"
    );
    expect(layoutSource).toContain("rightPaneWidth.value !== currentWidth");
  });

  it("restores navigation widths without animating the whole workspace", () => {
    expect(layoutSource).toContain(
      "const paneTransitionSuppressed = ref(false)"
    );
    expect(layoutSource).toContain(
      '"is-pane-transition-suppressed": paneTransitionSuppressed.value'
    );
    expectSourceToContain(source, '{ flush: "sync", immediate: true }');
    expect(layoutSource).toContain(
      "currentWindow.requestAnimationFrame(() => {"
    );
  });

  it("keys library widths from the selected resource area", () => {
    expect(resourceSource).toContain("domain: activeDocument.value.domain");
    expect(resourceSource).toContain(
      "stageId: activeDocument.value.stageCategoryId"
    );
    expect(resourceSource).not.toContain("activeAgentDocument.value.stageId");
  });

  it("uses saved widths when reconciling window size without replacing them", () => {
    expect(layoutSource).toContain("restoreRightPaneWidth();");
    expect(layoutSource).toContain(
      "rightPanePreferences.value.widths[key] ?? initialRightPaneWidth"
    );
    expect(layoutSource).toContain(": initialRightPaneWidth;");
    expect(layoutSource).not.toContain(
      "saveRightPanePreferences(window.localStorage, { widths: {} })"
    );
  });
});
