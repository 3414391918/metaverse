import {
  CommandEnvelopeSchema,
  createEnvelope,
  LongAddChapterVideoInputSchema,
  LongAddChapterVideoResultSchema,
  LongCopyChapterVideoResultSchema,
  LongDeleteChapterVideoInputSchema,
  LongDeleteChapterVideoResultSchema,
  LongReadChapterVideoInputSchema,
  LongReadChapterVideoResultSchema,
  LongReplaceChapterVideoInputSchema,
  LongReplaceChapterVideoResultSchema,
  type LongAddChapterVideoInput,
  type LongDeleteChapterVideoInput,
  type LongReadChapterVideoInput,
  type LongReplaceChapterVideoInput
} from "@deepwrite/contracts";
import { browserId, invokeCommand } from "./invoke";

async function invoke(type: string, payload: unknown) {
  const id = browserId("cmd_video");
  return invokeCommand<unknown>(
    CommandEnvelopeSchema.parse(
      createEnvelope(type, payload, { id, correlationId: id })
    )
  );
}
export async function readChapterVideo(input: LongReadChapterVideoInput) {
  return LongReadChapterVideoResultSchema.parse(
    await invoke(
      "long.readChapterVideo",
      LongReadChapterVideoInputSchema.parse(input)
    )
  );
}
export async function addChapterVideo(input: LongAddChapterVideoInput) {
  return LongAddChapterVideoResultSchema.parse(
    await invoke(
      "long.addChapterVideo",
      LongAddChapterVideoInputSchema.parse(input)
    )
  );
}
export async function replaceChapterVideo(input: LongReplaceChapterVideoInput) {
  return LongReplaceChapterVideoResultSchema.parse(
    await invoke(
      "long.replaceChapterVideo",
      LongReplaceChapterVideoInputSchema.parse(input)
    )
  );
}
export async function deleteChapterVideo(input: LongDeleteChapterVideoInput) {
  return LongDeleteChapterVideoResultSchema.parse(
    await invoke(
      "long.deleteChapterVideo",
      LongDeleteChapterVideoInputSchema.parse(input)
    )
  );
}
export async function copyChapterVideo(input: LongReadChapterVideoInput) {
  return LongCopyChapterVideoResultSchema.parse(
    await invoke(
      "long.copyChapterVideo",
      LongReadChapterVideoInputSchema.parse(input)
    )
  );
}
export async function copyChapterVideoPath(input: LongReadChapterVideoInput) {
  return LongCopyChapterVideoResultSchema.parse(
    await invoke(
      "long.copyChapterVideoPath",
      LongReadChapterVideoInputSchema.parse(input)
    )
  );
}
