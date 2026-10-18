import { nextTick, watch } from "vue";
import { recalledEditorScrollPosition } from "../utils/editorScrollMemory";
import {
  rememberLongPreviewImageSizes,
  restoreLongPreviewImageSizes
} from "../utils/longPreviewImageSizes";
import { useLongEditorScrollMemory } from "./useLongEditorScrollMemory";

/** Long documents load asynchronously and may contain images above the reader. */
export function useLongEditorViewport(
  options: Parameters<typeof useLongEditorScrollMemory>[0] & {
    contentReady: () => boolean;
  }
) {
  const memory = useLongEditorScrollMemory({
    ...options,
    bindIdentityWatch: false
  });
  const scrollerFor = (view = options.viewMode.value) =>
    view === "edit" && !options.visualMode?.()
      ? options.editorInput.value
      : options.documentPreview.value;

  function rememberScroll(
    key = options.documentKey(),
    view = options.viewMode.value,
    visual = options.visualMode?.() ?? false
  ): void {
    if (key === options.documentKey() && !options.contentReady()) return;
    if (view === "preview" || visual)
      rememberLongPreviewImageSizes(key, options.documentPreview.value);
    memory.rememberScroll(key, view, visual);
  }

  async function restoreScroll(
    key = options.documentKey(),
    view = options.viewMode.value
  ): Promise<void> {
    const scrollTop = recalledEditorScrollPosition(key, view);
    await nextTick();
    if (
      key !== options.documentKey() ||
      view !== options.viewMode.value ||
      !options.contentReady()
    )
      return;
    const scroller = scrollerFor(view);
    if (!scroller) return;
    if (view === "preview" || options.visualMode?.())
      restoreLongPreviewImageSizes(key, scroller);
    scroller.scrollTop = scrollTop;
  }

  function handleScroll(event: Event): void {
    if (!options.contentReady()) return;
    memory.handleScroll(event);
    if (options.viewMode.value === "preview" || options.visualMode?.())
      rememberLongPreviewImageSizes(options.documentKey(), event.currentTarget);
  }

  watch(
    [
      options.documentKey,
      () => options.viewMode.value,
      () => options.visualMode?.() ?? false
    ],
    ([nextKey, nextView], [previousKey, previousView, previousVisual]) => {
      rememberScroll(previousKey, previousView, previousVisual);
      void restoreScroll(nextKey, nextView);
    },
    { flush: "pre" }
  );
  // Restore again when an asynchronously loaded document's scroller is ready.
  watch(
    [
      () => options.editorInput.value,
      () => options.documentPreview.value,
      options.contentReady
    ],
    () => void restoreScroll(),
    { flush: "post" }
  );

  return { handleScroll, rememberScroll, restoreScroll };
}
