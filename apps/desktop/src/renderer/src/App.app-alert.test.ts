import { describe, expect, it } from "vitest";
import source from "./test-support/workspaceShellSource";
import dialogLayerSource from "./components/WorkspaceDialogLayer.vue?raw";
import settingsCoordinatorSource from "./composables/useSettingsFeatureCoordinator.ts?raw";
import dialogCoordinatorSource from "./composables/useWorkspaceDialogModuleCoordinator.ts?raw";
import featureHostCoordinatorSource from "./composables/useWorkspaceFeatureHostCoordinator.ts?raw";
import featureHostModuleSource from "./composables/workspaceFeatureHostModule.ts?raw";
import featureModulesSource from "./components/WorkspaceFeatureModules.vue?raw";
import lifecycleSource from "./composables/useWorkspaceLifecycleCoordinator.ts?raw";

const featureHostSource = `${featureHostCoordinatorSource}\n${featureHostModuleSource}`;

describe("App remote alerts", () => {
  it("loads alerts at startup without model settings navigation", () => {
    expect(source).toMatch(
      /startDesktopSideEffects:[\s\S]*?loadAppAlerts\(\)/u
    );
    expect(source).toContain("useSettingsFeatureCoordinator({");
    expect(settingsCoordinatorSource).toContain("await api.get()");
    expect(featureModulesSource).not.toContain("model-alert-messages");
    expect(source).not.toContain("open-official-models");
    expect(featureHostSource).not.toContain("custom-models");
    expect(featureHostSource).not.toContain(
      'if (initialCategory === "official-models")'
    );
    expect(featureHostSource).not.toContain(
      "issueBackground(options.loaders.loadOfficialModels)"
    );
  });

  it("shows unseen desktop content and acknowledges it when dismissed", () => {
    expect(settingsCoordinatorSource).toContain("snapshot.shouldShowDesktop");
    expect(settingsCoordinatorSource).toContain("snapshot.desktopRevision");
    expect(settingsCoordinatorSource).toContain(
      "api.acknowledgeDesktop(revision)"
    );
    expect(dialogCoordinatorSource).toContain('kind: "startup-alert"');
    expect(dialogLayerSource).toContain("<StartupAlertDialog");
    expect(dialogLayerSource).toContain("@close=\"emit('closeStartupAlert')\"");
    expect(source).toContain('@close-startup-alert="closeStartupAlert"');
  });

  it("checks the remote alert again when a hidden window regains focus", () => {
    expect(source).toMatch(
      /async function refreshWorkspaceOnWindowFocus\(\): Promise<void> \{[\s\S]*?loadAppAlerts\(\)/u
    );
    expect(source).toContain("refreshOnFocus: refreshWorkspaceOnWindowFocus");
    expect(lifecycleSource).toContain("options.refreshOnFocus()");
    expect(lifecycleSource).toContain("trailingFocusRefreshRequested = true");
  });
});
