import { createApp, h, nextTick, reactive } from "vue";
import { createPinia } from "pinia";
import type {
  LongBookSummary,
  LongWorkspaceIndexSnapshot
} from "@deepwrite/contracts";
import LongWorkspaceEditor from "../components/LongWorkspaceEditor.vue";
import {
  createLongChapterSelection,
  createLongPlotPointVolumeSelection,
  reconcileLongWorkspaceSelection
} from "../types/longWorkspace";

/** Temporary Electron test bundle only; never imported by the application. */
export async function runLongEditorPreviewSmoke(
  summary: LongBookSummary,
  index: LongWorkspaceIndexSnapshot
) {
  const style = document.createElement("link");
  style.rel = "stylesheet";
  style.href = new URL(
    /* @vite-ignore */ "./chapter-image.smoke.css",
    import.meta.url
  ).href;
  await new Promise<void>((resolve, reject) => {
    style.onload = () => resolve();
    style.onerror = () => reject(new Error("Preview smoke stylesheet failed"));
    document.head.append(style);
  });
  const host = document.createElement("div");
  host.id = "deepwrite-preview-smoke";
  const viewportStyle = document.createElement("style");
  viewportStyle.textContent =
    "#deepwrite-preview-smoke .long-document-preview{height:300px!important;max-height:300px!important;overflow-y:auto!important}";
  document.head.append(viewportStyle);
  host.style.cssText =
    "position:fixed;inset:0;width:1000px;height:700px;z-index:99999";
  document.body.append(host);
  const props = reactive({
    bookId: summary.id,
    selection: createLongChapterSelection(
      summary,
      index,
      index.chapters[0]!.chapterCardId
    )!,
    workspaceIndex: index,
    defaultViewMode: "edit" as const
  });
  if (!props.selection)
    throw new Error("Preview smoke chapter selection missing");
  const createEditor = () => {
    const instance = createApp({
      render: () => h(LongWorkspaceEditor, props)
    }).use(createPinia());
    instance.config.errorHandler = (error) => {
      host.textContent = `Vue error: ${String(error)} ${error instanceof Error ? error.stack : ""}`;
    };
    return instance;
  };
  let app = createEditor();
  try {
    const chapterSelection = props.selection;
    const plotIndex: LongWorkspaceIndexSnapshot = {
      ...index,
      plot: {
        ...index.plot,
        arcs: [
          {
            id: "arc_preview_smoke",
            volumeId: index.plot.volumes[0]!.id,
            title: "预览初始化测试",
            order: 1,
            outline: ""
          }
        ]
      }
    };
    props.workspaceIndex = plotIndex;
    props.selection = createLongPlotPointVolumeSelection(
      summary,
      plotIndex,
      plotIndex.plot.volumes[0]!.id
    )!;
    app.mount(host);
    await until(
      () => Boolean(host.querySelector(".long-document-editor")),
      host,
      "plot point editor"
    );
    app.unmount();
    props.workspaceIndex = index;
    props.selection = chapterSelection;
    app = createEditor();
    app.mount(host);
    await until(
      () => Boolean(host.querySelector(".chapter-visual-editor textarea")),
      host,
      "unified chapter editor"
    );
    const preview = host.querySelector<HTMLElement>(".long-document-preview")!;
    await until(() => loadedChapterText(preview), host, "loaded chapter text");
    for (const input of preview.querySelectorAll<HTMLTextAreaElement>(
      ".chapter-visual-text"
    )) {
      if (input.scrollHeight > input.clientHeight + 2)
        throw new Error("Chapter textarea clips part of its content");
    }
    if (host.querySelector(".long-editor-view-tabs"))
      throw new Error("Unified chapter still shows separate edit/preview tabs");
    await decodeImages(preview);
    preview.scrollTop = 820;
    preview.dispatchEvent(new Event("scroll"));
    const position = preview.scrollTop;
    if (position !== 820)
      throw new Error(
        `Preview smoke content is not scrollable: ${preview.scrollHeight}/${preview.clientHeight}`
      );

    const input = preview.querySelector<HTMLTextAreaElement>(
      ".chapter-visual-text"
    )!;
    const caret = input.value.indexOf("用于检查预览位置保留", 300);
    input.focus({ preventScroll: true });
    input.setSelectionRange(caret, caret);
    preview.scrollTop = position;
    input.dispatchEvent(
      new InputEvent("beforeinput", {
        bubbles: true,
        inputType: "insertText",
        data: "新"
      })
    );
    input.setRangeText("新", caret, caret, "end");
    input.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        inputType: "insertText",
        data: "新"
      })
    );
    await settle();
    assertPreview(host, position, "typing inside chapter body");
    const undo = new InputEvent("beforeinput", {
      bubbles: true,
      cancelable: true,
      inputType: "historyUndo"
    });
    input.dispatchEvent(undo);
    if (!undo.defaultPrevented)
      throw new Error("Chapter editor did not intercept native undo");
    await settle();
    assertPreview(host, position, "undo inside chapter body");

    host.querySelector<HTMLButtonElement>('button[aria-label="查找"]')!.click();
    await settle();
    const find = host.querySelector<HTMLInputElement>(
      'input[aria-label="查找文字"]'
    )!;
    find.value = "唯一查找锚点";
    find.dispatchEvent(new Event("input", { bubbles: true }));
    await settle();
    if (preview.scrollTop <= position)
      throw new Error("Searching did not reveal the chapter caret");
    host
      .querySelector<HTMLButtonElement>('button[aria-label="关闭查找"]')
      ?.click();
    preview.scrollTop = position;
    preview.dispatchEvent(new Event("scroll"));

    // Window-focus refresh publishes newly allocated index and selection objects
    // while retaining exactly the same book, file, and content.
    const fresh = await window.deepwrite!.long.getWorkspaceIndex({
      bookId: summary.id
    });
    props.workspaceIndex = fresh.workspaceIndex;
    props.selection = reconcileLongWorkspaceSelection(
      summary,
      fresh.workspaceIndex,
      props.selection
    )!;
    await settle();
    assertPreview(host, position, "focus refresh");

    app.unmount();
    app = createEditor();
    app.mount(host);
    await until(
      () => Boolean(host.querySelector(".chapter-visual-editor textarea")),
      host,
      "reopened chapter editor"
    );
    await until(() => loadedChapterText(host), host, "reopened chapter text");
    await decodeImages(
      host.querySelector<HTMLElement>(".long-document-preview")!
    );
    await settle();
    assertPreview(host, position, "workspace reopen");
    return { focusPreserved: true, reopenPreserved: true };
  } finally {
    app.unmount();
    host.remove();
    style.remove();
    viewportStyle.remove();
  }
}

