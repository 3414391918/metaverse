import { describe, expect, it } from "vitest";
import appSource from "./test-support/workspaceShellSource";
import editorSource from "./components/LongWorkspaceEditor.vue?raw";
import coordinatorSource from "./composables/useApprovalNavigationCoordinator.ts?raw";
import lazyCoordinatorSource from "./composables/useLazyApprovalNavigationCoordinator.ts?raw";
import resourceTreeSource from "./composables/useWorkspaceResourceTreeCoordinator.ts?raw";
import editorStructureSource from "./composables/useLongEditorStructureSelection.ts?raw";
import editorFileNavigationSource from "./composables/useLongEditorFileNavigation.ts?raw";

describe("accepted approval navigation wiring", () => {
  it("does not bind retired approval cards in manual editors", () => {
    expect(appSource).not.toContain(
      '@locate-edit-proposal="locateAcceptedEditProposal"'
    );
    expect(appSource).not.toContain(
      '@locate-long-proposal="locateAcceptedLongProposal"'
    );
  });

  it("preserves the long editor save barrier and retries stale indexes", () => {
    expect(coordinatorSource).toContain(
      "context.longWorkspace.saveActiveEditorChanges()"
    );
    expect(coordinatorSource).toContain("resolved.candidateIndex > 0");
    expect(coordinatorSource).toContain(
      "await context.longWorkspace.refresh(target.bookId)"
    );
    expect(appSource).toContain("resolveLongApprovalNavigation(");
    expect(appSource).toContain("revealTextPane();");
    expect(appSource).toContain(
      'generalSettings.value.workspacePaneLayout === "agent-editor"'
    );
    expect(lazyCoordinatorSource).toContain(
      '() => import("./useApprovalNavigationCoordinator")'
    );
    expect(appSource).not.toContain(
      "import { useApprovalNavigationCoordinator }"
    );
  });

  it("selects exact left-tree items and uses parent fallbacks", () => {
    expect(resourceTreeSource).toContain(
      "function preferredLongResourceIdForSelection("
    );
    expect(resourceTreeSource).toContain(
      'selection.key.startsWith("chapter:")'
    );
    expect(editorStructureSource).toContain(
      "if (explicitlySelectedFile) return explicitlySelectedFile;"
    );
    expect(appSource).toContain(
      "preferredLongResourceId: preferredLongResourceIdForSelection"
    );
    expect(coordinatorSource).not.toContain("shortWorkspace");
    expect(coordinatorSource).toContain("await context.catalog.refresh()");
    expect(coordinatorSource).toContain("requestIsCurrent(requestId)");
    expect(appSource).toContain(
      'uiMessage.warning("目标文件或所属条目已不存在，无法跳转。")'
    );
  });

  it("lets the long editor focus exact files and structured targets", () => {
    expect(editorFileNavigationSource).toContain(
      "async function focusFile(fileId: string)"
    );
    expect(editorFileNavigationSource).toContain("async function focusTarget(");
    expect(editorFileNavigationSource).toContain(
      "target: LongApprovalEditorFocus"
    );
    expect(editorFileNavigationSource).toContain(
      "selectWorldbuildingItem(item.id)"
    );
    expect(editorFileNavigationSource).toContain(
      'selectPlotPointTab("storyline")'
    );
    expect(editorStructureSource).toContain(
      "foreshadowingWorkspace.value?.focusTarget("
    );
    expect(editorSource).toContain("defineExpose({");
  });
});
