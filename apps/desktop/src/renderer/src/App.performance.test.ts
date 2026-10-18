import { describe, expect, it } from "vitest";
import appSource from "./App.vue?raw";
import shellSource from "./WorkspaceShell.vue?raw";
import compositionSource from "./test-support/workspaceShellSource";
import lazyLong from "./composables/useLazyLongBookLifecycleCoordinator.ts?raw";
import loader from "./composables/useCatalogDocumentLoader.ts?raw";
import lifecycle from "./composables/useWorkspaceLifecycleCoordinator.ts?raw";
import indexStore from "./stores/catalogIndexStore.ts?raw";
import imports from "./components/lazyFeatureImports.ts?raw";

describe("App performance boundaries", () => {
  it("keeps the application and shell as small composition roots", () => {
    expect(appSource.split("\n").length).toBeLessThanOrEqual(25);
    expect(appSource).toContain('import("./WorkspaceShell.vue")');
    expect(shellSource.split("\n").length).toBeLessThanOrEqual(500);
    expect(compositionSource).toContain("useLazyLongBookLifecycleCoordinator");
    expect(compositionSource).toContain("useCatalogDocumentPersistence");
  });
  it("loads settings, teams and novel editors on demand", () => {
    for (const name of ["SettingsPage", "ToolManager", "LongWorkspaceModule"])
      expect(imports).toContain(name + ".vue");
    expect(lazyLong).toContain('import("./useLongBookLifecycleCoordinator")');
    expect(shellSource).not.toContain(
      'from "./components/LongWorkspaceEditor.vue"'
    );
    expect(imports).not.toMatch(
      /CloudBackupPage|LearningImitationDialog|ShortBookAnalysis/
    );
  });
  it("coalesces catalog reads and throttles focus refresh", () => {
    expect(indexStore).toContain("snapshotLoadPromise");
    expect(indexStore).toContain("snapshotTrailingRefreshRequested");
    expect(lifecycle).toContain("DEFAULT_FOCUS_REFRESH_INTERVAL_MS");
    expect(lifecycle).toContain("focusRefreshPromise");
  });
  it("loads stamped library bodies only when needed", () => {
    expect(loader).toContain("catalogDocumentReadDescriptor");
    expect(loader).toContain("reader.readDocument(request.descriptor.input)");
    expect(compositionSource).toContain(
      "reader: () => window.deepwrite?.catalog"
    );
  });
});
