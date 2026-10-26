import { expectSourceToContain } from "../../../test-utils/sourceText";
import { describe, expect, it } from "vitest";
import asyncComponentsSource from "./lazyAppComponents.ts?raw";
import featureImportsSource from "./lazyFeatureImports.ts?raw";
const lazyComponentsSource = `${asyncComponentsSource}\n${featureImportsSource}`;
import typesSource from "./WorkspaceFeatureModules.types.ts?raw";
import source from "./WorkspaceFeatureModules.vue?raw";

describe("WorkspaceFeatureModules boundary", () => {
  it("owns the mutually exclusive non-writing feature branches", () => {
    for (const kind of [
      "settings",
      "tools",
      "prompt-templates",
      "voice-manager"
    ]) {
      expect(source).toContain(`module.kind === '${kind}'`);
    }
    expect(source).toContain("<SettingsPage");
    expect(source).toContain("<ToolManager");
    expect(source).not.toContain("<AgentTeamCatalogFeature");
    expect(source).not.toContain("RevisionAnalysisPage");
    expect(source).not.toContain("<WorkspaceDirectoryFeature");
    expect(source).toContain(
      ':workspace-directory-path="module.workspaceDirectoryPath"'
    );
    expect(source).toContain(
      "@choose-workspace-directory=\"emit('chooseWorkspaceDirectory')\""
    );
    expect(source).not.toContain("<ModelSettingsFeature");
    expect(source).not.toContain("v-show");
    expect(source).not.toContain("KeepAlive");
  });

  it("keeps feature pages behind the existing lazy component registry", () => {
    expect(source).toContain('from "./lazyAppComponents"');
    expect(source).not.toMatch(
      /import\s+\w+\s+from\s+"\.\/(?:SettingsPage|AgentTeamSettingsPanel|WorkspaceDirectoryFeature|ModelSettingsFeature|LearningImitationDialog|SkillMarketplacePage)\.vue"/u
    );
    expect(source).not.toContain(
      'from "../extras/cloud-backup/CloudBackupPage.vue"'
    );
    expectSourceToContain(
      lazyComponentsSource,
      '() => import("./WorkspaceFeatureModules.vue")'
    );
  });

  it("uses one typed low-frequency module input without absorbing writing state", () => {
    expect(typesSource).toContain("export type WorkspaceFeatureModule =");
    expect(source).toContain("module: WorkspaceFeatureModule");
    expect(typesSource).not.toContain("SubagentAuthoringController");
    expect(source).not.toMatch(/\bany\b/u);
    expect(typesSource).not.toMatch(/\bany\b/u);
    expect(source).not.toContain("$attrs");
    expect(source).not.toContain("conversationController");
    expect(source).not.toContain("WritingWorkspaceModule");
    expect(source).not.toContain("LongWorkspaceModule");
    expect(source).not.toContain("LeftSidebar");
    expect(source).not.toContain("DialogHost");
  });

  it("keeps settings and tools behind the shell boundary", () => {
    expect(source).toContain("v-else-if=\"module.kind === 'settings'\"");
    expect(source).toContain(':initial-category="module.initialCategory"');
    expect(source).toContain("v-else-if=\"module.kind === 'resources'\"");
    expect(source).toContain("v-else-if=\"module.kind === 'tools'\"");
    expect(source).not.toContain(":authoring-generating");
  });
});
