import {
  CatalogLibraryGroupSchema,
  CatalogLibrarySchema,
  CreateLibraryGroupInputSchema,
  CreateLibraryInputSchema,
  UpdateLibraryGroupInputSchema,
  UpdateLibraryInputSchema,
  createEnvelope,
  type CatalogLibrary,
  type CatalogLibraryGroup,
  type CreateLibraryGroupInput,
  type CreateLibraryInput,
  type UpdateLibraryGroupInput,
  type UpdateLibraryInput
} from "@deepwrite/contracts";
import { browserId, invokeCommand } from "./invoke";
export async function createLibrary(
  rawInput: CreateLibraryInput
): Promise<CatalogLibrary | null> {
  const input = CreateLibraryInputSchema.parse(rawInput);
  const id = browserId("cmd_catalog_create_library");
  return CatalogLibrarySchema.nullable().parse(
    await invokeCommand<CatalogLibrary | null>(
      createEnvelope("catalog.createLibrary", input, {
        id,
        correlationId: id
      })
    )
  );
}

export async function createLibraryGroup(
  rawInput: CreateLibraryGroupInput
): Promise<CatalogLibraryGroup | null> {
  const input = CreateLibraryGroupInputSchema.parse(rawInput);
  const id = browserId("cmd_catalog_create_library_group");
  return CatalogLibraryGroupSchema.nullable().parse(
    await invokeCommand<CatalogLibraryGroup | null>(
      createEnvelope("catalog.createLibraryGroup", input, {
        id,
        correlationId: id
      })
    )
  );
}

export async function updateLibrary(
  rawInput: UpdateLibraryInput
): Promise<CatalogLibrary> {
  const input = UpdateLibraryInputSchema.parse(rawInput);
  const id = browserId("cmd_catalog_update_library");
  return CatalogLibrarySchema.parse(
    await invokeCommand<CatalogLibrary>(
      createEnvelope("catalog.updateLibrary", input, {
        id,
        correlationId: id,
        context: { resourceId: input.libraryId }
      })
    )
  );
}

export async function updateLibraryGroup(
  rawInput: UpdateLibraryGroupInput
): Promise<CatalogLibraryGroup> {
  const input = UpdateLibraryGroupInputSchema.parse(rawInput);
  const id = browserId("cmd_catalog_update_library_group");
  return CatalogLibraryGroupSchema.parse(
    await invokeCommand<CatalogLibraryGroup>(
      createEnvelope("catalog.updateLibraryGroup", input, {
        id,
        correlationId: id,
        context: { resourceId: input.groupId }
      })
    )
  );
}
