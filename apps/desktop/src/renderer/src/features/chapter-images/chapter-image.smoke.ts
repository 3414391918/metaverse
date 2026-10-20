import { effectScope } from "vue";
export { runChapterIllustrationRendererSmoke } from "./chapter-illustration.smoke";
export { runPromptTemplateRendererSmoke } from "../../components/prompt-template.smoke";
export { runToolManagerRendererSmoke } from "../../components/tool-manager.smoke";
import type { LongReadChapterImageInput } from "@deepwrite/contracts";
import { useChapterImageActions } from "./useChapterImageActions";
import { pastedImagePng, singlePastedImage } from "./clipboard-image";
export { runLongEditorPreviewSmoke } from "../../composables/long-editor-preview.smoke";
export {
  runCharacterAppearanceRendererSmoke,
  finishCharacterAppearanceRendererSmoke,
  runDescribedCharacterAppearanceRendererSmoke,
  runCharacterAppearanceDeletionSmoke,
  cleanupCharacterAppearanceSmoke
} from "../character-assets/character-appearance.smoke";

/** Bundled only by the smoke runner, never imported by the application. */
export async function runChapterImageRendererSmoke(
  target: LongReadChapterImageInput,
  imageUrl: string
) {
  const api = window.deepwrite?.long;
  if (!api) throw new Error("Chapter image smoke: Preload API unavailable");
  const scope = effectScope();
  const state = scope.run(() =>
    useChapterImageActions(
      () => target,
      () => api
    )
  )!;
  try {
    // The old preview can still be referenced by a previous view's DOM nodes.
    // Retain it while reopening so Chromium's decoded-image cache is exercised.
    const originalImage = new Image();
    originalImage.src = state.versionedUrl(imageUrl)!;
    await originalImage.decode();
    const originalPreview = `${originalImage.naturalWidth}x${originalImage.naturalHeight}`;
    state.openMenu(target, 10, 20);
    await state.beginReplacement();
    const before = state.dialog.value?.revision;
    if (!before) throw new Error("Chapter image smoke: original image missing");
    await state.pasteClipboard();
    const pasted = state.dialog.value?.pastedImage;
    if (!pasted)
      throw new Error("Chapter image smoke: native clipboard missing");
    const bytes = Uint8Array.from(atob(pasted.split(",")[1]!), (character) =>
      character.charCodeAt(0)
    );
    const file = new File([bytes], "clipboard.png", { type: "image/png" });
    // Exercise the same File → image decode → canvas path as Command/Ctrl+V,
    // inside the real page's Content Security Policy.
    const converted = await pastedImagePng(singlePastedImage([file])).catch(
      (error: unknown) => {
        throw new Error(`Clipboard File decode failed: ${String(error)}`);
      }
    );
    state.acceptPng(converted);
    await state.confirm();
    if (state.dialog.value)
      throw new Error("Chapter image smoke: replacement did not finish");
    const reread = await api.readChapterImage(target);
    if (reread.revision === before)
      throw new Error("Chapter image smoke: replacement was not saved");
    const savedDimensions = await imageDimensions(reread.pngDataUrl);
    if (savedDimensions === originalPreview)
      throw new Error(
        "Chapter image smoke: replacement fixture did not change"
      );
    if (
      (await imageDimensions(state.versionedUrl(imageUrl)!)) !== savedDimensions
    )
      throw new Error("Chapter image smoke: current preview shows old image");
    state.openMenu(target, 10, 20);
    await state.copy();
    scope.stop();
    const reopenedScope = effectScope();
    try {
      const reopened = reopenedScope.run(() =>
        useChapterImageActions(
          () => target,
          () => api
        )
      )!;
      if (
        (await imageDimensions(reopened.versionedUrl(imageUrl)!)) !==
        savedDimensions
      )
        throw new Error(
          "Chapter image smoke: reopened preview shows old image"
        );
    } finally {
      reopenedScope.stop();
    }
    let rejected = false;
    try {
      await api.replaceChapterImage({
        ...target,
        pngDataUrl: converted,
        expectedRevision: before
      });
    } catch {
      rejected = true;
    }
    if (!rejected)
      throw new Error("Chapter image smoke: stale replacement was accepted");
    return {
      status: "ok",
      revision: reread.revision,
      originalRevision: before,
      filePasteDecoded: true,
      previewReopened: true
    };
  } finally {
    scope.stop();
  }
}

async function imageDimensions(url: string): Promise<string> {
  const image = new Image();
  image.src = url;
  await image.decode();
  return `${image.naturalWidth}x${image.naturalHeight}`;
}
