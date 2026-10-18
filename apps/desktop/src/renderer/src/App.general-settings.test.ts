import { describe, expect, it } from "vitest";
import source from "./test-support/workspaceShellSource";
import longWorkspaceSource from "./components/LongWorkspaceModule.vue?raw";
import writingWorkspaceSource from "./components/WritingWorkspaceModule.vue?raw";
// @ts-expect-error Loaded as source text by the Vitest-only virtual module.
import stylesSource from "virtual:deepwrite-renderer-styles";
import coordinatorSource from "./composables/useGeneralSettingsCoordinator.ts?raw";
import lifecycleSource from "./composables/useWorkspaceLifecycleCoordinator.ts?raw";

describe("App general settings integration", () => {
  it("loads and persists general settings through the desktop runtime", () => {
    expect(source).toContain("loadGeneralSettings,");
    expect(lifecycleSource).toContain("options.loadGeneralSettings()");
    expect(source).toContain("window.deepwrite?.generalSettings");
    expect(source).toContain("useGeneralSettingsCoordinator({");
    expect(coordinatorSource).toContain("await api.save(snapshot);");
  });

  it("does not expose approval modes in the manual novel surface", () => {
    expect(longWorkspaceSource).not.toContain(":approval-mode=");
    expect(writingWorkspaceSource).not.toContain(":approval-mode=");
  });

  it("applies language and menu-bar setting changes", () => {
    expect(source).toContain("documentRoot: document.documentElement");
    expect(coordinatorSource).toContain(
      "options.documentRoot.lang = resolvedLanguage"
    );
    expect(coordinatorSource).toContain(
      "function updateUseNetworkProxy(enabled: boolean)"
    );
    expect(source).toContain('@update-language="updateAppLanguage"');
    expect(source).toContain('@update-show-in-menu-bar="updateShowInMenuBar"');
    expect(source).toContain(
      '@update-use-network-proxy="updateUseNetworkProxy"'
    );
  });

  it("persists the context usage indicator visibility", () => {
    expect(coordinatorSource).toContain(
      "function updateShowContextUsage(enabled: boolean)"
    );
    expect(source).toContain(
      '@update-show-context-usage="updateShowContextUsage"'
    );
  });

  it("uses a manual shell independent of old pane preferences", () => {
    expect(source).toContain("manual-workspace-shell");
    expect(source).not.toContain(
      ':pane-layout="generalSettings.workspacePaneLayout"'
    );
    expect(writingWorkspaceSource).toContain(':right-pane="false"');
    expect(longWorkspaceSource).toContain(':right-pane="false"');
    expect(stylesSource).toContain(".desktop-shell.manual-workspace-shell");
  });

  it("persists and applies the default text view mode to every editor", () => {
    expect(coordinatorSource).toContain(
      "function updateDefaultTextViewMode(mode: TextViewMode)"
    );
    expect(source).toContain(
      '@update-default-text-view-mode="updateDefaultTextViewMode"'
    );
    expect(source).toContain(
      "defaultViewMode: generalSettings.value.defaultTextViewMode"
    );
    expect(source).toContain(
      ':default-text-view-mode="generalSettings.defaultTextViewMode"'
    );
    expect(writingWorkspaceSource).toContain('| "defaultViewMode"');
    expect(longWorkspaceSource).toContain(
      ':default-view-mode="defaultTextViewMode"'
    );
  });

  it("reveals text without expanding a collapsed right-side agent", () => {
    expect(source).toContain("function revealTextPane(): void");
    expect(source).toContain(
      'generalSettings.value.workspacePaneLayout === "agent-editor"'
    );
    expect(source).toContain('layoutStore.setPaneCollapsed("right", false)');
    expect(source).not.toContain("rightCollapsed.value = false");
  });
});
