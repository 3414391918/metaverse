import treeNodeFactorySource from "../utils/longWorkspaceTreeNode.ts?raw";
import {
  agentRunPreferencesSource,
  appSource,
  describe,
  dialogCoordinatorSource,
  editorSource,
  expect,
  it,
  leftSidebarSource,
  longConversationSource,
  longStructureTransactionsSource,
  longWorkspaceModuleSource,
  longWorkspaceRefreshSource,
  longWorkspaceResourceTreeSource,
  presentationCoordinatorSource,
  proposalRuntimeSource,
  resourceTreeCoordinatorSource,
  sectionSource,
  treeNodeSource,
  workspaceDialogLayerSource,
  workspaceTypeSource
} from "./LongWorkspace.test-support";

describe("long-form renderer vertical slice: agents-writing-and-navigation", () => {
  it("projects long-form navigation into the same recursive tree used by short books", () => {
    expect(longWorkspaceResourceTreeSource).toContain(
      "function projectLongWorkspaceNavigation("
    );
    expect(treeNodeFactorySource).toContain(
      "longWorkspaceSelection: selection"
    );
    expect(resourceTreeCoordinatorSource).toContain(
      "children: projectLongWorkspaceNavigation(book, workspaceIndex)"
    );
    expect(longWorkspaceResourceTreeSource).toContain(
      "reconcileLongWorkspaceSelection(book, index, selection)"
    );
    expect(longWorkspaceResourceTreeSource).toContain(
      "[...book.navigation.worldbuilding]"
    );
    expect(
      longWorkspaceResourceTreeSource.indexOf(
        "[...book.navigation.worldbuilding]"
      )
    ).toBeLessThan(
      longWorkspaceResourceTreeSource.indexOf("...(worldRevealSelection")
    );
    expect(resourceTreeCoordinatorSource).toContain("selectableBranch: true");
    expect(resourceTreeCoordinatorSource).not.toContain('badge: "小说"');
    expect(resourceTreeCoordinatorSource).not.toContain(
      "badge: `小说 · ${book.genre}`"
    );
    expect(longStructureTransactionsSource).toContain(
      "node.longWorkspaceSelection"
    );
    expect(leftSidebarSource).toContain("<SidebarResourceList");
    expect(leftSidebarSource).not.toContain('<slot name="long-workspace" />');
    expect(treeNodeSource).toContain("<TreeNodeItem");
    expect(treeNodeSource).toContain(':depth="depth + 1"');
    for (const label of [
      "世界观",
      "人物设计",
      "剧情设计",
      "正文",
      "连续性账本"
    ]) {
      expect(longWorkspaceResourceTreeSource).toContain(label);
    }
    expect(longWorkspaceModuleSource).not.toContain("long-agent-column");
    expect(longWorkspaceModuleSource).toContain(':right-pane="false"');
    expect(appSource).toContain(':left-collapsed="leftCollapsed"');
  });

  it("wires left-tree collection actions through the existing structure pipeline", () => {
    expect(workspaceTypeSource).toContain("longTreeCollection?:");
    expect(workspaceTypeSource).toContain("longTreeItem?:");
    for (const kind of [
      "worldbuilding-item",
      "character",
      "volume",
      "plot-point",
      "chapter-card"
    ]) {
      expect(workspaceTypeSource).toContain(`"${kind}"`);
    }
    expect(leftSidebarSource).toContain("createLongTreeItem");
    expect(leftSidebarSource).toContain("longTreeItemAction");
    expect(sectionSource).toContain("createLongTreeItem");
    expect(sectionSource).toContain("longTreeItemAction");
    expect(appSource).toContain(
      '@create-long-tree-item="handleCreateLongTreeItem"'
    );
    expect(appSource).toContain(
      '@long-tree-item-action="handleLongTreeItemAction"'
    );
    expect(longStructureTransactionsSource).toContain(
      "openLongWorldbuildingItemCreateForCategoryInternal"
    );
    expect(longStructureTransactionsSource).toContain(
      "builder.reorderWorldbuildingItem("
    );
    expect(longStructureTransactionsSource).toContain(
      "builder.deleteWorldbuildingItem("
    );
    expect(longStructureTransactionsSource).toContain(
      "details.orderedIds[currentIndex + 1] ??\n          details.orderedIds[currentIndex - 1]"
    );
    expect(longStructureTransactionsSource).toContain(
      "details.parentResourceId"
    );
    expect(longStructureTransactionsSource).toContain(
      "selectCreatedLongTreeResource("
    );
    expect(longStructureTransactionsSource).toContain(
      "captureNavigationSelection()"
    );
    expect(resourceTreeCoordinatorSource).toContain(
      "synchronizeSelectedLongResourceForLayout("
    );
    expect(appSource).toContain(
      ':long-tree-actions-disabled="longBookActionPending"'
    );
    expect(dialogCoordinatorSource).toContain("itemLabel: treeDeletion.label");
    expect(workspaceDialogLayerSource).toContain(
      ':item-label="module.itemLabel"'
    );
  });

  it("does not mount conversation proposal controls in the novel editor", () => {
    expect(longWorkspaceModuleSource).not.toContain(":long-proposal-items");
    expect(longWorkspaceModuleSource).not.toContain("AgentConversation");
    expect(longWorkspaceModuleSource).toContain("<LongWorkspaceEditor");
  });

  it("keeps saves ordered and pauses long-agent sends while refreshing", () => {
    expect(longWorkspaceRefreshSource).toContain(
      "createLongWorkspaceRefreshClock()"
    );
    expect(longWorkspaceRefreshSource).toContain(
      "isCurrent(bookId, requestId)"
    );
    expect(appSource).toContain("activeLongWorkspaceContextReady");
    expect(longWorkspaceRefreshSource).toContain(
      "state.refreshStatus.value = {"
    );
    expect(appSource).toContain("retryActiveLongWorkspaceRefresh");
    expect(longWorkspaceModuleSource).not.toContain("小说智能体已暂停发送");
    expect(longWorkspaceModuleSource).not.toContain(
      'v-if="refreshStatus?.error"'
    );
    expect(appSource).not.toContain(
      'activeLongWorkspaceRefreshStatus.pending\n                    ? "正在同步保存后的最新工作区索引…"'
    );
    const sendLongMessageSource =
      longConversationSource
        .split("function sendLongMessage(")[1]
        ?.split("function synchronizeActiveRunPreferences")[0] ?? "";
    expect(sendLongMessageSource).toContain("await nextTick()");
    expect(
      sendLongMessageSource.match(/confirmSendTarget\(target\)/gu)?.length
    ).toBeGreaterThanOrEqual(4);
    expect(
      sendLongMessageSource.indexOf("saveActiveEditorChanges()")
    ).toBeLessThan(sendLongMessageSource.indexOf("refreshActiveWorkspace("));
    expect(
      sendLongMessageSource.indexOf("refreshActiveWorkspace(")
    ).toBeLessThan(sendLongMessageSource.indexOf("activeRuntimeContext.value"));
    expect(sendLongMessageSource).toContain(
      "target.conversation.sendLongMessage("
    );
    const sendTargetSource =
      longConversationSource
        .split("interface LongMessageSendTarget")[1]
        ?.split("export interface LongConversationCoordinatorOptions")[0] ?? "";
    for (const field of [
      "bookId:",
      "selectionKey:",
      "preferredRole:",
      "activeRoot:",
      "chapterCardId:",
      "fileId:",
      "agentId:",
      "conversation:",
      "sessionId:",
      "draft:"
    ]) {
      expect(sendTargetSource).toContain(field);
    }
    expect(appSource).toContain(':editor-locked="longEditorLocked"');
    expect(appSource).not.toContain("const longEditorLocked = computed(");
    expect(longWorkspaceModuleSource).toContain(':locked="editorLocked"');
    expect(presentationCoordinatorSource).toContain(
      "function agentRunScopeHasWriteBarrier(scope: string)"
    );
    expect(presentationCoordinatorSource).toContain(
      "conversation.hasPendingEditReview.value"
    );
    expect(presentationCoordinatorSource).toContain(
      "正在保存并准备发送，编辑暂时锁定"
    );
    expect(presentationCoordinatorSource).not.toContain("版本冲突");
    expect(editorSource).toContain("lockedReason?: string");
    expect(editorSource).toContain(':disabled="locked"');
    const approveSource =
      proposalRuntimeSource
        .split("async function approveProposal(")[1]
        ?.split("function rejectProposal(")[0] ?? "";
    expect(
      approveSource.indexOf("state.proposalApprovalPending.value = true")
    ).toBeLessThan(
      approveSource.indexOf("await context.workspace.saveActiveEditorChanges()")
    );
    expect(approveSource.indexOf("await nextTick()")).toBeLessThan(
      approveSource.indexOf("await context.workspace.saveActiveEditorChanges()")
    );
  });

  it("uses book-level history while retaining the current chapter as writing context", () => {
    expect(proposalRuntimeSource).toContain(
      "return longBookConversationKey(bookId)"
    );
    expect(presentationCoordinatorSource).toContain(
      "options.long.selection.value?.chapterCardId"
    );
    expect(agentRunPreferencesSource).not.toContain("shortBookConversationKey");
  });

  it("does not expose the removed long-form rollback surface", () => {
    expect(editorSource).not.toContain("回滚最后提交");
    expect(appSource).not.toContain("openLongRollbackDialog");
    expect(appSource).not.toContain("useLazyLongRollbackCoordinator");
    expect(workspaceDialogLayerSource).not.toContain("LongRollbackDialog");
  });
});
