import { describe, expect, it } from "vitest";
import appSource from "../test-support/workspaceShellSource";
import asyncComponentsSource from "./lazyAppComponents.ts?raw";
import featureImportsSource from "./lazyFeatureImports.ts?raw";
const lazyComponentsSource = `${asyncComponentsSource}\n${featureImportsSource}`;
import source from "./WritingWorkspaceModule.vue?raw";

describe("WritingWorkspaceModule boundary", () => {
  it("owns a manual library editor without conversation UI", () => {
    expect(source).toContain("<RightEditorPane");
    expect(source).not.toContain("AgentConversation");
    expect(source).not.toContain("pane-resizer-right");
    expect(lazyComponentsSource).not.toContain("./AgentConversation.vue");
    expect(appSource).toContain("<WritingWorkspaceModule");
    expect(appSource).not.toContain("<RightEditorPane");
  });

  it("keeps document, save and live-change ports without agent bindings", () => {
    expect(source).toContain('v-bind="editor"');
    expect(source).toContain(':right-pane="false"');
    expect(source).toContain(':right-pane-collapsed="false"');
    expect(source).toContain("@save=\"emit('save', $event)\"");
    expect(source).toContain("@live-change=\"emit('liveChange', $event)\"");
    expect(source).not.toContain("conversationController");
    expect(source).not.toMatch(/\bany\b/u);
    expect(appSource).toContain('@save="applyDocument"');
    expect(appSource).not.toContain(
      ':conversation-controller="activeConversation"'
    );
  });

  it("keeps the left navigation resizer in the App shell", () => {
    expect(appSource).toContain('class="pane-resizer pane-resizer-left"');
    expect(source).not.toContain("pane-resizer-left");
    expect(source).not.toContain("workspaceMainView");
  });
});
