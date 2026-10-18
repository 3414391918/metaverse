import {
  CatalogDraftRecoverySaveResultSchema,
  CatalogDraftRecoverySchema,
  CatalogIndexSnapshotSchema,
  CatalogReadDocumentInputSchema,
  CatalogReadDocumentResultSchema,
  CatalogSnapshotSchema,
  ReadWritingContextInputSchema,
  ReadWritingContextResultSchema,
  WriteWritingContextInputSchema,
  WriteWritingContextResultSchema,
  createEnvelope,
  type CatalogDraftRecovery,
  type CatalogIndexSnapshot,
  type CatalogReadDocumentInput,
  type CatalogReadDocumentResult,
  type CatalogSnapshot,
  type ReadWritingContextInput,
  type ReadWritingContextResult,
  type WriteWritingContextInput,
  type WriteWritingContextResult
} from "@deepwrite/contracts";
import { browserId, invokeCommand } from "./invoke";
export async function getCatalogSnapshot(): Promise<CatalogSnapshot> {
  const id = browserId("cmd_catalog_snapshot");
  return CatalogSnapshotSchema.parse(
    await invokeCommand<CatalogSnapshot>(
      createEnvelope("catalog.snapshot", {}, { id, correlationId: id })
    )
  );
}

export async function getCatalogIndex(): Promise<CatalogIndexSnapshot> {
  const id = browserId("cmd_catalog_index");
  return CatalogIndexSnapshotSchema.parse(
    await invokeCommand<CatalogIndexSnapshot>(
      createEnvelope("catalog.index", {}, { id, correlationId: id })
    )
  );
}

export async function readCatalogDocument(
  rawInput: CatalogReadDocumentInput
): Promise<CatalogReadDocumentResult> {
  const input = CatalogReadDocumentInputSchema.parse(rawInput);
  const id = browserId("cmd_catalog_read_document");
  return CatalogReadDocumentResultSchema.parse(
    await invokeCommand<CatalogReadDocumentResult>(
      createEnvelope("catalog.readDocument", input, {
        id,
        correlationId: id
      })
    )
  );
}

export async function readWritingContext(
  rawInput: ReadWritingContextInput
): Promise<ReadWritingContextResult> {
  const input = ReadWritingContextInputSchema.parse(rawInput);
  const id = browserId("cmd_catalog_read_writing_context");
  return ReadWritingContextResultSchema.parse(
    await invokeCommand<ReadWritingContextResult>(
      createEnvelope("catalog.readWritingContext", input, {
        id,
        correlationId: id,
        context: { resourceId: input.bookId }
      })
    )
  );
}

export async function writeWritingContext(
  rawInput: WriteWritingContextInput
): Promise<WriteWritingContextResult> {
  const input = WriteWritingContextInputSchema.parse(rawInput);
  const id = browserId("cmd_catalog_write_writing_context");
  return WriteWritingContextResultSchema.parse(
    await invokeCommand<WriteWritingContextResult>(
      createEnvelope("catalog.writeWritingContext", input, {
        id,
        correlationId: id,
        context: { resourceId: input.bookId }
      })
    )
  );
}

export async function loadDraftRecovery(): Promise<CatalogDraftRecovery> {
  const id = browserId("cmd_catalog_load_draft_recovery");
  return CatalogDraftRecoverySchema.parse(
    await invokeCommand<CatalogDraftRecovery>(
      createEnvelope("catalog.loadDraftRecovery", {}, { id, correlationId: id })
    )
  );
}

export async function saveDraftRecovery(
  rawDrafts: CatalogDraftRecovery
): Promise<void> {
  const drafts = CatalogDraftRecoverySchema.parse(rawDrafts);
  const id = browserId("cmd_catalog_save_draft_recovery");
  CatalogDraftRecoverySaveResultSchema.parse(
    await invokeCommand(
      createEnvelope(
        "catalog.saveDraftRecovery",
        { drafts },
        { id, correlationId: id }
      )
    )
  );
}
