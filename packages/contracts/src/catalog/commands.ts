import { z } from "zod";
import { EnvelopeBaseSchema } from "../envelope";
import {
  CatalogReadWritingContextCommandEnvelopeSchema,
  CatalogWriteWritingContextCommandEnvelopeSchema
} from "../writing-context";
import {
  CatalogOpenProjectInputSchema,
  CatalogReadDocumentInputSchema,
  CreateLibraryAtPathInputSchema,
  CreateLibraryEntryInputSchema,
  CreateLibraryGroupAtPathInputSchema,
  CreateLibraryGroupInputSchema,
  CreateLibraryInputSchema,
  DeleteBookInputSchema,
  DeleteCatalogProjectInputSchema,
  DuplicateCatalogProjectInputSchema,
  ExternalLibrarySourceKindSchema,
  ImportLegacyBookAtPathInputSchema,
  ImportLegacyLibraryAtPathInputSchema,
  ImportLegacyLibraryInputSchema,
  ImportLibraryEntriesInputSchema,
  MoveLibraryEntryInputSchema,
  OpenCatalogProjectAtPathInputSchema,
  RemoveLibraryEntryInputSchema,
  SaveDocumentInputSchema,
  SaveLibraryEntryInputSchema,
  UnregisterCatalogProjectInputSchema,
  UpdateBookInputSchema,
  UpdateLibraryGroupInputSchema,
  UpdateLibraryInputSchema
} from "./mutations";
import { CatalogDraftRecoverySchema } from "./snapshot";
export const CatalogSnapshotCommandEnvelopeSchema = EnvelopeBaseSchema.extend({
  type: z.literal("catalog.snapshot"),
  payload: z.object({})
});
export const CatalogIndexCommandEnvelopeSchema = EnvelopeBaseSchema.extend({
  type: z.literal("catalog.index"),
  payload: z.object({}).strict()
});
export const CatalogReadDocumentCommandEnvelopeSchema =
  EnvelopeBaseSchema.extend({
    type: z.literal("catalog.readDocument"),
    payload: CatalogReadDocumentInputSchema
  });
export const CatalogLoadDraftRecoveryCommandEnvelopeSchema =
  EnvelopeBaseSchema.extend({
    type: z.literal("catalog.loadDraftRecovery"),
    payload: z.object({})
  });
export const CatalogSaveDraftRecoveryCommandEnvelopeSchema =
  EnvelopeBaseSchema.extend({
    type: z.literal("catalog.saveDraftRecovery"),
    payload: z.object({ drafts: CatalogDraftRecoverySchema })
  });
export const CatalogCreateLibraryCommandEnvelopeSchema =
  EnvelopeBaseSchema.extend({
    type: z.literal("catalog.createLibrary"),
    payload: CreateLibraryInputSchema
  });
export const CatalogUpdateLibraryCommandEnvelopeSchema =
  EnvelopeBaseSchema.extend({
    type: z.literal("catalog.updateLibrary"),
    payload: UpdateLibraryInputSchema
  });
export const CatalogCreateLibraryGroupCommandEnvelopeSchema =
  EnvelopeBaseSchema.extend({
    type: z.literal("catalog.createLibraryGroup"),
    payload: CreateLibraryGroupInputSchema
  });
export const CatalogOpenProjectCommandEnvelopeSchema =
  EnvelopeBaseSchema.extend({
    type: z.literal("catalog.openProject"),
    payload: CatalogOpenProjectInputSchema
  });
export const CatalogImportLegacyBookCommandEnvelopeSchema =
  EnvelopeBaseSchema.extend({
    type: z.literal("catalog.importLegacyBook"),
    payload: z.object({})
  });
export const CatalogImportLegacyLibraryCommandEnvelopeSchema =
  EnvelopeBaseSchema.extend({
    type: z.literal("catalog.importLegacyLibrary"),
    payload: ImportLegacyLibraryInputSchema
  });
export const CatalogCreateLibraryAtPathCommandEnvelopeSchema =
  EnvelopeBaseSchema.extend({
    type: z.literal("catalog.createLibraryAtPath"),
    payload: CreateLibraryAtPathInputSchema
  });
export const CatalogCreateLibraryGroupAtPathCommandEnvelopeSchema =
  EnvelopeBaseSchema.extend({
    type: z.literal("catalog.createLibraryGroupAtPath"),
    payload: CreateLibraryGroupAtPathInputSchema
  });
export const CatalogOpenProjectAtPathCommandEnvelopeSchema =
  EnvelopeBaseSchema.extend({
    type: z.literal("catalog.openProjectAtPath"),
    payload: OpenCatalogProjectAtPathInputSchema
  });
export const CatalogImportLegacyBookAtPathCommandEnvelopeSchema =
  EnvelopeBaseSchema.extend({
    type: z.literal("catalog.importLegacyBookAtPath"),
    payload: ImportLegacyBookAtPathInputSchema
  });
export const CatalogImportLegacyLibraryAtPathCommandEnvelopeSchema =
  EnvelopeBaseSchema.extend({
    type: z.literal("catalog.importLegacyLibraryAtPath"),
    payload: ImportLegacyLibraryAtPathInputSchema
  });
