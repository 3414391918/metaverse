import { effectScope, ref } from "vue";
import { afterEach, expect, it, vi } from "vitest";
import type {
  LongAddChapterImageInput,
  LongAddChapterImageResult
} from "@deepwrite/contracts";
import { useChapterIllustrationInsertion } from "./useChapterIllustrationInsertion";

const scopes: ReturnType<typeof effectScope>[] = [];
afterEach(() => scopes.splice(0).forEach((scope) => scope.stop()));
const png = "data:image/png;base64,iVBORw0KGgo=";
function setup(mirrorBusy = false) {
  const content = ref("原文。草稿。");
  const documentKey = ref("body_one");
  const blocked = ref(false);
  const added = vi.fn();
  const error = vi.fn();
  const busy = vi.fn((value: boolean) => {
    if (mirrorBusy) blocked.value = value;
  });
  const result = {
    filename: "001.png",
    content: "原文。\n\n![](images/001.png)\n\n草稿。",
    selectionOffset: 27
  } as LongAddChapterImageResult;
  const addChapterImage = vi.fn(async (input: LongAddChapterImageInput) => {
    structuredClone(input);
    return result;
  });
  const scope = effectScope();
  scopes.push(scope);
  const state = scope.run(() =>
    useChapterIllustrationInsertion({
      context: () => ({
        bookId: "longbook_example",
        chapterCardId: "chapter_example"
      }),
      documentKey: () => documentKey.value,
      content: () => content.value,
      savedContent: () => "原文。",
      blocked: () => blocked.value,
      api: () => ({ addChapterImage }),
      added,
      error,
      busy
    })
  )!;
  return {
    state,
    content,
    documentKey,
    blocked,
    addChapterImage,
    added,
    error,
    busy,
    result
  };
}

it("sends the draft, saved baseline and caret through a cloneable request, then delivers the saved result", async () => {
  const setupResult = setup();
  const { state, addChapterImage, added, result, busy } = setupResult;
  state.open(3);
  state.acceptPng(png);
  await state.confirm();
  expect(addChapterImage).toHaveBeenCalledWith({
    bookId: "longbook_example",
    chapterCardId: "chapter_example",
    content: "原文。草稿。",
    expectedContent: "原文。",
    offset: 3,
    pngDataUrl: png
  });
  expect(added).toHaveBeenCalledWith(result, "原文。草稿。");
  expect(state.dialog.value).toBeNull();
  expect(busy.mock.calls).toEqual([[true], [false]]);
});
it("cancel creates neither an image nor a Markdown reference", async () => {
  const { state, addChapterImage, added } = setup();
  state.open(0);
  state.acceptPng(png);
  state.close();
  await state.confirm();
  expect(addChapterImage).not.toHaveBeenCalled();
  expect(added).not.toHaveBeenCalled();
});
it("retains the pasted image and draft when saving fails", async () => {
  const { state, addChapterImage, error, added } = setup();
  addChapterImage.mockRejectedValueOnce(new Error("保存失败"));
  state.open(2);
  state.acceptPng(png);
  await state.confirm();
  expect(error).toHaveBeenCalledWith("保存失败");
  expect(state.dialog.value?.pastedImage).toBe(png);
  expect(added).not.toHaveBeenCalled();
  expect(state.busy.value).toBe(false);
});
it("keeps the paste dialog when the parent unlocks editing after a failed write", async () => {
  const { state, addChapterImage, blocked } = setup(true);
  addChapterImage.mockRejectedValueOnce(new Error("保存失败"));
  state.open(2);
  state.acceptPng(png);
  await state.confirm();
  expect(blocked.value).toBe(false);
  expect(state.dialog.value?.pastedImage).toBe(png);
  await state.confirm();
  expect(addChapterImage).toHaveBeenCalledTimes(2);
});
it("invalidates a dialog on document changes and refuses locked editors", async () => {
  const { state, documentKey, blocked, addChapterImage } = setup();
  state.open(1);
  state.acceptPng(png);
  documentKey.value = "body_two";
  expect(state.dialog.value).toBeNull();
  await state.confirm();
  expect(addChapterImage).not.toHaveBeenCalled();
  blocked.value = true;
  state.open(1);
  expect(state.dialog.value).toBeNull();
});
it("refuses a confirmation after the draft was edited and ignores duplicate clicks", async () => {
  const { state, content, addChapterImage } = setup();
  state.open(1);
  state.acceptPng(png);
  content.value = "较新的内容";
  await state.confirm();
  expect(addChapterImage).not.toHaveBeenCalled();
  state.open(0);
  state.acceptPng(png);
  await Promise.all([state.confirm(), state.confirm()]);
  expect(addChapterImage).toHaveBeenCalledOnce();
});
