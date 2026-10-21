import {
  CommandEnvelopeSchema,
  createEnvelope,
  LongAddChapterImageInputSchema,
  LongAddChapterImageResultSchema,
  type LongAddChapterImageInput,
  LongReadChapterImageInputSchema,
  LongReadChapterImageResultSchema,
  LongReplaceChapterImageInputSchema,
  LongReplaceChapterImageResultSchema,
  LongDeleteChapterImageInputSchema,
  LongDeleteChapterImageResultSchema,
  LongReadClipboardImageResultSchema,
  LongCopyChapterImageResultSchema,
  type LongReadChapterImageInput,
  type LongReplaceChapterImageInput,
  type LongDeleteChapterImageInput
} from "@deepwrite/contracts";
import { browserId, invokeCommand } from "./invoke";
async function invoke(type: string, payload: unknown) {
  const id = browserId("cmd_image");
  return await invokeCommand<unknown>(
    CommandEnvelopeSchema.parse(
      createEnvelope(type, payload, { id, correlationId: id })
    )
  );
}
export async function readChapterImage(input: LongReadChapterImageInput) {
  return LongReadChapterImageResultSchema.parse(
    await invoke(
      "long.readChapterImage",
      LongReadChapterImageInputSchema.parse(input)
    )
  );
}
export async function addChapterImage(input: LongAddChapterImageInput) {
  return LongAddChapterImageResultSchema.parse(
    await invoke(
      "long.addChapterImage",
      LongAddChapterImageInputSchema.parse(input)
    )
  );
}
export async function replaceChapterImage(input: LongReplaceChapterImageInput) {
  return LongReplaceChapterImageResultSchema.parse(
    await invoke(
      "long.replaceChapterImage",
      LongReplaceChapterImageInputSchema.parse(input)
    )
  );
}
export async function deleteChapterImage(input: LongDeleteChapterImageInput) {
  return LongDeleteChapterImageResultSchema.parse(
    await invoke(
      "long.deleteChapterImage",
      LongDeleteChapterImageInputSchema.parse(input)
    )
  );
}
export async function copyChapterImage(input: LongReadChapterImageInput) {
  return LongCopyChapterImageResultSchema.parse(
    await invoke(
      "long.copyChapterImage",
      LongReadChapterImageInputSchema.parse(input)
    )
  );
}
export async function copyChapterImagePath(input: LongReadChapterImageInput) {
  return LongCopyChapterImageResultSchema.parse(
    await invoke(
      "long.copyChapterImagePath",
      LongReadChapterImageInputSchema.parse(input)
    )
  );
}
export async function readClipboardImage() {
  return LongReadClipboardImageResultSchema.parse(
    await invoke("long.readClipboardImage", {})
  );
}
