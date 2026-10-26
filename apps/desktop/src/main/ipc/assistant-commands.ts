import { shell } from "electron";
import { lstat, realpath } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { CommandEnvelope, CommandResult } from "@deepwrite/contracts";
import { AssistantConnectionSchema } from "@deepwrite/contracts";
import { assistantRuntime } from "../assistant-service";
import type { IpcCommandContext } from "./command-types";
export async function handleAssistantCommands(
  ctx: Pick<IpcCommandContext, "requireWorkspaceDirectoryStore">,
  command: CommandEnvelope
): Promise<CommandResult | undefined> {
  if (
    command.type !== "assistant.start" &&
    command.type !== "assistant.restart" &&
    command.type !== "assistant.openConfiguration"
  )
    return undefined;
  try {
    const { path } = await ctx.requireWorkspaceDirectoryStore().list();
    if (!path) throw new Error("请先选择工作目录。");
    if (command.type === "assistant.openConfiguration") {
      const root = await realpath(path);
      const target = join(
        root,
        "assistant",
        "profiles",
        "web",
        "cordis.patch.yml"
      );
      if (
        (await realpath(target)) !== resolve(target) ||
        !(await lstat(target)).isFile()
      )
        throw new Error("配置文件不在当前工作目录中。");
      const error = await shell.openPath(target);
      if (error) throw new Error(error);
      return { status: "accepted", requestId: command.id, payload: null };
    }
    const runtime = assistantRuntime();
    if (command.type === "assistant.restart") await runtime.stop();
    return {
      status: "accepted",
      requestId: command.id,
      payload: AssistantConnectionSchema.parse(await runtime.ensure(path))
    };
  } catch (error) {
    return {
      status: "rejected",
      requestId: command.id,
      error: {
        code: "assistant.failed",
        message: error instanceof Error ? error.message : "智能体启动失败。"
      }
    };
  }
}
