import { createApp, h, nextTick } from "vue";
import { createPinia } from "pinia";
import type {
  LongBookSummary,
  LongWorkspaceIndexSnapshot,
  TextContextMenuEvent,
  TextContextMenuCommand
} from "@deepwrite/contracts";
import LongWorkspaceEditor from "../../components/LongWorkspaceEditor.vue";
import { createLongChapterSelection } from "../../types/longWorkspace";
import { installNativeTextContextMenu } from "../../composables/nativeTextContextMenu";
import { splitChapterVisualSegments } from "./chapterVisualSegments";

/** Runs inside a disposable Electron profile with the real image/save IPC. */
export async function runChapterIllustrationRendererSmoke(
  summary: LongBookSummary,
  index: LongWorkspaceIndexSnapshot
) {
  const started = performance.now();
  const mark = (step: string) =>
    console.info(
      `ILLUSTRATION_SMOKE ${Math.round(performance.now() - started)}ms ${step}`
    );
  const api = window.deepwrite?.long;
  if (!api) throw new Error("Illustration smoke Preload unavailable");
  const chapter = index.chapters[0]!;
  const selection = createLongChapterSelection(
    summary,
    index,
    chapter.chapterCardId
  )!;
  const host = document.createElement("div");
  host.style.cssText =
    "position:fixed;inset:0;z-index:99999;width:1000px;height:700px";
  document.body.append(host);
  let dispatch!: (event: TextContextMenuEvent) => void;
  let prepared: TextContextMenuCommand | undefined;
  const disposeMenu = installNativeTextContextMenu({
    subscribe(listener) {
      dispatch = listener;
      return () => {};
    },
    reply(command) {
      if (command.payload.phase === "prepared") prepared = command;
    }
  });
  const createEditor = () =>
    createApp({
      render: () =>
        h(LongWorkspaceEditor, {
          bookId: summary.id,
          selection,
          workspaceIndex: index,
          defaultViewMode: "edit"
        })
    }).use(createPinia());
  let application = createEditor();
  const wait = async (predicate: () => boolean, step: string) => {
    const deadline = Date.now() + 15_000;
    while (!predicate()) {
      if (Date.now() > deadline)
        throw new Error(`Illustration UI smoke timed out: ${step}`);
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    await nextTick();
  };
  const editor = () =>
    host.querySelector<HTMLTextAreaElement>(".long-visual-source-input")!;
  const visualTextAt = (offset: number) => {
    const parts = splitChapterVisualSegments(editor().value, (source) =>
      source.startsWith("images/") ? source : undefined
    );
    const index = parts.findIndex(
      (part) =>
        part.kind === "text" && part.start <= offset && offset <= part.end
    );
    const part = parts[index];
    const input = host.querySelector<HTMLTextAreaElement>(
      `.chapter-visual-text[data-segment-index="${index}"]`
    );
    if (!part || !input)
      throw new Error(`Visual chapter text missing at offset ${offset}`);
    return { input, localOffset: offset - part.start };
  };
  const dialog = () =>
    [...document.querySelectorAll<HTMLElement>(".character-dialog")].find(
      (item) => item.querySelector("h3")?.textContent === "新增图片"
    );
  const button = (label: string, root: ParentNode = host) => {
    const control = [
      ...root.querySelectorAll<HTMLButtonElement>("button")
    ].find((item) => item.textContent?.trim() === label);
    if (!control || control.disabled)
      throw new Error(`Illustration button unavailable: ${label}`);
    return control;
  };
  let menuId = 0;
  async function open(offset: number) {
    mark("open menu");
    const { input, localOffset } = visualTextAt(offset);
    input.focus();
    input.setSelectionRange(localOffset, localOffset);
    input.dispatchEvent(
      new MouseEvent("contextmenu", { bubbles: true, button: 2 })
    );
    const id = `illustration_smoke_${++menuId}`;
    const send = (payload: TextContextMenuEvent["payload"]) =>
      dispatch({
        protocolVersion: 1,
        id,
        type: "textContextMenu.event",
        timestamp: new Date().toISOString(),
        context: { correlationId: id },
        payload
      });
    send({ phase: "prepare" });
    if (
      prepared?.payload.phase !== "prepared" ||
      !prepared.payload.context.canAddIllustration
    )
      throw new Error("Chapter editor omitted the illustration menu action");
    send({ phase: "action", action: "addIllustration" });
    await wait(() => Boolean(dialog()), "open paste dialog");
  }
  try {
    mark("mount editor");
    application.mount(host);
    await wait(
      () =>
        Boolean(
          editor() &&
          host.querySelector<HTMLTextAreaElement>(".chapter-visual-text") &&
          editor().value
        ),
      "load editable manuscript"
    );
    mark("editor ready");
    const writingViewport = host.querySelector<HTMLElement>(
      ".long-document-preview"
    )!;
    writingViewport.style.height = "300px";
    writingViewport.style.maxHeight = "300px";
    writingViewport.style.overflowY = "auto";
    const beforeVisualEdit = editor().value;
    const lastText = [
      ...host.querySelectorAll<HTMLTextAreaElement>(".chapter-visual-text")
    ].at(-1)!;
    lastText.focus();
    lastText.setSelectionRange(lastText.value.length, lastText.value.length);
    lastText.dispatchEvent(
      new InputEvent("beforeinput", {
        bubbles: true,
        inputType: "insertText",
        data: "可视编辑"
      })
    );
    lastText.setRangeText(
      "可视编辑",
      lastText.value.length,
      lastText.value.length,
      "end"
    );
    lastText.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        inputType: "insertText",
        data: "可视编辑"
      })
    );
    await wait(
      () => editor().value.endsWith("可视编辑"),
      "direct visual text edit"
    );
    const nativeUndo = new InputEvent("beforeinput", {
      bubbles: true,
      cancelable: true,
      inputType: "historyUndo"
    });
    lastText.dispatchEvent(nativeUndo);
    if (!nativeUndo.defaultPrevented)
      throw new Error("Visual editor did not intercept native undo");
    await wait(() => editor().value === beforeVisualEdit, "visual native undo");
    const nativeRedo = new InputEvent("beforeinput", {
      bubbles: true,
      cancelable: true,
      inputType: "historyRedo"
    });
    [...host.querySelectorAll<HTMLTextAreaElement>(".chapter-visual-text")]
      .at(-1)!
      .dispatchEvent(nativeRedo);
    if (!nativeRedo.defaultPrevented)
      throw new Error("Visual editor did not intercept native redo");
    await wait(() => editor().value.endsWith("可视编辑"), "visual native redo");
    const original = editor().value;
    const offset = original.indexOf("\n");
    if (offset < 0) throw new Error("Illustration fixture needs paragraphs");
    await open(offset);
    button("取消", dialog()!).click();
    await wait(() => !dialog(), "cancel paste dialog");
    if (editor().value !== original)
      throw new Error("Cancel changed the draft");
    mark("cancel verified");
    for (const filename of ["001.png", "002.png"]) {
      const before = editor().value;
      await open(offset);
      const preview = host.querySelector<HTMLElement>(
        ".long-document-preview"
      )!;
      preview.scrollTop = 820;
      preview.dispatchEvent(new Event("scroll"));
      if (preview.scrollTop !== 820)
        throw new Error(
          `Illustration fixture is not scrollable: ${preview.scrollHeight}/${preview.clientHeight}`
        );
      const confirm = button(
        "取消",
        dialog()!
      ).parentElement!.querySelector<HTMLButtonElement>(
        ".chapter-image-confirm"
      )!;
      if (!confirm.disabled)
        throw new Error("Empty image confirmation was enabled");
      mark(`paste ${filename}`);
      if (filename === "001.png") {
        const snapshot = await api.readClipboardImage();
        if (!snapshot) throw new Error("Illustration clipboard is empty");
        const bytes = Uint8Array.from(
          atob(snapshot.pngDataUrl.split(",")[1]!),
          (character) => character.charCodeAt(0)
        );
        const clipboardData = new DataTransfer();
        clipboardData.items.add(
          new File([bytes], "clipboard.png", { type: "image/png" })
        );
        // Exercise the same paste event path as Command/Ctrl+V, including decode.
        dialog()!.dispatchEvent(
          new ClipboardEvent("paste", {
            clipboardData,
            bubbles: true,
            cancelable: true
          })
        );
      } else button("粘贴图片", dialog()!).click();
      await wait(() => !confirm.disabled, `paste ${filename}`);
      if (Math.abs(preview.scrollTop - 820) > 1)
        throw new Error(
          `Preparing an illustration displaced the writing view: ${preview.scrollTop}`
        );
      mark(`confirm ${filename}`);
      confirm.click();
      await wait(
        () => !dialog() && editor().value.includes(`![](images/${filename})`),
        `save ${filename}`
      );
      const saved = await api.readDocument({
        bookId: summary.id,
        fileId: chapter.body.id,
        offset: 0,
        maxCharacters: 256 * 1024
      });
      if (saved.content !== editor().value)
        throw new Error("Inserted Markdown was not saved");
      await nextTick();
      if (Math.abs(preview.scrollTop - 820) > 1)
        throw new Error(
          `Adding an illustration displaced the writing view: ${preview.scrollTop}`
        );
      mark(`saved ${filename}`);
      if (filename === "001.png") {
        const undo = host.querySelector<HTMLButtonElement>(
          'button[aria-label="撤销"],button[title="撤销"]'
        )!;
        if (!undo || undo.disabled)
          throw new Error(
            "Illustration insertion was missing from undo history"
          );
        undo.click();
        await nextTick();
        if (editor().value !== before)
          throw new Error("Undo lost the original manuscript");
        if (Math.abs(preview.scrollTop - 820) > 1)
          throw new Error("Undoing an illustration displaced the writing view");
        const redo = host.querySelector<HTMLButtonElement>(
          'button[aria-label="还原"]'
        )!;
        redo.click();
        await nextTick();
        if (editor().value !== saved.content)
          throw new Error("Redo lost the image reference");
        if (Math.abs(preview.scrollTop - 820) > 1)
          throw new Error("Redoing an illustration displaced the writing view");
      }
    }
    const expected = editor().value;
    mark("images inline");
    await wait(
      () =>
        host.querySelectorAll('img[src*="/001.png"],img[src*="/002.png"]')
          .length === 2,
      "preview both illustrations"
    );
    for (const image of host.querySelectorAll<HTMLImageElement>(
      'img[src*="/001.png"],img[src*="/002.png"]'
    )) {
      image.loading = "eager";
      await image.decode();
    }
    const firstImage = host.querySelector<HTMLImageElement>(
      'img[src*="/001.png"]'
    )!;
    firstImage.dispatchEvent(
      new MouseEvent("contextmenu", { bubbles: true, button: 2 })
    );
    await wait(
      () => Boolean(document.querySelector(".chapter-image-menu")),
      "inline image actions"
    );
    const imageMenu = document.querySelector<HTMLElement>(
      ".chapter-image-menu"
    )!;
    button("替换图片", imageMenu).click();
    await wait(
      () =>
        Boolean(
          [...document.querySelectorAll<HTMLElement>(".character-dialog")].find(
            (item) => item.querySelector("h3")?.textContent === "替换图片"
          )
        ),
      "inline image replacement"
    );
    button("取消", document.body).click();
    await wait(
      () => !document.querySelector(".chapter-image-menu-dismiss"),
      "close inline image replacement"
    );
    firstImage.dispatchEvent(
      new MouseEvent("contextmenu", { bubbles: true, button: 2 })
    );
    await wait(
      () => Boolean(document.querySelector(".chapter-image-menu")),
      "reopen inline image actions"
    );
    button("复制图片", document.querySelector(".chapter-image-menu")!).click();
    await wait(
      () => !document.querySelector(".chapter-image-menu"),
      "copy inline image"
    );
    if (!(await api.readClipboardImage()))
      throw new Error("Inline image copy did not reach the clipboard");
    application.unmount();
    mark("reopen preview");
    application = createEditor();
    application.mount(host);
    await wait(
      () =>
        host.querySelectorAll('img[src*="/001.png"],img[src*="/002.png"]')
          .length === 2,
      "reopen illustration preview"
    );
    mark("reopened image elements ready");
    for (const image of host.querySelectorAll<HTMLImageElement>(
      'img[src*="/001.png"],img[src*="/002.png"]'
    )) {
      // Offscreen lazy images defer decoding until visible. Match the existing
      // preview smoke while verifying the same persisted image URLs.
      image.loading = "eager";
      await Promise.race([
        image.decode(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("Reopened illustration decode timed out")),
            10_000
          )
        )
      ]);
    }
    mark("reopened images decoded");
    await wait(
      () => Boolean(editor() && editor().value === expected),
      "reload saved manuscript"
    );
    if (host.querySelector(".long-editor-save-state.is-dirty"))
      throw new Error("Inserted image was shown as unsaved");
    mark("complete");
    return {
      status: "ok",
      cancel: true,
      added: true,
      keyboardPaste: true,
      sequence: true,
      undoRedo: true,
      preview: true,
      reopened: true
    };
  } finally {
    application.unmount();
    disposeMenu();
    host.remove();
  }
}
