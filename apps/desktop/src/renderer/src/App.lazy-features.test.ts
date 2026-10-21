import { describe, expect, it } from "vitest";
import { expectSourceToContain } from "../../test-utils/sourceText";
import source from "./test-support/workspaceShellSource";
import dialogLayerSource from "./components/WorkspaceDialogLayer.vue?raw";
import featureModulesSource from "./components/WorkspaceFeatureModules.vue?raw";
import asyncComponentsSource from "./components/lazyAppComponents.ts?raw";
import featureImportsSource from "./components/lazyFeatureImports.ts?raw";
const lazyComponentsSource = `${asyncComponentsSource}\n${featureImportsSource}`;
import featureHostSource from "./composables/useWorkspaceFeatureHostCoordinator.ts?raw";
import settingsPageSource from "./components/SettingsPage.vue?raw";

describe("App lazy feature mounting", () => {
  it("keeps only the default writing surface in the eager component imports", () => {
    expect(source).toContain('from "./lazyAppComponents"');
    expectSourceToContain(lazyComponentsSource, "defineAsyncComponent");
    expect(lazyComponentsSource).toContain(
      '() => import("./SettingsPage.vue")'
    );
    expectSourceToContain(
      lazyComponentsSource,
      '() => import("./LongWorkspaceModule.vue")'
    );
    expectSourceToContain(
      lazyComponentsSource,
      '() => import("./ToolManager.vue")'
    );
    expect(lazyComponentsSource).not.toContain("CloudBackupPage.vue");
    expect(lazyComponentsSource).not.toContain("ModelSettingsFeature.vue");
    expect(lazyComponentsSource).not.toContain("loadWorkspaceDirectoryFeature");
    expect(source).not.toContain(
      'import SettingsPage from "./components/SettingsPage.vue"'
    );
    expect(source).not.toContain(
      'import LongWorkspaceEditor from "./components/LongWorkspaceEditor.vue"'
    );
  });

  it("places the workspace directory in personal settings", () => {
    expect(settingsPageSource).toContain('id: "directory", label: "工作目录"');
    expect(settingsPageSource).toContain("<WorkspaceDirectoryFeature");
    expect(featureModulesSource).not.toContain("<WorkspaceDirectoryFeature");
    expect(featureModulesSource).not.toContain("<ModelSettingsFeature\n");
    expect(source).toContain("<WorkspaceFeatureModules");
    expect(source).not.toContain("<WorkspaceDirectoryFeature");
    expect(source).not.toContain("<ModelSettingsFeature");
    expect(featureModulesSource).not.toContain(
      ":mode=\"workspaceMainView === 'directory' ? 'directory' : 'models'\""
    );
  });

  it("conditionally mounts mutually exclusive feature pages and heavy dialogs", () => {
    expect(source).toContain("useWorkspaceFeatureHostCoordinator({");
    expect(featureHostSource).toContain(
      "const workspaceFeatureModule = computed"
    );
    expect(featureModulesSource).not.toContain("module.kind === 'marketplace'");
    expect(featureModulesSource).not.toContain(
      "module.kind === 'cloud-backup'"
    );
    expect(source).toContain("v-if=\"activeFeature === 'long-workspace'\"");
    expect(source).not.toContain("<KeepAlive>");
    expect(source).toContain(
      '<WorkspaceDialogLayer\n    v-if="workspaceDialogModule"'
    );
    expectSourceToContain(dialogLayerSource, '<DialogHost v-if="module"');
    expect(dialogLayerSource).toContain(':active-dialog="module.kind"');

    expectSourceToContain(dialogLayerSource, "<CreateBookDialog");
    expect(dialogLayerSource).toContain("module.kind === 'create-book'");
    expect(dialogLayerSource).toContain(
      "<SaveConflictDialog\n      v-else-if=\"module.kind === 'save-conflict'\""
    );
    expect(source).not.toContain("<BookResourceDialog\n");
    expect(source).not.toContain('v-show="workspaceMainView');
  });
});
