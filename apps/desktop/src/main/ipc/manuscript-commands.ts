import {
  ExportLongManuscriptResultSchema,
  type CommandEnvelope,
  type CommandResult
} from "@deepwrite/contracts";
import { safeErrorDetails } from "./errors";
import type { IpcCommandContext } from "./command-types";

export async function handleManuscriptCommands(
  ctx: IpcCommandContext,
  command: CommandEnvelope
): Promise<CommandResult | undefined> {
  if (command.type === "manuscript.exportLong") {
    try {
      return {
        status: "accepted",
        requestId: command.id,
        payload: ExportLongManuscriptResultSchema.parse(
          await ctx.exportLongManuscript(ctx.getMainWindow(), command.payload)
        )
      };
    } catch (error: unknown) {
      return {
        status: "rejected",
        requestId: command.id,
        error: {
          code: "manuscript.export_failed",
          message: error instanceof Error ? error.message : "导出书籍失败。",
          details: safeErrorDetails(error)
        }
      };
    }
  }
  return undefined;
}
