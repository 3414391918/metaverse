import type { LongReadChapterVideoInput } from "@deepwrite/contracts";

// Vue refs proxy nested menu state. Electron's context bridge cannot clone proxies.
export function chapterVideoIpcTarget(
  target: LongReadChapterVideoInput
): LongReadChapterVideoInput {
  return {
    bookId: target.bookId,
    chapterCardId: target.chapterCardId,
    filename: target.filename
  };
}
