import { onScopeDispose, ref, watch } from "vue";
import type {
  DeepWriteApi,
  LongAddChapterImageResult
} from "@deepwrite/contracts";
import { registerTextMenuIllustration } from "../../composables/nativeTextContextMenu";
import type { ChapterImageContext } from "./useChapterImageActions";

interface Insertion {
  target: ChapterImageContext;
  documentKey: string;
  content: string;
  expectedContent: string;
  offset: number;
  pastedImage?: string;
}

export function useChapterIllustrationInsertion(options: {
  context(): ChapterImageContext | undefined;
  documentKey(): string;
  content(): string;
  savedContent(): string | undefined;
  blocked(): boolean;
  api(): Pick<DeepWriteApi["long"], "addChapterImage">;
  added(result: LongAddChapterImageResult, previousContent: string): void;
  busy(value: boolean): void;
  error(message: string): void;
}) {
  const dialog = ref<Insertion | null>(null);
  const busy = ref(false);
  let releaseMenu: (() => void) | undefined;
  let disposed = false;
  function identity() {
    const context = options.context();
    return `${context?.bookId ?? ""}:${context?.chapterCardId ?? ""}:${options.documentKey()}`;
  }
  function open(offset: number) {
    const target = options.context();
    const expectedContent = options.savedContent();
    if (
      !target ||
      expectedContent === undefined ||
      busy.value ||
      options.blocked() ||
      disposed
    )
      return;
    dialog.value = {
      target: { ...target },
      documentKey: options.documentKey(),
      content: options.content(),
      expectedContent,
      offset
    };
  }
  function register(
    event: MouseEvent,
    baseOffset = 0,
    addVideo?: (offset: number) => void
  ) {
    releaseMenu?.();
    releaseMenu = undefined;
    const input = event.currentTarget;
    if (
      !(input instanceof HTMLTextAreaElement) ||
      input.readOnly ||
      !options.context() ||
      options.savedContent() === undefined ||
      options.blocked()
    )
      return;
    const key = identity();
    const content = options.content();
    releaseMenu = registerTextMenuIllustration(event, {
      valid: () =>
        !disposed &&
        input.isConnected &&
        identity() === key &&
        options.content() === content &&
        !options.blocked() &&
        !busy.value,
      add: () => open(baseOffset + input.selectionEnd),
      ...(addVideo
        ? { addVideo: () => addVideo(baseOffset + input.selectionEnd) }
        : {})
    });
  }
  function close() {
    if (!busy.value) dialog.value = null;
  }
  function acceptPng(pngDataUrl: string) {
    if (dialog.value && !busy.value) dialog.value.pastedImage = pngDataUrl;
  }
  async function confirm() {
    const state = dialog.value;
    if (!state?.pastedImage || busy.value || options.blocked() || disposed)
      return;
    busy.value = true;
    options.busy(true);
    try {
      const result = await options.api().addChapterImage({
        ...state.target,
        content: state.content,
        expectedContent: state.expectedContent,
        offset: state.offset,
        pngDataUrl: state.pastedImage
      });
      if (disposed) return;
      dialog.value = null;
      options.added(result, state.content);
    } catch (error) {
      if (!disposed)
        options.error(
          error instanceof Error ? error.message : "插画添加失败。"
        );
    } finally {
      busy.value = false;
      options.busy(false);
    }
  }
  watch(
    () =>
      [
        identity(),
        options.content(),
        options.savedContent(),
        options.blocked()
      ] as const,
    (
      [key, content, saved, blocked],
      [previousKey, previousContent, previousSaved]
    ) => {
      // The parent mirrors this operation's busy state back into blocked().
      // Becoming editable again must retain a failed paste for retry.
      if (
        key === previousKey &&
        content === previousContent &&
        saved === previousSaved &&
        !blocked
      )
        return;
      releaseMenu?.();
      releaseMenu = undefined;
      if (!busy.value) dialog.value = null;
    },
    { flush: "sync" }
  );
  onScopeDispose(() => {
    disposed = true;
    releaseMenu?.();
    dialog.value = null;
    if (busy.value) options.busy(false);
  });
  return { dialog, busy, open, register, close, acceptPng, confirm };
}
