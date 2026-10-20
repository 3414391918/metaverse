import { isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";
import { clipboard } from "electron";
import {
  LongAddChapterVideoResultSchema,
  LongChapterVideoCopySourceSchema,
  LongCopyChapterVideoResultSchema,
  LongDeleteChapterVideoResultSchema,
  LongReadChapterVideoResultSchema,
  LongReplaceChapterVideoResultSchema,
  type CommandEnvelope,
  type CommandResult
} from "@deepwrite/contracts";
import type { IpcCommandContext } from "./command-types";
import { safeErrorDetails } from "./errors";

function xmlEscape(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

/** Copy the project video as a file reference without moving or duplicating it. */
export function copyChapterVideoFile(path: string) {
  if (!isAbsolute(path)) throw new Error("视频文件路径无效。");
  if (process.platform === "darwin") {
    const plist = `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><array><string>${xmlEscape(path)}</string></array></plist>`;
    clipboard.writeBuffer("NSFilenamesPboardType", Buffer.from(plist, "utf8"));
  } else if (process.platform === "win32") {
    clipboard.writeBuffer("FileNameW", Buffer.from(`${path}\0`, "utf16le"));
  } else {
    clipboard.writeBuffer(
      "text/uri-list",
      Buffer.from(`${pathToFileURL(path).href}\r\n`, "utf8")
    );
  }
}

export async function handleChapterVideoCommands(
  ctx: Pick<IpcCommandContext, "supervisor">,
  command: CommandEnvelope
): Promise<CommandResult | undefined> {
  if (
    command.type !== "long.addChapterVideo" &&
    command.type !== "long.readChapterVideo" &&
    command.type !== "long.replaceChapterVideo" &&
    command.type !== "long.deleteChapterVideo" &&
    command.type !== "long.copyChapterVideo"
  )
    return undefined;
  try {
    const result = await ctx.supervisor.requestCommand(
      "core",
      command,
      120_000
    );
    if (result.status === "rejected") {
      if (result.error.details?.kind === "ProjectTransactionConflictError")
        return {
          ...result,
          error: {
            ...result.error,
            message:
              command.type === "long.addChapterVideo"
                ? "章节已被修改，请重新读取正文后添加视频。"
                : "视频或所在章节已被修改，请重新加载后重试。"
          }
        };
      return result;
    }
    let payload: unknown;
    switch (command.type) {
      case "long.addChapterVideo":
        payload = LongAddChapterVideoResultSchema.parse(result.payload);
        break;
      case "long.readChapterVideo":
        payload = LongReadChapterVideoResultSchema.parse(result.payload);
        break;
      case "long.replaceChapterVideo":
        payload = LongReplaceChapterVideoResultSchema.parse(result.payload);
        break;
      case "long.deleteChapterVideo":
        payload = LongDeleteChapterVideoResultSchema.parse(result.payload);
        break;
      case "long.copyChapterVideo": {
        const source = LongChapterVideoCopySourceSchema.parse(result.payload);
        copyChapterVideoFile(source.path);
        payload = LongCopyChapterVideoResultSchema.parse({ copied: true });
        break;
      }
    }
    return { status: "accepted", requestId: command.id, payload };
  } catch (error) {
    return {
      status: "rejected",
      requestId: command.id,
      error: {
        code: "chapter_video.operation_failed",
        message: error instanceof Error ? error.message : "视频操作失败。",
        details: safeErrorDetails(error)
      }
    };
  }
}
