import { ipcMain, type BrowserWindow } from "electron";
import {
  IPC_COMMAND_CHANNEL,
  CommandEnvelopeSchema,
  type CommandResult
} from "@deepwrite/contracts";
import { dispatchCommand } from "./dispatch-command";
import type { IpcCommandContext } from "./command-types";

export function registerDesktopCommandIpc(options: {
  getMainWindow: () => BrowserWindow | undefined;
  getContext: (senderWebContentsId: number) => IpcCommandContext;
}): void {
  ipcMain.handle(
    IPC_COMMAND_CHANNEL,
    async (event, rawCommand: unknown): Promise<CommandResult> => {
      const requestId = extractCommandRequestId(rawCommand);
      const window = options.getMainWindow();
      if (
        !window ||
        window.isDestroyed() ||
        event.sender !== window.webContents
      )
        return {
          status: "rejected",
          requestId,
          error: {
            code: "ipc.untrusted_sender",
            message: "IPC command sender is not the active application window."
          }
        };
      const parsed = CommandEnvelopeSchema.safeParse(rawCommand);
      if (!parsed.success) {
        const details = summarizeCommandValidationIssues(parsed.error.issues);
        return {
          status: "rejected",
          requestId,
          error: {
            code: "ipc.invalid_command",
            message: "Command envelope failed schema validation.",
            details
          }
        };
      }
      return dispatchCommand(options.getContext(event.sender.id), parsed.data);
    }
  );
}

function extractCommandRequestId(rawCommand: unknown): string {
  if (
    rawCommand &&
    typeof rawCommand === "object" &&
    "id" in rawCommand &&
    typeof (
      rawCommand as {
        id: unknown;
      }
    ).id === "string"
  ) {
    const requestId = (
      rawCommand as {
        id: string;
      }
    ).id.trim();
    if (requestId) {
      return requestId;
    }
  }
  return "unknown";
}
function summarizeCommandValidationIssues(
  issues: readonly {
    path: PropertyKey[];
    message: string;
  }[]
): Record<string, unknown> {
  const preview = issues.slice(0, 3).map((issue) => ({
    path: issue.path.map(String).join(".") || "(root)",
    message: issue.message
  }));
  return {
    issueCount: issues.length,
    issues: preview
  };
}
