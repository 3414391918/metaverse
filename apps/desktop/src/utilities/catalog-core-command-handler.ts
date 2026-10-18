import {
  BookSchema,
  CatalogDraftRecoverySaveResultSchema,
  CatalogDraftRecoverySchema,
  CatalogIndexSnapshotSchema,
  CatalogLibraryEntrySchema,
  CatalogLibraryGroupSchema,
  CatalogLibrarySchema,
  CatalogOpenProjectResultSchema,
  CatalogReadDocumentResultSchema,
  CatalogSnapshotSchema,
  DeleteBookResultSchema,
  DeleteCatalogProjectResultSchema,
  DuplicateCatalogProjectResultSchema,
  ImportLibraryEntriesResultSchema,
  LongWorkspaceOperationError,
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
  FolderCatalogConflictError,
  FolderCatalogStore
} from "./folder-catalog-store";
import { readLegacyLibraryArchive } from "./legacy-library-import";
import { LibraryManagementService } from "./library-management-service";
import { handleLongCoreCommand } from "./long-core-commands";
import { LongWorkspaceService } from "./long-workspace-service";
import { MaterialQueryService } from "./material-query-service";

export function createCatalogCoreHandler(options: {
  requireCatalogStore: () => Promise<FolderCatalogStore>;
  longWorkspaceService: LongWorkspaceService;
  draftRecoveryStore: FolderCatalogStore;
}) {
  const { requireCatalogStore, longWorkspaceService, draftRecoveryStore } =
    options;
  let materialQueryService: MaterialQueryService | undefined;
  async function handleCatalogCommand(
    command: CommandEnvelope
  ): Promise<CommandResult> {
    try {
      const longResult = await handleLongCoreCommand(
        longWorkspaceService,
        command
      );
      if (longResult) return longResult;
      if (command.type === "catalog.loadDraftRecovery") {
        return {
          status: "accepted",
          requestId: command.id,
          payload: CatalogDraftRecoverySchema.parse(
            await draftRecoveryStore.loadDraftRecovery()
          )
        };
      }
      if (command.type === "catalog.saveDraftRecovery") {
        await draftRecoveryStore.saveDraftRecovery(command.payload.drafts);
        return {
          status: "accepted",
          requestId: command.id,
          payload: CatalogDraftRecoverySaveResultSchema.parse({ saved: true })
        };
      }
      const catalogStore = await requireCatalogStore();
      if (
        (command.type === "catalog.createLibraryEntry" ||
          command.type === "catalog.saveLibraryEntry" ||
          command.type === "catalog.updateLibrary") &&
        command.payload.managementScope
      ) {
        await new LibraryManagementService(
          catalogStore,
          longWorkspaceService
        ).assertWritable(
          command.payload.managementScope,
          command.payload.domain,
          command.payload.libraryId
        );
      }
      if (command.type === "catalog.queryLibraryManagement") {
        const service = new LibraryManagementService(
          await requireCatalogStore(),
          longWorkspaceService
        );
        return {
          status: "accepted",
          requestId: command.id,
          payload: await service.query(command.payload)
        };
      }
      if (command.type === "catalog.queryMaterials") {
        materialQueryService ??= new MaterialQueryService(
          catalogStore,
          longWorkspaceService
        );
        return {
          status: "accepted",
          requestId: command.id,
          payload: await materialQueryService.query(command.payload)
        };
      }
      if (command.type === "catalog.index") {
        return {
          status: "accepted",
          requestId: command.id,
          payload: CatalogIndexSnapshotSchema.parse(
            await catalogStore.indexSnapshot()
          )
        };
      }
      if (command.type === "catalog.readDocument") {
        return {
          status: "accepted",
          requestId: command.id,
          payload: CatalogReadDocumentResultSchema.parse(
            await catalogStore.readDocument(command.payload)
          )
        };
      }
      if (command.type === "catalog.readWritingContext") {
        return {
          status: "accepted",
          requestId: command.id,
          payload: ReadWritingContextResultSchema.parse(
            await catalogStore.readWritingContext(command.payload)
          )
        };
      }
      if (command.type === "catalog.writeWritingContext") {
        return {
          status: "accepted",
          requestId: command.id,
          payload: WriteWritingContextResultSchema.parse(
            await catalogStore.writeWritingContext(command.payload)
          )
        };
      }
      if (command.type === "catalog.snapshot") {
        return {
          status: "accepted",
          requestId: command.id,
          payload: CatalogSnapshotSchema.parse(await catalogStore.snapshot())
        };
      }
      if (command.type === "catalog.importLegacyLibraryAtPath") {
        const imported = await catalogStore.importLegacyLibrary(
          await readLegacyLibraryArchive(
            command.payload.archivePath,
            command.payload.domain
          ),
          command.payload.parentDirectory
        );
        return {
          status: "accepted",
          requestId: command.id,
          payload: CatalogLibrarySchema.parse(imported.resource)
        };
      }
      if (command.type === "catalog.createLibraryAtPath") {
        const created = await catalogStore.createLibrary(command.payload);
        return {
          status: "accepted",
          requestId: command.id,
          payload: CatalogLibrarySchema.parse(created.resource)
        };
      }
      if (command.type === "catalog.createLibraryGroup") {
        const created = await catalogStore.createLibraryGroup(command.payload);
        return {
          status: "accepted",
          requestId: command.id,
          payload: CatalogLibraryGroupSchema.parse(created.resource)
        };
      }
      if (command.type === "catalog.createLibraryGroupAtPath") {
        const created = await catalogStore.createLibraryGroup({
          ...command.payload.input,
          parentDirectory: command.payload.parentDirectory
        });
        return {
          status: "accepted",
          requestId: command.id,
          payload: CatalogLibraryGroupSchema.parse(created.resource)
        };
      }
      if (command.type === "catalog.openProjectAtPath") {
        const opened =
          command.payload.domain === "book"
            ? await catalogStore.openBookProject(
                command.payload.projectDirectory
              )
            : command.payload.domain === "material"
              ? await catalogStore.openMaterialProject(
                  command.payload.projectDirectory
                )
              : await catalogStore.openSkillProject(
                  command.payload.projectDirectory
                );
        return {
          status: "accepted",
          requestId: command.id,
          payload: CatalogOpenProjectResultSchema.parse({
            domain: command.payload.domain,
            id: opened.resource.id,
            title: opened.resource.title
          })
        };
      }
      if (command.type === "catalog.updateBook") {
        return {
          status: "accepted",
          requestId: command.id,
          payload: BookSchema.parse(
            await catalogStore.updateBook(command.payload)
          )
        };
      }
      if (command.type === "catalog.updateLibraryGroup") {
        return {
          status: "accepted",
          requestId: command.id,
          payload: CatalogLibraryGroupSchema.parse(
            await catalogStore.updateLibraryGroup(command.payload)
          )
        };
      }
      if (command.type === "catalog.deleteBook") {
        return {
          status: "accepted",
          requestId: command.id,
          payload: DeleteBookResultSchema.parse(
            await catalogStore.removeBook(command.payload.bookId)
          )
        };
      }
      if (command.type === "catalog.saveDocument") {
        return {
          status: "accepted",
          requestId: command.id,
          payload: SaveDocumentResultSchema.parse(
            await catalogStore.saveDocument(command.payload)
          )
        };
      }
      if (command.type === "catalog.saveLibraryEntry") {
        return {
          status: "accepted",
          requestId: command.id,
          payload: CatalogLibraryEntrySchema.parse(
            await catalogStore.saveLibraryEntry(command.payload)
          )
        };
      }
      if (command.type === "catalog.createLibraryEntry") {
        return {
          status: "accepted",
          requestId: command.id,
          payload: CatalogLibraryEntrySchema.parse(
            await catalogStore.createLibraryEntry(command.payload)
          )
        };
      }
      if (command.type === "catalog.importLibraryEntries") {
        return {
          status: "accepted",
          requestId: command.id,
          payload: ImportLibraryEntriesResultSchema.parse(
            await catalogStore.importLibraryEntries(command.payload)
          )
        };
      }
      if (command.type === "catalog.updateLibrary") {
        return {
          status: "accepted",
          requestId: command.id,
          payload: CatalogLibrarySchema.parse(
            await catalogStore.updateLibrary(command.payload)
          )
        };
      }
      if (command.type === "catalog.moveLibraryEntry") {
        return {
          status: "accepted",
          requestId: command.id,
          payload: MoveLibraryEntryResultSchema.parse(
            await catalogStore.moveLibraryEntry(command.payload)
          )
        };
      }
      if (command.type === "catalog.removeLibraryEntry") {
        return {
          status: "accepted",
          requestId: command.id,
          payload: RemoveLibraryEntryResultSchema.parse(
            await catalogStore.removeLibraryEntry(command.payload)
          )
        };
      }
      if (command.type === "catalog.unregisterProject") {
        return {
          status: "accepted",
          requestId: command.id,
          payload: UnregisterCatalogProjectResultSchema.parse(
            await catalogStore.unregisterProject(command.payload)
          )
        };
      }
      if (command.type === "catalog.deleteProject") {
        return {
          status: "accepted",
          requestId: command.id,
          payload: DeleteCatalogProjectResultSchema.parse(
            await catalogStore.deleteProject(command.payload)
          )
        };
      }
      if (command.type === "catalog.duplicateProject") {
        return {
          status: "accepted",
          requestId: command.id,
          payload: DuplicateCatalogProjectResultSchema.parse(
            await catalogStore.duplicateProject(command.payload)
          )
        };
      }
      return {
        status: "rejected",
        requestId: command.id,
        error: {
          code: "core.unsupported_command",
          message: `Core Utility does not handle ${command.type}.`
        }
      };
    } catch (error: unknown) {
      if (error instanceof LongWorkspaceOperationError) {
        return {
          status: "rejected",
          requestId: command.id,
          error: {
            code: `long.operation.${error.code}`,
            message: error.message,
            details: {
              kind: error.name,
              operationCode: error.code
            }
          }
        };
      }
      if (error instanceof FolderCatalogConflictError) {
        return {
          status: "rejected",
          requestId: command.id,
          error: {
            code: "catalog.conflict",
            message: error.message,
            details: {
              expectedRevision: error.expectedRevision,
              actualRevision: error.actualRevision
            }
          }
        };
      }
      return {
        status: "rejected",
        requestId: command.id,
        error: {
          code: "catalog.command_failed",
          message: error instanceof Error ? error.message : "目录操作失败。",
          details: {
            kind: error instanceof Error ? error.name : "unknown"
          }
        }
      };
    }
  }
  return handleCatalogCommand;
}
