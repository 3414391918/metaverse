import { ref, watch } from "vue";
import type {
  DeepWriteApi,
  LongAddChapterVideoResult
} from "@deepwrite/contracts";
import type { ChapterImageContext } from "./useChapterImageActions";
import { chapterVideoDataUrl } from "./chapter-video-file";

interface Insertion {
  target: ChapterImageContext;
  content: string;
  expectedContent: string;
  offset: number;
  file?: File;
}

export function useChapterVideoInsertion(options: {
  context(): ChapterImageContext | undefined;
  documentKey(): string;
  content(): string;
  savedContent(): string | undefined;
  blocked(): boolean;
  api(): Pick<DeepWriteApi["long"], "addChapterVideo">;
  added(result: LongAddChapterVideoResult, previousContent: string): void;
  busy(value: boolean): void;
  error(message: string): void;
}) {
  const dialog = ref<Insertion | null>(null);
  const busy = ref(false);
  function open(offset: number) {
    const target = options.context();
    const expectedContent = options.savedContent();
    if (
      !target ||
      expectedContent === undefined ||
      busy.value ||
      options.blocked()
    )
      return;
    dialog.value = {
      target: { ...target },
      content: options.content(),
      expectedContent,
      offset
    };
  }
  function close() {
    if (!busy.value) dialog.value = null;
  }
  function accept(file: File) {
    if (dialog.value && !busy.value) dialog.value.file = file;
  }
  async function confirm() {
    const state = dialog.value;
    if (!state?.file || busy.value || options.blocked()) return;
    busy.value = true;
    options.busy(true);
    try {
      const videoDataUrl = await chapterVideoDataUrl(state.file);
      const result = await options.api().addChapterVideo({
        ...state.target,
        content: state.content,
        expectedContent: state.expectedContent,
        offset: state.offset,
        videoDataUrl
      });
      dialog.value = null;
      options.added(result, state.content);
    } catch (error) {
      options.error(error instanceof Error ? error.message : "视频添加失败。");
    } finally {
      busy.value = false;
      options.busy(false);
    }
  }
  watch(
    () =>
      `${options.context()?.bookId ?? ""}:${options.context()?.chapterCardId ?? ""}:${options.documentKey()}`,
    () => {
      if (!busy.value) dialog.value = null;
    }
  );
  return { dialog, busy, open, close, accept, confirm };
}
