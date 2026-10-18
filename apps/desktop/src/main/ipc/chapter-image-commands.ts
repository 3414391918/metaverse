import { clipboard, nativeImage, type NativeImage } from "electron";
import {
  CommandEnvelopeSchema,
  createEnvelope,
  LONG_CHAPTER_IMAGE_MAX_BYTES,
  LONG_CHAPTER_IMAGE_MAX_PIXELS,
  LongReadChapterImageResultSchema,
  LongAddChapterImageResultSchema,
  LongDeleteChapterImageResultSchema,
  LongReplaceChapterImageResultSchema,
  LongReadClipboardImageResultSchema,
  LongCopyChapterImageResultSchema,
  type CommandEnvelope,
  type CommandResult
} from "@deepwrite/contracts";
import type { IpcCommandContext } from "./command-types";
import { safeErrorDetails } from "./errors";

function checkedImage(image: NativeImage) {
  if (image.isEmpty()) throw new Error("图片无法读取。");
  const { width, height } = image.getSize();
  if (width < 1 || height < 1 || width * height > LONG_CHAPTER_IMAGE_MAX_PIXELS)
    throw new Error("图片尺寸过大，最多支持 4000 万像素。");
  return image;
}
export async function handleChapterImageCommands(
  ctx: Pick<IpcCommandContext, "supervisor">,
  command: CommandEnvelope
): Promise<CommandResult | undefined> {
  if (
    command.type !== "long.readChapterImage" &&
    command.type !== "long.addChapterImage" &&
    command.type !== "long.replaceChapterImage" &&
    command.type !== "long.deleteChapterImage" &&
    command.type !== "long.copyChapterImage" &&
    command.type !== "long.readClipboardImage"
  )
    return undefined;
  try {
    let payload: unknown;
    if (command.type === "long.readClipboardImage") {
      const image = clipboard.readImage();
      if (image.isEmpty()) payload = null;
      else {
        const bytes = checkedImage(image).toPNG();
        if (!bytes.length || bytes.length > LONG_CHAPTER_IMAGE_MAX_BYTES)
          throw new Error("图片超过 100 MB 大小限制。");
        payload = LongReadClipboardImageResultSchema.parse({
          pngDataUrl: `data:image/png;base64,${bytes.toString("base64")}`
        });
      }
    } else {
      const forwarded =
        command.type === "long.copyChapterImage"
          ? CommandEnvelopeSchema.parse(
              createEnvelope("long.readChapterImage", command.payload, {
                id: command.id,
                context: command.context
              })
            )
          : command;
      const result = await ctx.supervisor.requestCommand(
        "core",
        forwarded,
        60_000
      );
      if (result.status === "rejected") {
        if (result.error.details?.kind === "ProjectTransactionConflictError")
          return {
            ...result,
            error: {
              ...result.error,
              message:
                command.type === "long.addChapterImage"
                  ? "章节已被修改，请重新读取正文后添加插画。"
                  : command.type === "long.deleteChapterImage"
                    ? "这张图片或所在章节已被修改，请重新加载后重试删除。"
                    : "这张图片或所在章节已被修改，请关闭窗口后重新打开替换。"
            }
          };
        return result;
      }
      if (command.type === "long.addChapterImage")
        payload = LongAddChapterImageResultSchema.parse(result.payload);
      else if (command.type === "long.replaceChapterImage")
        payload = LongReplaceChapterImageResultSchema.parse(result.payload);
      else if (command.type === "long.deleteChapterImage")
        payload = LongDeleteChapterImageResultSchema.parse(result.payload);
      else {
        const image = LongReadChapterImageResultSchema.parse(result.payload);
        if (command.type === "long.copyChapterImage") {
          const bytes = Buffer.from(
            image.pngDataUrl.slice("data:image/png;base64,".length),
            "base64"
          );
          if (!bytes.length || bytes.length > LONG_CHAPTER_IMAGE_MAX_BYTES)
            throw new Error("图片超过复制大小限制。");
          clipboard.writeImage(
            checkedImage(nativeImage.createFromBuffer(bytes))
          );
          payload = LongCopyChapterImageResultSchema.parse({ copied: true });
        } else payload = image;
      }
    }
    return { status: "accepted", requestId: command.id, payload };
  } catch (error) {
    return {
      status: "rejected",
      requestId: command.id,
      error: {
        code: "chapter_image.operation_failed",
        message: error instanceof Error ? error.message : "图片操作失败。",
        details: safeErrorDetails(error)
      }
    };
  }
}
