import {
  LongCharacterProfileSnapshotSchema,
  LongGetCharacterAppearanceReferencesResultSchema,
  LongPrepareCharacterAppearanceDirectoryResultSchema,
  LongDeleteCharacterAppearanceResultSchema,
  type CommandEnvelope,
  type CommandResult
} from "@deepwrite/contracts";
import type { LongWorkspaceService } from "./long-workspace-service";
import { getCharacterAppearanceReferences } from "./long-character-appearance-references";

export async function handleLongCharacterProfileCoreCommand(
  service: LongWorkspaceService,
  command: CommandEnvelope
): Promise<CommandResult | undefined> {
  if (command.type === "long.prepareCharacterAppearanceDirectory") {
    const opened = await service.catalog.open(command.payload.bookId);
    return {
      status: "accepted",
      requestId: command.id,
      payload: LongPrepareCharacterAppearanceDirectoryResultSchema.parse(
        await service.store.prepareCharacterAppearanceDirectory(
          opened.projectDirectory,
          command.payload
        )
      )
    };
  }
  if (command.type === "long.getCharacterAppearanceReferences") {
    return {
      status: "accepted",
      requestId: command.id,
      payload: LongGetCharacterAppearanceReferencesResultSchema.parse(
        await getCharacterAppearanceReferences(service, command.payload)
      )
    };
  }
  let payload;
  switch (command.type) {
    case "long.deleteCharacterAppearance":
      payload = await service.deleteCharacterAppearance(command.payload);
      break;
    case "long.readCharacterProfile":
      payload = await service.readCharacterProfile(command.payload);
      break;
    case "long.saveCharacterProfile":
      payload = await service.saveCharacterProfile(command.payload);
      break;
    case "long.importCharacterAssetsAtPaths":
      payload = await service.importCharacterAssetsAtPaths(command.payload);
      break;
    case "long.renameCharacterAsset":
      payload = await service.renameCharacterAsset(command.payload);
      break;
    case "long.deleteCharacterAsset":
      payload = await service.deleteCharacterAsset(command.payload);
      break;
    default:
      return undefined;
  }
  return {
    status: "accepted",
    requestId: command.id,
    payload:
      command.type === "long.deleteCharacterAppearance"
        ? LongDeleteCharacterAppearanceResultSchema.parse(payload)
        : LongCharacterProfileSnapshotSchema.parse(payload)
  };
}
