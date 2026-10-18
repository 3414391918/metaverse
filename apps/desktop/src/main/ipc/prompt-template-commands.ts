import { clipboard, nativeImage } from "electron";
import {
  PromptTemplateCopyImageResultSchema,
  PromptTemplateImageResultSchema,
  PromptTemplatesSchema,
  type CommandEnvelope,
  type CommandResult
} from "@deepwrite/contracts";
import type { IpcCommandContext } from "./command-types";
import { safeErrorDetails } from "./errors";

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function copyImage(pngDataUrl: string): void {
  const encoded = pngDataUrl.match(
    /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/
  )?.[1];
  if (!encoded) throw new Error("模板图片必须是 PNG 图片。");
  const bytes = Buffer.from(encoded, "base64");
  if (
    !bytes.length ||
    bytes.length > MAX_IMAGE_BYTES ||
    !bytes.subarray(0, 8).equals(PNG_SIGNATURE)
  )
    throw new Error("模板图片无效或超过 10 MB。");
  const image = nativeImage.createFromBuffer(bytes);
  if (image.isEmpty()) throw new Error("无法复制这张模板图片。");
  const { width, height } = image.getSize();
  if (width < 1 || height < 1 || width * height > 40_000_000)
    throw new Error("图片尺寸过大，无法复制。");
  clipboard.writeImage(image);
}

export async function handlePromptTemplateCommands(
  ctx: Pick<IpcCommandContext, "requirePromptTemplateStore">,
  command: CommandEnvelope
): Promise<CommandResult | undefined> {
  if (!command.type.startsWith("promptTemplates.")) return undefined;
  try {
    let payload: unknown;
    switch (command.type) {
      case "promptTemplates.list":
        payload = PromptTemplatesSchema.parse(
          await ctx.requirePromptTemplateStore().list()
        );
        break;
      case "promptTemplates.save":
        payload = PromptTemplatesSchema.parse(
          await ctx.requirePromptTemplateStore().save(command.payload)
        );
        break;
      case "promptTemplates.delete":
        payload = PromptTemplatesSchema.parse(
          await ctx.requirePromptTemplateStore().delete(command.payload.id)
        );
        break;
      case "promptTemplates.readImage":
        payload = PromptTemplateImageResultSchema.parse(
          await ctx.requirePromptTemplateStore().readImage(command.payload)
        );
        break;
      case "promptTemplates.copyImage":
        copyImage(command.payload.pngDataUrl);
        payload = PromptTemplateCopyImageResultSchema.parse({ copied: true });
        break;
      default:
        return undefined;
    }
    return { status: "accepted", requestId: command.id, payload };
  } catch (error: unknown) {
    return {
      status: "rejected",
      requestId: command.id,
      error: {
        code: "prompt_templates.operation_failed",
        message:
          error instanceof Error ? error.message : "提示词模板操作失败。",
        details: safeErrorDetails(error)
      }
    };
  }
}
