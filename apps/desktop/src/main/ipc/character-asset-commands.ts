import { app, clipboard, nativeImage } from "electron";
import {
  CommandEnvelopeSchema,
  createEnvelope,
  LongCharacterProfileSnapshotSchema,
  LongGetCharacterAppearanceReferencesResultSchema,
  LongPrepareCharacterAppearanceDirectoryResultSchema,
  LongDeleteCharacterAppearanceResultSchema,
  LongCopyCharacterAssetResultSchema,
  LONG_CHARACTER_IMAGE_MAX_BYTES,
  type CommandEnvelope,
  type CommandResult
} from "@deepwrite/contracts";
import type { IpcCommandContext } from "./command-types";
import { readCharacterAsset } from "../character-asset-access";
import { safeErrorDetails } from "./errors";
export async function handleCharacterAssetCommands(
  ctx: Pick<IpcCommandContext, "getMainWindow" | "supervisor" | "dialog">,
  command: CommandEnvelope
): Promise<CommandResult | undefined> {
  if (
    command.type !== "long.prepareCharacterAppearanceDirectory" &&
    command.type !== "long.getCharacterAppearanceReferences" &&
    command.type !== "long.deleteCharacterAppearance" &&
    command.type !== "long.readCharacterProfile" &&
    command.type !== "long.saveCharacterProfile" &&
    command.type !== "long.importCharacterAssets" &&
    command.type !== "long.renameCharacterAsset" &&
    command.type !== "long.deleteCharacterAsset" &&
    command.type !== "long.copyCharacterAsset"
  )
    return undefined;
  try {
    if (command.type === "long.copyCharacterAsset") {
      const original = await readCharacterAsset(
        app.getPath("userData"),
        command.payload
      );
      const { pngDataUrl } = command.payload;
      const bytes = pngDataUrl
        ? Buffer.from(
            pngDataUrl.slice("data:image/png;base64,".length),
            "base64"
          )
        : original;
      if (
        bytes.byteLength > LONG_CHARACTER_IMAGE_MAX_BYTES ||
        !bytes.byteLength
      )
        throw new Error("复制图片超过大小限制");
      if (
        pngDataUrl &&
        !bytes
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      )
        throw new Error("剪贴板图片格式无效");
      const image = nativeImage.createFromBuffer(bytes);
      if (image.isEmpty()) throw new Error("无法复制这张图片");
      const size = image.getSize();
      if (size.width * size.height > 40_000_000)
        throw new Error("图片尺寸过大，无法复制");
      clipboard.writeImage(image);
      return {
        status: "accepted",
        requestId: command.id,
        payload: LongCopyCharacterAssetResultSchema.parse({ copied: true })
      };
    }
    let forwarded: CommandEnvelope = command;
    if (command.type === "long.importCharacterAssets") {
      const selection = await ctx.dialog.showOpenDialog(ctx.getMainWindow(), {
        title: "上传角色资产图",
        properties: ["openFile", "multiSelections"],
        filters: [
          {
            name: "图片",
            extensions: ["png", "jpg", "jpeg", "webp", "gif", "avif"]
          }
        ]
      });
      if (selection.canceled || !selection.filePaths.length)
        return { status: "accepted", requestId: command.id, payload: null };
      forwarded = CommandEnvelopeSchema.parse(
        createEnvelope(
          "long.importCharacterAssetsAtPaths",
          { ...command.payload, sourcePaths: selection.filePaths },
          { id: command.id, context: command.context }
        )
      );
    }
    const result = await ctx.supervisor.requestCommand(
      "core",
      forwarded,
      60_000
    );
    if (result.status === "rejected") return result;
    return {
      status: "accepted",
      requestId: command.id,
      payload:
        command.type === "long.prepareCharacterAppearanceDirectory"
          ? LongPrepareCharacterAppearanceDirectoryResultSchema.parse(
              result.payload
            )
          : command.type === "long.getCharacterAppearanceReferences"
            ? LongGetCharacterAppearanceReferencesResultSchema.parse(
                result.payload
              )
            : command.type === "long.deleteCharacterAppearance"
              ? LongDeleteCharacterAppearanceResultSchema.parse(result.payload)
              : LongCharacterProfileSnapshotSchema.parse(result.payload)
    };
  } catch (error) {
    return {
      status: "rejected",
      requestId: command.id,
      error: {
        code: "character_asset.operation_failed",
        message: error instanceof Error ? error.message : "角色资产操作失败",
        details: safeErrorDetails(error)
      }
    };
  }
}