export const CatalogUpdateBookCommandEnvelopeSchema = EnvelopeBaseSchema.extend(
  {
    type: z.literal("catalog.updateBook"),
    payload: UpdateBookInputSchema
  }
);
export const CatalogUpdateLibraryGroupCommandEnvelopeSchema =
  EnvelopeBaseSchema.extend({
    type: z.literal("catalog.updateLibraryGroup"),
    payload: UpdateLibraryGroupInputSchema
  });
export const CatalogDeleteBookCommandEnvelopeSchema = EnvelopeBaseSchema.extend(
  {
    type: z.literal("catalog.deleteBook"),
    payload: DeleteBookInputSchema
  }
);
export const CatalogSaveDocumentCommandEnvelopeSchema =
  EnvelopeBaseSchema.extend({
    type: z.literal("catalog.saveDocument"),
    payload: SaveDocumentInputSchema
  });
export const CatalogSaveLibraryEntryCommandEnvelopeSchema =
  EnvelopeBaseSchema.extend({
    type: z.literal("catalog.saveLibraryEntry"),
    payload: SaveLibraryEntryInputSchema
  });
export const CatalogCreateLibraryEntryCommandEnvelopeSchema =
  EnvelopeBaseSchema.extend({
    type: z.literal("catalog.createLibraryEntry"),
    payload: CreateLibraryEntryInputSchema
  });
export const CatalogRemoveLibraryEntryCommandEnvelopeSchema =
  EnvelopeBaseSchema.extend({
    type: z.literal("catalog.removeLibraryEntry"),
    payload: RemoveLibraryEntryInputSchema
  });
export const CatalogMoveLibraryEntryCommandEnvelopeSchema =
  EnvelopeBaseSchema.extend({
    type: z.literal("catalog.moveLibraryEntry"),
    payload: MoveLibraryEntryInputSchema
  });
export const CatalogUnregisterProjectCommandEnvelopeSchema =
  EnvelopeBaseSchema.extend({
    type: z.literal("catalog.unregisterProject"),
    payload: UnregisterCatalogProjectInputSchema
  });
export const CatalogDeleteProjectCommandEnvelopeSchema =
  EnvelopeBaseSchema.extend({
    type: z.literal("catalog.deleteProject"),
    payload: DeleteCatalogProjectInputSchema
  });
export const CatalogDuplicateProjectCommandEnvelopeSchema =
  EnvelopeBaseSchema.extend({
    type: z.literal("catalog.duplicateProject"),
    payload: DuplicateCatalogProjectInputSchema
  });
export const CatalogChooseExternalLibraryEntriesCommandEnvelopeSchema =
  EnvelopeBaseSchema.extend({
    type: z.literal("catalog.chooseExternalLibraryEntries"),
    payload: z.object({ sourceKind: ExternalLibrarySourceKindSchema })
  });
export const CatalogImportLibraryEntriesCommandEnvelopeSchema =
  EnvelopeBaseSchema.extend({
    type: z.literal("catalog.importLibraryEntries"),
    payload: ImportLibraryEntriesInputSchema
  });
export const CatalogCommandEnvelopeSchema = z.discriminatedUnion("type", [
  CatalogReadWritingContextCommandEnvelopeSchema,
  CatalogWriteWritingContextCommandEnvelopeSchema,
  CatalogIndexCommandEnvelopeSchema,
  CatalogReadDocumentCommandEnvelopeSchema,
  CatalogSnapshotCommandEnvelopeSchema,
  CatalogLoadDraftRecoveryCommandEnvelopeSchema,
  CatalogSaveDraftRecoveryCommandEnvelopeSchema,
  CatalogCreateLibraryCommandEnvelopeSchema,
  CatalogUpdateLibraryCommandEnvelopeSchema,
  CatalogCreateLibraryGroupCommandEnvelopeSchema,
  CatalogOpenProjectCommandEnvelopeSchema,
  CatalogImportLegacyLibraryCommandEnvelopeSchema,
  CatalogCreateLibraryAtPathCommandEnvelopeSchema,
  CatalogCreateLibraryGroupAtPathCommandEnvelopeSchema,
  CatalogOpenProjectAtPathCommandEnvelopeSchema,
  CatalogImportLegacyLibraryAtPathCommandEnvelopeSchema,
  CatalogUpdateBookCommandEnvelopeSchema,
  CatalogUpdateLibraryGroupCommandEnvelopeSchema,
  CatalogDeleteBookCommandEnvelopeSchema,
  CatalogSaveDocumentCommandEnvelopeSchema,
  CatalogSaveLibraryEntryCommandEnvelopeSchema,
  CatalogCreateLibraryEntryCommandEnvelopeSchema,
  CatalogRemoveLibraryEntryCommandEnvelopeSchema,
  CatalogMoveLibraryEntryCommandEnvelopeSchema,
  CatalogUnregisterProjectCommandEnvelopeSchema,
  CatalogDeleteProjectCommandEnvelopeSchema,
  CatalogDuplicateProjectCommandEnvelopeSchema,
  CatalogChooseExternalLibraryEntriesCommandEnvelopeSchema,
  CatalogImportLibraryEntriesCommandEnvelopeSchema
]);
export type CatalogCommandEnvelope = z.infer<
  typeof CatalogCommandEnvelopeSchema
>;
