import { describe, expect, it } from "vitest";
import shellSource from "../test-support/workspaceShellSource";
import editorBridgeSource from "../composables/useLongWorkspaceModuleEditorBridge.ts?raw";
import editorSource from "./LongWorkspaceEditor.vue?raw";
import source from "./LongWorkspaceModule.vue?raw";

describe("LongWorkspaceModule boundary", () => {
  it("owns the full-width manual novel editor", () => {
    expect(shellSource).toContain("<LongWorkspaceModule");
    expect(shellSource).not.toContain("<LongWorkspaceEditor");
    expect(source).toContain("<LongWorkspaceEditor");
    expect(source).not.toContain("AgentConversation");
    expect(source).not.toContain("long-agent-column");
    expect(source).not.toContain("pane-resizer-right");
    expect(source).toContain(':right-pane="false"');
    expect(source).toContain(':right-pane-collapsed="false"');
    expect(editorSource).toContain("allowReferences: false");
  });

  it("does not bind a main agent controller or composer", () => {
    expect(shellSource).not.toContain(
      ':conversation-controller="activeLongConversation"'
    );
    expect(source).not.toContain("conversationController");
    expect(source).not.toContain("composer");
    expect(source).not.toMatch(/\bany\b/u);
  });

  it("preserves the inner editor port and multi-argument event contracts", () => {
    expect(source).toContain(
      "editorPortChange: [port: LongWorkspaceEditorPort | null]"
    );
    expect(source).toContain(':ref="captureEditorPort"');
    expect(source).toContain(
      'import LongWorkspaceEditor from "./LongWorkspaceEditor.vue"'
    );
    expect(source).toContain("useLongWorkspaceModuleEditorBridge({");
    expect(editorBridgeSource).toContain("isLongWorkspaceEditorPort(instance)");
    expect(source).not.toContain(
      'import { LongWorkspaceEditor } from "./lazyAppComponents"'
    );
    expect(editorBridgeSource).toContain("options.publish(null)");
    expect(shellSource).toContain(
      '@editor-port-change="updateLongWorkspaceEditorPort"'
    );
    expect(source).toContain('emit("renameStructureTitle", input, completion)');
    expect(source).toContain('emit("mutation", batch, completion)');
  });
});
