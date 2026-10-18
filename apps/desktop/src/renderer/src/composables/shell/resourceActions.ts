import type { ShellRuntimePorts } from "./runtimePorts";
import type { ResourceActionsRuntime } from "./resourceActions.types";
import type { BookTransferAction } from "../../components/BookTransferDialog.vue";
import { uiMessage } from "../../ui-feedback";
import type { ResourceSectionActionPayload } from "../../types/workspace";
import { resolveLongWorkspaceApi } from "../../types/longWorkspace";

/** resourceActions assembly for the novel and library workspace. */
export function useShellResourceActions(
  ports: ShellRuntimePorts
): ResourceActionsRuntime {
  async function refreshImportedCatalog(): Promise<void> {
    await ports.features.featureHost.loadWorkspaceDirectory();
    await ports.editor.loadCatalogSnapshot();
  }

  async function handleResourceAction(
    payload: ResourceSectionActionPayload
  ): Promise<void> {
    if (
      payload.domain === "creation" &&
      (payload.action === "choose-open-book" ||
        payload.action === "choose-import-book")
    ) {
      if (!window.deepwrite) {
        uiMessage.warning("浏览器预览不能打开本地作品，请使用桌面客户端。");
        return;
      }
      ports.state.bookTransferDialogMode.value =
        payload.action === "choose-open-book" ? "open" : "import";
      return;
    }

    if (
      payload.domain === "creation" &&
      payload.action === "refresh-long-books"
    ) {
      if (!resolveLongWorkspaceApi()) {
        uiMessage.warning("浏览器预览不能刷新本地小说，请使用桌面客户端。");
        return;
      }
      await ports.novel.loadLongBookList({ notify: true, force: true });
      if (!ports.state.longCatalogLoadError.value) {
        uiMessage.success("小说列表已刷新");
      }
      return;
    }

    if (payload.domain === "creation" && payload.action === "open-long-book") {
      await ports.novelTransactions.openExistingLongBook();
      return;
    }

    if (
      payload.domain === "creation" &&
      payload.action === "import-continuation-long-book"
    ) {
      await ports.novelTransactions.chooseContinuationImportSource();
      return;
    }

    if (
      payload.domain === "creation" &&
      payload.action === "import-portable-long-book"
    ) {
      await ports.novelTransactions.importPortableLongBook();
      return;
    }

    if (payload.domain === "creation" && payload.action === "create") {
      ports.features.openCreateBookDialog();
      return;
    }

    if (
      payload.action === "create" &&
      (payload.domain === "material" || payload.domain === "skill")
    ) {
      if (!window.deepwrite) {
        uiMessage.warning("浏览器预览不能创建本地资料库，请使用桌面客户端。");
        return;
      }
      ports.libraries.libraryProjectDialog.value = {
        operation: "create-library",
        domain: payload.domain
      };
      return;
    }

    if (
      payload.action === "create-group" &&
      (payload.domain === "material" || payload.domain === "skill")
    ) {
      if (!window.deepwrite) {
        uiMessage.warning("浏览器预览不能创建本地分组，请使用桌面客户端。");
        return;
      }
      ports.libraries.libraryGroupDialog.value = { domain: payload.domain };
      return;
    }

    if (
      payload.action === "import-legacy-library" &&
      (payload.domain === "material" || payload.domain === "skill")
    ) {
      const { importLegacyLibraryAction } =
        await import("../../composables/catalogProjectActions");
      await importLegacyLibraryAction(payload.domain, {
        api: window.deepwrite,
        pending: ports.state.catalogMutationPending,
        refresh: refreshImportedCatalog,
        selectLibrary: (id) => {
          const target = ports.state.documents.value.find(
            (document) => document.libraryId === id
          );
          if (target) {
            ports.state.selectedResourceId.value = target.id;
            ports.editor.revealTextPane();
          }
        }
      });
      return;
    }

    if (payload.action === "import-external-library") {
      if (payload.domain !== "creation")
        ports.libraries.externalLibraryImport.open(payload.domain);
      return;
    }

    if (payload.action === "import" && payload.domain !== "creation") {
      const { openCatalogProjectAction } =
        await import("../../composables/catalogProjectActions");
      await openCatalogProjectAction(payload.domain, {
        api: window.deepwrite,
        pending: ports.state.catalogMutationPending,
        refresh: refreshImportedCatalog,
        select: async (opened) => {
          const targetResourceId = ports.state.documents.value.find(
            (document) => document.libraryId === opened.id
          )?.id;
          if (targetResourceId) {
            const targetNode = ports.resources.findResourceNodeIn(
              ports.tree.resourceTreeSections.value,
              targetResourceId
            );
            if (targetNode) await ports.resources.selectResource(targetNode);
          }
        }
      });
      return;
    }

    uiMessage.info("当前资源操作暂不可用。");
  }

  function handleBookTransferSelect(action: BookTransferAction): void {
    ports.state.bookTransferDialogMode.value = null;
    void handleResourceAction({
      domain: "creation",
      action
    });
  }
  return { handleResourceAction, handleBookTransferSelect };
}
