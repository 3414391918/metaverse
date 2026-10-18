import { createApp, h, nextTick } from "vue";
import { uiMessageItems } from "../ui-feedback";
import PromptTemplateManager from "./PromptTemplateManager.vue";

/** Mounted only by the disposable Electron smoke profile. */
export async function runPromptTemplateRendererSmoke() {
  const api = window.deepwrite?.promptTemplates;
  if (!api) throw new Error("Prompt template Preload API unavailable");
  const before = await api.list();
  const host = document.createElement("div");
  document.body.append(host);
  const application = createApp({ render: () => h(PromptTemplateManager) });
  const name = "模板界面验收";
  const content = "检查人物状态与当前章剧情。";
  const pngBase64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/vV8AAAAASUVORK5CYII=";
  const wait = async (predicate: () => boolean) => {
    const deadline = Date.now() + 5_000;
    while (!predicate()) {
      if (Date.now() > deadline)
        throw new Error("Prompt template UI smoke timed out");
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    await nextTick();
  };
  const button = (label: string, root: ParentNode = host) => {
    const found = [...root.querySelectorAll<HTMLButtonElement>("button")].find(
      (item) =>
        item.textContent?.trim() === label ||
        item.getAttribute("aria-label") === label
    );
    if (!found || found.disabled)
      throw new Error(`Template button unavailable: ${label}`);
    return found;
  };
  const dialog = () =>
    document.querySelector<HTMLElement>(".prompt-template-dialog")!;
  const setField = (selector: string, value: string) => {
    const input = dialog().querySelector<
      HTMLInputElement | HTMLTextAreaElement
    >(selector)!;
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };
  try {
    application.mount(host);
    await wait(() => {
      const add = host.querySelector<HTMLButtonElement>(".page-heading button");
      return Boolean(add && !add.disabled);
    });
    button("＋ 新增模板").click();
    await wait(() => Boolean(dialog()));
    setField("input", name);
    setField("textarea", content);
    const bytes = Uint8Array.from(atob(pngBase64), (value) =>
      value.charCodeAt(0)
    );
    const clipboard = new DataTransfer();
    clipboard.items.add(
      new File([bytes], "template.png", { type: "image/png" })
    );
    dialog().dispatchEvent(
      new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: clipboard
      })
    );
    await wait(() =>
      Boolean(dialog().querySelector(".template-image-open img"))
    );
    dialog().querySelector<HTMLButtonElement>(".template-image-open")!.click();
    await wait(() => Boolean(document.querySelector(".character-dialog")));
    const viewer = () =>
      document.querySelector<HTMLElement>(".character-dialog")!;
    button("放大图片", viewer()).click();
    await nextTick();
    if (!viewer().textContent?.includes("125%"))
      throw new Error("Template image zoom failed");
    button("适合窗口", viewer()).click();
    button("复制图片", viewer()).click();
    await wait(() =>
      uiMessageItems.value.some(({ content }) => content.includes("复制"))
    );
    const copyMessage = uiMessageItems.value.find(({ content }) =>
      content.includes("复制")
    );
    if (copyMessage?.kind !== "success")
      throw new Error(`Template image copy failed: ${copyMessage?.content}`);
    const copied = await window.deepwrite?.long.readClipboardImage();
    if (!copied?.pngDataUrl.startsWith("data:image/png;base64,"))
      throw new Error("Template image copy failed");
    button("关闭弹窗", viewer()).click();
    await wait(() => !document.querySelector(".character-dialog"));
    button("保存模板", dialog()).click();
    await wait(() => !dialog());
    const saved = (await api.list()).find((item) => item.name === name);
    if (saved?.content !== content) throw new Error("Template save failed");
    const card = [
      ...host.querySelectorAll<HTMLButtonElement>(".template-card")
    ].find((item) => item.textContent?.includes(name));
    if (!card) throw new Error("Saved template was not displayed");
    card.click();
    await wait(() => Boolean(dialog()));
    if (
      dialog().querySelector<HTMLTextAreaElement>("textarea")!.value !== content
    )
      throw new Error("Template did not survive reopening");
    await wait(() =>
      Boolean(dialog().querySelector(".template-image-open img"))
    );
    dialog().querySelector<HTMLButtonElement>(".template-image-open")!.click();
    await wait(() => Boolean(document.querySelector(".character-dialog")));
    button("关闭弹窗", viewer()).click();
    await wait(() => !document.querySelector(".character-dialog"));
    button("删除模板", dialog()).click();
    await wait(() => !dialog());
    if (JSON.stringify(await api.list()) !== JSON.stringify(before))
      throw new Error("Template deletion damaged other templates");
    return {
      status: "ok",
      create: true,
      save: true,
      reopen: true,
      imagePreview: true,
      delete: true
    };
  } finally {
    application.unmount();
    host.remove();
    for (const template of (await api.list()).filter(
      (item) => item.name === name
    ))
      await api.delete(template.id);
  }
}
