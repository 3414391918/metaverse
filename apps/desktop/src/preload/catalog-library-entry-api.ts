import {
  CatalogLibraryEntrySchema,
  CreateLibraryEntryInputSchema,
  ExternalLibrarySelectionResultSchema,
  ExternalLibrarySourceKindSchema,
  ImportLibraryEntriesInputSchema,
  ImportLibraryEntriesResultSchema,
  MoveLibraryEntryInputSchema,
  MoveLibraryEntryResultSchema,
  RemoveLibraryEntryInputSchema,
  RemoveLibraryEntryResultSchema,
  SaveLibraryEntryInputSchema,
  createEnvelope,
  type CatalogLibraryEntry,
  type CreateLibraryEntryInput,
  type ExternalLibrarySelectionResult,
  type ExternalLibrarySourceKind,
  type ImportLibraryEntriesInput,
  type ImportLibraryEntriesResult,
  type MoveLibraryEntryInput,
  type MoveLibraryEntryResult,
  type RemoveLibraryEntryInput,
  type RemoveLibraryEntryResult,
  type SaveLibraryEntryInput
} from "@deepwrite/contracts";
import { browserId, invokeCommand } from "./invoke";
export async function saveLibraryEntry(
  rawInput: SaveLibraryEntryInput
): Promise<CatalogLibraryEntry> {
  const input = SaveLibraryEntryInputSchema.parse(rawInput);
  const id = browserId("cmd_catalog_save_library_entry");
  return CatalogLibraryEntrySchema.parse(
    await invokeCommand<CatalogLibraryEntry>(
      createEnvelope("catalog.saveLibraryEntry", input, {
        id,
        correlationId: id,
        context: { resourceId: input.libraryId }
      })
    )
  );
}

export async function createLibraryEntry(
  rawInput: CreateLibraryEntryInput
): Promise<CatalogLibraryEntry> {
  const input = CreateLibraryEntryInputSchema.parse(rawInput);
  const id = browserId("cmd_catalog_create_library_entry");
  return CatalogLibraryEntrySchema.parse(
    await invokeCommand<CatalogLibraryEntry>(
      createEnvelope("catalog.createLibraryEntry", input, {
        id,
        correlationId: id,
        context: { resourceId: input.libraryId }
      })
    )
  );
}

export async function chooseExternalLibraryEntries(
  rawSourceKind: ExternalLibrarySourceKind
): Promise<ExternalLibrarySelectionResult | null> {
  const sourceKind = ExternalLibrarySourceKindSchema.parse(rawSourceKind);
  const id = browserId("cmd_catalog_choose_external_library_entries");
  const result = await invokeCommand<ExternalLibrarySelectionResult | null>(
    createEnvelope(
      "catalog.chooseExternalLibraryEntries",
      { sourceKind },
      { id, correlationId: id }
    )
  );
  return result === null
    ? null
    : ExternalLibrarySelectionResultSchema.parse(result);
}

export async function importLibraryEntries(
  rawInput: ImportLibraryEntriesInput
): Promise<ImportLibraryEntriesResult> {
  const input = ImportLibraryEntriesInputSchema.parse(rawInput);
  const id = browserId("cmd_catalog_import_library_entries");
  return ImportLibraryEntriesResultSchema.parse(
    await invokeCommand<ImportLibraryEntriesResult>(
      createEnvelope("catalog.importLibraryEntries", input, {
        id,
        correlationId: id,
        context: { resourceId: input.libraryId }
      })
    )
  );
}

export async function removeLibraryEntry(
  rawInput: RemoveLibraryEntryInput
): Promise<RemoveLibraryEntryResult> {
  const input = RemoveLibraryEntryInputSchema.parse(rawInput);
  const id = browserId("cmd_catalog_remove_library_entry");
  return RemoveLibraryEntryResultSchema.parse(
    await invokeCommand<RemoveLibraryEntryResult>(
      createEnvelope("catalog.removeLibraryEntry", input, {
        id,
        correlationId: id,
        context: { resourceId: input.libraryId }
      })
    )
  );
}

export async function moveLibraryEntry(
  rawInput: MoveLibraryEntryInput
): Promise<MoveLibraryEntryResult> {
  const input = MoveLibraryEntryInputSchema.parse(rawInput);
  const id = browserId("cmd_catalog_move_library_entry");
  return MoveLibraryEntryResultSchema.parse(
    await invokeCommand<MoveLibraryEntryResult>(
      createEnvelope("catalog.moveLibraryEntry", input, {
        id,
        correlationId: id,
        context: { resourceId: input.targetLibraryId }
      })
    )
  );
}
