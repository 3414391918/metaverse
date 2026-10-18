import {
  BookSchema,
  CatalogDraftRecoverySaveResultSchema,
  CatalogDraftRecoverySchema,
  CatalogIndexSnapshotSchema,
  CatalogLibraryEntrySchema,
  CatalogLibraryGroupSchema,
  CatalogLibrarySchema,
  CatalogReadDocumentResultSchema,
  CatalogSnapshotSchema,
  DeleteBookResultSchema,
  DeleteCatalogProjectResultSchema,
  DuplicateCatalogProjectResultSchema,
  ExternalLibrarySelectionResultSchema,
  ImportLibraryEntriesResultSchema,
  MoveLibraryEntryResultSchema,
  ReadWritingContextResultSchema,
  RemoveLibraryEntryResultSchema,
  SaveDocumentResultSchema,
  UnregisterCatalogProjectResultSchema,
  WriteWritingContextResultSchema,
  type CommandEnvelope,
  type CommandResult
} from "@deepwrite/contracts";
import {
  catalogCommandTimeoutMessage,
  catalogCommandTimeoutMs
} from "../catalog-command-timeout";
import { UtilityCommandTimeoutError } from "../supervisor";
import { handleCatalogProjectCommands } from "./catalog-project-commands";
import type { IpcCommandContext } from "./command-types";
import { safeErrorDetails } from "./errors";
export async function handleCatalogCommands(
  ctx: IpcCommandContext,
  command: CommandEnvelope
): Promise<CommandResult | undefined> {
  const projectResult = await handleCatalogProjectCommands(ctx, command);
  if (projectResult) return projectResult;
  if (command.type === "catalog.chooseExternalLibraryEntries") {
    try {
      const selection =
        command.payload.sourceKind === "directory"
          ? ctx.getMainWindow()
            ? await ctx.dialog.showOpenDialog(ctx.getMainWindow(), {
                title: "选择包含技能或素材的文件夹",
                properties: ["openDirectory"]
              })
            : await ctx.dialog.showOpenDialog({
                title: "选择包含技能或素材的文件夹",
                properties: ["openDirectory"]
              })
          : ctx.getMainWindow()
            ? await ctx.dialog.showOpenDialog(ctx.getMainWindow(), {
                title: "选择技能或素材文件",
                properties: ["openFile", "multiSelections"],
                filters: [
                  {
                    name: "文本与文档",
                    extensions: ["txt", "md", "markdown", "doc", "docx", "pdf"]
                  }
                ]
              })
            : await ctx.dialog.showOpenDialog({
                title: "选择技能或素材文件",
                properties: ["openFile", "multiSelections"],
                filters: [
                  {
                    name: "文本与文档",
                    extensions: ["txt", "md", "markdown", "doc", "docx", "pdf"]
                  }
                ]
              });
      if (selection.canceled || selection.filePaths.length === 0) {
        return {
          status: "accepted",
          requestId: command.id,
          payload: null
        };
      }
      return {
        status: "accepted",
        requestId: command.id,
        payload: ExternalLibrarySelectionResultSchema.parse(
          await ctx.readExternalLibraryEntries(
            command.payload.sourceKind,
            selection.filePaths
          )
        )
      };
    } catch (error: unknown) {
      return {
        status: "rejected",
        requestId: command.id,
        error: {
          code: "catalog.choose_external_library_entries_failed",
          message:
            error instanceof Error ? error.message : "读取外部资料失败。",
          details: safeErrorDetails(error)
        }
      };
    }
  }
  if (
    command.type === "catalog.index" ||
    command.type === "catalog.readDocument" ||
    command.type === "catalog.readWritingContext" ||
    command.type === "catalog.writeWritingContext" ||
    command.type === "catalog.snapshot" ||
    command.type === "catalog.loadDraftRecovery" ||
    command.type === "catalog.saveDraftRecovery" ||
    command.type === "catalog.updateBook" ||
    command.type === "catalog.updateLibraryGroup" ||
    command.type === "catalog.updateLibrary" ||
    command.type === "catalog.deleteBook" ||
    command.type === "catalog.saveDocument" ||
    command.type === "catalog.saveLibraryEntry" ||
    command.type === "catalog.createLibraryEntry" ||
    command.type === "catalog.importLibraryEntries" ||
    command.type === "catalog.removeLibraryEntry" ||
    command.type === "catalog.moveLibraryEntry" ||
    command.type === "catalog.unregisterProject" ||
    command.type === "catalog.deleteProject" ||
    command.type === "catalog.duplicateProject"
  ) {
    try {
      const result = await ctx.supervisor.requestCommand(
        "core",
        command,
        catalogCommandTimeoutMs(command.type)
      );
      if (result.status === "rejected") {
        return result;
      }
      let payload: unknown;
      switch (command.type) {
        case "catalog.index":
          payload = CatalogIndexSnapshotSchema.parse(result.payload);
          break;
        case "catalog.readDocument":
          payload = CatalogReadDocumentResultSchema.parse(result.payload);
          break;
        case "catalog.readWritingContext":
          payload = ReadWritingContextResultSchema.parse(result.payload);
          break;
        case "catalog.writeWritingContext":
          payload = WriteWritingContextResultSchema.parse(result.payload);
          break;
        case "catalog.snapshot":
          payload = CatalogSnapshotSchema.parse(result.payload);
          break;
        case "catalog.loadDraftRecovery":
          payload = CatalogDraftRecoverySchema.parse(result.payload);
          break;
        case "catalog.saveDraftRecovery":
          payload = CatalogDraftRecoverySaveResultSchema.parse(result.payload);
          break;
        case "catalog.deleteBook":
          payload = DeleteBookResultSchema.parse(result.payload);
          break;
        case "catalog.saveDocument":
          payload = SaveDocumentResultSchema.parse(result.payload);
          break;
        case "catalog.saveLibraryEntry":
        case "catalog.createLibraryEntry":
          payload = CatalogLibraryEntrySchema.parse(result.payload);
          break;
        case "catalog.importLibraryEntries":
          payload = ImportLibraryEntriesResultSchema.parse(result.payload);
          break;
        case "catalog.removeLibraryEntry":
          payload = RemoveLibraryEntryResultSchema.parse(result.payload);
          break;
        case "catalog.moveLibraryEntry":
          payload = MoveLibraryEntryResultSchema.parse(result.payload);
          break;
        case "catalog.updateLibrary":
          payload = CatalogLibrarySchema.parse(result.payload);
          break;
        case "catalog.unregisterProject":
          payload = UnregisterCatalogProjectResultSchema.parse(result.payload);
          break;
        case "catalog.deleteProject":
          payload = DeleteCatalogProjectResultSchema.parse(result.payload);
          break;
        case "catalog.duplicateProject":
          payload = DuplicateCatalogProjectResultSchema.parse(result.payload);
          break;
        case "catalog.updateBook":
          payload = BookSchema.parse(result.payload);
          break;
        case "catalog.updateLibraryGroup":
          payload = CatalogLibraryGroupSchema.parse(result.payload);
          break;
      }
      return { status: "accepted", requestId: command.id, payload };
    } catch (error: unknown) {
      const timedOut = error instanceof UtilityCommandTimeoutError;
      return {
        status: "rejected",
        requestId: command.id,
        error: {
          code: timedOut ? "catalog.command_timeout" : "catalog.forward_failed",
          message: timedOut
            ? catalogCommandTimeoutMessage(command.type)
            : error instanceof Error
              ? error.message
              : "目录操作失败。",
          details: safeErrorDetails(error)
        }
      };
    }
  }
  return undefined;
}