async function decodeImages(preview: HTMLElement): Promise<void> {
  await Promise.all(
    [...preview.querySelectorAll("img")].map(async (image) => {
      image.loading = "eager";
      await image.decode();
    })
  );
  await settle();
}

function loadedChapterText(root: ParentNode): boolean {
  return [
    ...root.querySelectorAll<HTMLTextAreaElement>(".chapter-visual-text")
  ].some(
    (input) => (input.value.match(/用于检查预览位置保留/g)?.length ?? 0) >= 300
  );
}

function assertPreview(host: HTMLElement, position: number, operation: string) {
  const preview = host.querySelector<HTMLElement>(".long-document-preview");
  if (!preview) throw new Error(`Preview switched to edit after ${operation}`);
  if (Math.abs(preview.scrollTop - position) > 1)
    throw new Error(
      `Preview lost its scroll position after ${operation}: ${preview.scrollTop}`
    );
}

async function settle() {
  await nextTick();
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  );
}

async function until(
  predicate: () => boolean,
  host: HTMLElement,
  label: string
) {
  for (let attempt = 0; attempt < 150; attempt++) {
    await settle();
    if (predicate()) return;
  }
  throw new Error(
    `Preview smoke did not mount ${label}: ${host.textContent?.slice(0, 500)}`
  );
}
