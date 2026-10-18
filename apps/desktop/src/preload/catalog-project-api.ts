import {
  CatalogLibraryProjectDomainSchema,
  CatalogOpenProjectResultSchema,
  CatalogProjectDomainSchema,
  DeleteCatalogProjectInputSchema,
  DeleteCatalogProjectResultSchema,
  DuplicateCatalogProjectInputSchema,
  DuplicateCatalogProjectResultSchema,
  ImportLegacyLibraryResultSchema,
  UnregisterCatalogProjectInputSchema,
  UnregisterCatalogProjectResultSchema,
  createEnvelope,
  type CatalogLibraryProjectDomain,
  type CatalogOpenProjectResult,
  type CatalogProjectDomain,
  type DeleteCatalogProjectInput,
  type DeleteCatalogProjectResult,
  type DuplicateCatalogProjectInput,
  type DuplicateCatalogProjectResult,
  type ImportLegacyLibraryResult,
  type UnregisterCatalogProjectInput,
  type UnregisterCatalogProjectResult
} from "@deepwrite/contracts";
import { browserId, invokeCommand } from "./invoke";
export async function openProject(
  rawDomain: CatalogProjectDomain
): Promise<CatalogOpenProjectResult | null> {
  const domain = CatalogProjectDomainSchema.parse(rawDomain);
  const id = browserId("cmd_catalog_open_project");
  return CatalogOpenProjectResultSchema.nullable().parse(
    await invokeCommand<CatalogOpenProjectResult | null>(
      createEnvelope(
        "catalog.openProject",
        { domain },
        {
          id,
          correlationId: id
        }
      )
    )
  );
}

export async function importLegacyLibrary(
  rawDomain: CatalogLibraryProjectDomain
): Promise<ImportLegacyLibraryResult | null> {
  const domain = CatalogLibraryProjectDomainSchema.parse(rawDomain);
  const id = browserId("cmd_catalog_import_legacy_library");
  return ImportLegacyLibraryResultSchema.nullable().parse(
    await invokeCommand<ImportLegacyLibraryResult | null>(
      createEnvelope(
        "catalog.importLegacyLibrary",
        { domain },
        { id, correlationId: id }
      )
    )
  );
}

export async function unregisterProject(
  rawInput: UnregisterCatalogProjectInput
): Promise<UnregisterCatalogProjectResult> {
  const input = UnregisterCatalogProjectInputSchema.parse(rawInput);
  const id = browserId("cmd_catalog_unregister_project");
  return UnregisterCatalogProjectResultSchema.parse(
    await invokeCommand<UnregisterCatalogProjectResult>(
      createEnvelope("catalog.unregisterProject", input, {
        id,
        correlationId: id,
        context: { resourceId: input.projectId }
      })
    )
  );
}

export async function deleteProject(
  rawInput: DeleteCatalogProjectInput
): Promise<DeleteCatalogProjectResult> {
  const input = DeleteCatalogProjectInputSchema.parse(rawInput);
  const id = browserId("cmd_catalog_delete_project");
  return DeleteCatalogProjectResultSchema.parse(
    await invokeCommand<DeleteCatalogProjectResult>(
      createEnvelope("catalog.deleteProject", input, {
        id,
        correlationId: id,
        context: { resourceId: input.projectId }
      })
    )
  );
}

export async function duplicateProject(
  rawInput: DuplicateCatalogProjectInput
): Promise<DuplicateCatalogProjectResult> {
  const input = DuplicateCatalogProjectInputSchema.parse(rawInput);
  const id = browserId("cmd_catalog_duplicate_project");
  return DuplicateCatalogProjectResultSchema.parse(
    await invokeCommand<DuplicateCatalogProjectResult>(
      createEnvelope("catalog.duplicateProject", input, {
        id,
        correlationId: id,
        context: { resourceId: input.projectId }
      })
    )
  );
}
