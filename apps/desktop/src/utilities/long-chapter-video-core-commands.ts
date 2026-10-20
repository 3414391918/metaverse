import {
  LongAddChapterVideoResultSchema,
  LongChapterVideoCopySourceSchema,
  LongDeleteChapterVideoResultSchema,
  LongReadChapterVideoResultSchema,
  LongReplaceChapterVideoResultSchema,
  type CommandEnvelope,
  type CommandResult
} from "@deepwrite/contracts";
import type { LongWorkspaceService } from "./long-workspace-service";

export async function handleLongChapterVideoCoreCommand(
  service: LongWorkspaceService,
  command: CommandEnvelope
): Promise<CommandResult | undefined> {
  switch (command.type) {
    case "long.addChapterVideo":
      return {
        status: "accepted",
        requestId: command.id,
        payload: LongAddChapterVideoResultSchema.parse(
          await service.chapterVideos.add(command.payload)
        )
      };
    case "long.readChapterVideo":
      return {
        status: "accepted",
        requestId: command.id,
        payload: LongReadChapterVideoResultSchema.parse(
          await service.chapterVideos.read(command.payload)
        )
      };
    case "long.replaceChapterVideo":
      return {
        status: "accepted",
        requestId: command.id,
        payload: LongReplaceChapterVideoResultSchema.parse(
          await service.chapterVideos.replace(command.payload)
        )
      };
    case "long.deleteChapterVideo":
      return {
        status: "accepted",
        requestId: command.id,
        payload: LongDeleteChapterVideoResultSchema.parse(
          await service.chapterVideos.delete(command.payload)
        )
      };
    case "long.copyChapterVideo":
      return {
        status: "accepted",
        requestId: command.id,
        payload: LongChapterVideoCopySourceSchema.parse(
          await service.chapterVideos.copySource(command.payload)
        )
      };
    default:
      return undefined;
  }
}
