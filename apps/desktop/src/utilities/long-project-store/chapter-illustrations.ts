import {
  LongAddChapterImageInputSchema,
  type LongAddChapterImageInput
} from "@deepwrite/contracts";
import { encodeChapterImageReplacement } from "./chapter-image-codec";
import { addChapterImageBytes } from "./chapter-illustration-transaction";
import type { LongProjectStoreContext } from "./store-context";

export async function addChapterImage(
  ctx: LongProjectStoreContext,
  directory: string,
  rawInput: LongAddChapterImageInput
) {
  const { pngDataUrl, ...input } =
    LongAddChapterImageInputSchema.parse(rawInput);
  const png = await encodeChapterImageReplacement(pngDataUrl, "png");
  return addChapterImageBytes(ctx, directory, input, png);
}
