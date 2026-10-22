import { clipboard, shell } from "electron";
import {
  ResourceManagerResultSchema,
  type CommandEnvelope,
  type CommandResult
} from "@deepwrite/contracts";
import { ResourceManager } from "../resource-manager";
import type { IpcCommandContext } from "./command-types";
import type { WorkspaceDirectoryStore } from "../workspace-directory-store";
const managers = new WeakMap<WorkspaceDirectoryStore, ResourceManager>();
export async function handleResourceManagerCommands(
  ctx: Pick<IpcCommandContext, "requireWorkspaceDirectoryStore" | "dialog">,
  command: CommandEnvelope
): Promise<CommandResult | undefined> {
  if (command.type !== "resourceManager.execute") return undefined;
  try {
    const workspace = ctx.requireWorkspaceDirectoryStore();
    let manager = managers.get(workspace);
    if (!manager) {
      manager = new ResourceManager(workspace, {
        openPath: (path) => shell.openPath(path),
        reveal: (path) => shell.showItemInFolder(path),
        trash: (path) => shell.trashItem(path),
        copyText: (text) => clipboard.writeText(text),
        chooseFiles: async () => {
          const selection = await ctx.dialog.showOpenDialog({
            title: "导入资源",
            properties: ["openFile", "multiSelections"]
          });
          return selection.canceled ? [] : selection.filePaths;
        }
      });
      managers.set(workspace, manager);
    }
    return {
      status: "accepted",
      requestId: command.id,
      payload: ResourceManagerResultSchema.parse(
        await manager.execute(command.payload)
      )
    };
  } catch (error) {
    return {
      status: "rejected",
      requestId: command.id,
      error: {
        code: "resource_manager.failed",
        message: error instanceof Error ? error.message : "资源操作失败。"
      }
    };
  }
}
