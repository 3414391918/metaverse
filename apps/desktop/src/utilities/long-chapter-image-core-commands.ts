import {
  LongAddChapterImageResultSchema,
  LongDeleteChapterImageResultSchema,
  LongReadChapterImageResultSchema,
  LongReplaceChapterImageResultSchema,
  type CommandEnvelope,
  type CommandResult
} from "@deepwrite/contracts";
import type { LongWorkspaceService } from "./long-workspace-service";

export async function handleLongChapterImageCoreCommand(
  service: LongWorkspaceService,
  command: CommandEnvelope
): Promise<CommandResult | undefined> {
  if (command.type === "long.addChapterImage") {
    return {
      status: "accepted",
      requestId: command.id,
      payload: LongAddChapterImageResultSchema.parse(
        await service.chapterImages.addChapterImage(command.payload)
      )
    };
  }
  if (command.type === "long.readChapterImage") {
    return {
      status: "accepted",
      requestId: command.id,
      payload: LongReadChapterImageResultSchema.parse(
        await service.readChapterImage(command.payload)
      )
    };
  }
  if (command.type === "long.replaceChapterImage") {
    return {
      status: "accepted",
      requestId: command.id,
      payload: LongReplaceChapterImageResultSchema.parse(
        await service.replaceChapterImage(command.payload)
      )
    };
  }
  if (command.type === "long.deleteChapterImage") {
    return {
      status: "accepted",
      requestId: command.id,
      payload: LongDeleteChapterImageResultSchema.parse(
        await service.deleteChapterImage(command.payload)
      )
    };
  }
  return undefined;
}
