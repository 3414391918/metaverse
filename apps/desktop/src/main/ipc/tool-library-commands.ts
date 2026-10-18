import {
  ToolFileSnapshotSchema,
  ToolLibrarySnapshotSchema,
  type CommandEnvelope,
  type CommandResult
} from "@deepwrite/contracts";
import type { IpcCommandContext } from "./command-types";
import { safeErrorDetails } from "./errors";

export async function handleToolLibraryCommands(
  ctx: Pick<IpcCommandContext, "requireToolLibraryStore">,
  command: CommandEnvelope
): Promise<CommandResult | undefined> {
  if (!command.type.startsWith("toolLibrary.")) return undefined;
  try {
    const store = ctx.requireToolLibraryStore();
    let payload: unknown;
    switch (command.type) {
      case "toolLibrary.list":
        payload = ToolLibrarySnapshotSchema.parse(await store.list());
        break;
      case "toolLibrary.read":
        payload = ToolFileSnapshotSchema.parse(
          await store.read(command.payload)
        );
        break;
      case "toolLibrary.save":
        payload = ToolFileSnapshotSchema.parse(
          await store.save(command.payload)
        );
        break;
      case "toolLibrary.create":
        payload = ToolLibrarySnapshotSchema.parse(
          await store.create(command.payload)
        );
        break;
      case "toolLibrary.delete":
        payload = ToolLibrarySnapshotSchema.parse(
          await store.delete(command.payload.id)
        );
        break;
      default:
        return undefined;
    }
    return { status: "accepted", requestId: command.id, payload };
  } catch (error) {
    return {
      status: "rejected",
      requestId: command.id,
      error: {
        code: "tool_library.failed",
        message: error instanceof Error ? error.message : "工具操作失败。",
        details: safeErrorDetails(error)
      }
    };
  }
}
