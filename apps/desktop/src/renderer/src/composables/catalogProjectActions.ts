import type {
  CatalogLibraryProjectDomain,
  DeepWriteApi
} from "@deepwrite/contracts";
import type { Ref } from "vue";
import { uiMessage } from "../ui-feedback";

/** Loaded only when the existing directory menu requests a legacy import. */
export async function importLegacyLibraryAction(
  domain: CatalogLibraryProjectDomain,
  options: {
    api: DeepWriteApi | undefined;
    pending: Ref<boolean>;
    refresh(): Promise<void>;
    selectLibrary(id: string | undefined): void;
  }
): Promise<void> {
  if (!options.api) {
    uiMessage.warning("浏览器预览不能导入旧版资料库，请使用桌面客户端。");
    return;
  }
  if (options.pending.value) return;
  options.pending.value = true;
  try {
    const result = await options.api.catalog.importLegacyLibrary(domain);
    if (!result) return;
    await options.refresh();
    options.selectLibrary(result.imported.at(-1)?.id);
    const libraryLabel = domain === "material" ? "素材" : "技能";
    if (result.failures.length === 0) {
      uiMessage.success(
        result.imported.length === 1
          ? `已导入旧版${libraryLabel}库“${result.imported[0]!.title}”并新建资料库`
          : `已导入 ${result.imported.length} 个旧版${libraryLabel}库并新建资料库`
      );
    } else {
      const failureSummary = result.failures
        .map(({ fileName, message }) => `${fileName}：${message}`)
        .join("；");
      if (result.imported.length > 0)
        uiMessage.warning(
          `已导入 ${result.imported.length} 个旧版${libraryLabel}库，${result.failures.length} 个失败：${failureSummary}`
        );
      else uiMessage.error(`导入旧版${libraryLabel}库失败：${failureSummary}`);
    }
  } catch (error: unknown) {
    uiMessage.error(
      error instanceof Error ? error.message : "导入旧版资料库失败。"
    );
  } finally {
    options.pending.value = false;
  }
}

export async function openCatalogProjectAction(
  domain: "book" | CatalogLibraryProjectDomain,
  options: {
    api: DeepWriteApi | undefined;
    pending: Ref<boolean>;
    refresh(): Promise<void>;
    select(
      opened: NonNullable<
        Awaited<ReturnType<DeepWriteApi["catalog"]["openProject"]>>
      >
    ): Promise<void>;
  }
): Promise<void> {
  if (!options.api) {
    uiMessage.warning("浏览器预览不能打开本地文件夹，请使用桌面客户端。");
    return;
  }
  if (options.pending.value) return;
  options.pending.value = true;
  try {
    const opened = await options.api.catalog.openProject(domain);
    if (!opened) return;
    await options.refresh();
    await options.select(opened);
    uiMessage.success(
      `已打开${opened.domain === "book" ? "书籍" : opened.domain === "material" ? "素材库" : "技能库"}“${opened.title}”`
    );
  } catch (error: unknown) {
    uiMessage.error(
      error instanceof Error ? error.message : "打开本地项目失败。"
    );
  } finally {
    options.pending.value = false;
  }
}
