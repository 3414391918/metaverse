import { effectScope, nextTick, ref } from "vue";
import { afterEach, expect, it, vi } from "vitest";
import type {
  LongReadChapterImageInput,
  LongReplaceChapterImageInput
} from "@deepwrite/contracts";
import { useChapterImageActions } from "./useChapterImageActions";
const scopes: ReturnType<typeof effectScope>[] = [];
afterEach(() => scopes.splice(0).forEach((scope) => scope.stop()));
const target = {
  bookId: "longbook_example",
  chapterCardId: "chapter_example",
  filename: "001.png"
};
const png = "data:image/png;base64,iVBORw0KGgo=";
function setup(
  read = async () => ({ pngDataUrl: png, revision: "a".repeat(64) })
) {
  const context = ref({
    bookId: target.bookId,
    chapterCardId: target.chapterCardId
  });
  const api = {
    // contextBridge must clone these arguments before Preload can validate them.
    readChapterImage: vi.fn(async (input: LongReadChapterImageInput) => {
      structuredClone(input);
      return await read();
    }),
    replaceChapterImage: vi.fn(async (input: LongReplaceChapterImageInput) => {
      structuredClone(input);
      return { revision: "b".repeat(64) };
    }),
    deleteChapterImage: vi.fn(async (input: unknown) => {
      structuredClone(input);
      return {
        content: "# 正文\n\n",
        selectionOffset: 6,
        fileDeleted: true,
        document: {
          bookId: target.bookId,
          file: {
            id: "file_body",
            path: "long/chapters/chapter_example/body.md",
            updatedAt: "2026-10-16T00:00:00.000Z"
          },
          summary: {} as never
        }
      };
    }),
    copyChapterImage: vi.fn(async (input: LongReadChapterImageInput) => {
      structuredClone(input);
      return { copied: true as const };
    }),
    copyChapterImagePath: vi.fn(async (input: LongReadChapterImageInput) => {
      structuredClone(input);
      return { copied: true as const };
    }),
    readClipboardImage: vi.fn(async () => ({ pngDataUrl: png }))
  };
  const scope = effectScope();
  scopes.push(scope);
  const state = scope.run(() =>
    useChapterImageActions(
      () => context.value,
      () => api
    )
  )!;
  return { state, api, context };
}
it("copies the selected image through the context bridge without sending a Vue proxy", async () => {
  const { state, api } = setup();
  state.openMenu(target, 10, 20);
  expect(() => structuredClone(state.menu.value?.target)).toThrow();
  await expect(state.copy()).resolves.toBeUndefined();
  expect(api.copyChapterImage).toHaveBeenCalledWith(target);
  expect(state.menu.value).toBeNull();
});
it("copies the selected image path without passing a Vue proxy", async () => {
  const { state, api } = setup();
  state.openMenu(target, 10, 20);
  await expect(state.copyPath()).resolves.toBeUndefined();
  expect(api.copyChapterImagePath).toHaveBeenCalledWith(target);
  expect(state.menu.value).toBeNull();
});
it("deletes only the selected image occurrence using the saved document snapshot", async () => {
  const { state, api } = setup();
  const content = "# 正文\n\n![](images/001.png)\n";
  state.openMenu(target, 10, 20, 6);
  await state.beginDeletion(content, content);
  await state.confirmDeletion();
  expect(api.deleteChapterImage).toHaveBeenCalledWith({
    ...target,
    offset: 6,
    expectedContent: content,
    expectedRevision: "a".repeat(64)
  });
});
it("cancel leaves files untouched, confirm retains the filename and refreshes every same-image URL", async () => {
  const { state, api } = setup();
  state.openMenu(target, 10, 20);
  await state.beginReplacement();
  state.acceptPng(png);
  state.closeDialog();
  expect(api.replaceChapterImage).not.toHaveBeenCalled();
  state.openMenu(target, 10, 20);
  await state.beginReplacement();
  await state.pasteClipboard();
  await state.confirm();
  expect(api.replaceChapterImage).toHaveBeenCalledWith({
    ...target,
    pngDataUrl: png,
    expectedRevision: "a".repeat(64)
  });
  const url = `deepwrite-image://book/${target.bookId}/${"a".repeat(32)}/001.png`;
  expect(state.versionedUrl(url)).toBe(url + "?v=" + "b".repeat(64));
  expect(state.dialog.value).toBeNull();
});
it("ignores reads and clipboard results after switching chapters", async () => {
  let finish!: (value: { pngDataUrl: string; revision: string }) => void;
  const { state, context } = setup(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  state.openMenu(target, 10, 20);
  const pending = state.beginReplacement();
  context.value = { ...context.value, chapterCardId: "chapter_other" };
  await nextTick();
  finish({ pngDataUrl: png, revision: "a".repeat(64) });
  await pending;
  expect(state.dialog.value).toBeNull();
  expect(state.menu.value).toBeNull();
});
it("keeps the replacement open after a failed save and does not update its URL", async () => {
  const { state, api } = setup();
  const url = `deepwrite-image://book/${target.bookId}/${"a".repeat(32)}/001.png`;
  const beforeUrl = state.versionedUrl(url);
  api.replaceChapterImage.mockRejectedValueOnce(new Error("图片已被修改"));
  state.openMenu(target, 10, 20);
  await state.beginReplacement();
  state.acceptPng(png);
  await expect(state.confirm()).rejects.toThrow("图片已被修改");
  expect(state.dialog.value?.pastedImage).toBe(png);
  expect(state.versionedUrl(url)).toBe(beforeUrl);
});
it("refreshes chapter switches and preserves non-local image URLs", async () => {
  const { state, context } = setup();
  const url = `deepwrite-image://book/${target.bookId}/${"a".repeat(32)}/001.png`;
  const before = state.versionedUrl(url);
  context.value = { ...context.value, chapterCardId: "chapter_other" };
  await nextTick();
  context.value = { ...context.value, chapterCardId: target.chapterCardId };
  await nextTick();
  expect(state.versionedUrl(url)).not.toBe(before);
  expect(state.versionedUrl("https://example.test/image.png")).toBe(
    "https://example.test/image.png"
  );
  expect(state.versionedUrl(undefined)).toBeUndefined();
});
it("reloads the file when preview is reopened after replacing an image", async () => {
  const url = `deepwrite-image://book/${target.bookId}/${"a".repeat(32)}/001.png`;
  const first = setup();
  const originalUrl = first.state.versionedUrl(url);
  first.state.openMenu(target, 10, 20);
  await first.state.beginReplacement();
  first.state.acceptPng(png);
  await first.state.confirm();
  scopes.at(-1)!.stop();

  const reopened = setup();
  expect(reopened.state.versionedUrl(url)).not.toBe(originalUrl);
  expect(reopened.state.versionedUrl(url)).toMatch(/\?v=[a-f0-9]{64}$/u);
  expect(reopened.state.versionedUrl(url)).toBe(
    reopened.state.versionedUrl(url)
  );
});
