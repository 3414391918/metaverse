import { createApp, h, nextTick } from "vue";
import ToolManager from "./ToolManager.vue";

/** Real editor + Preload + filesystem, only mounted in the disposable smoke profile. */
export async function runToolManagerRendererSmoke() {
  const api = window.deepwrite?.toolLibrary;
  if (!api) throw new Error("Tool library API missing");
  const before = await api.list();
  for (const id of ["creation", "creation-context", "workspace"])
    if (!before.tools.some((item) => item.id === id))
      throw new Error(`Default tool missing: ${id}`);
  if (document.querySelector(".conversation-pane"))
    throw new Error("Retired conversation UI remains mounted");
  const host = document.createElement("div");
  document.body.append(host);
  const application = createApp({ render: () => h(ToolManager) });
  const wait = async (predicate: () => boolean) => {
    const deadline = Date.now() + 10000;
    while (!predicate()) {
      if (Date.now() > deadline) throw new Error("Tool editor smoke timed out");
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
      throw new Error(`Tool button unavailable: ${label}`);
    return found;
  };
  const editor = () =>
    host.querySelector<HTMLTextAreaElement>(".tool-code-panel textarea")!;
  const current = (id: string) =>
    host.querySelector(".tool-detail-heading h2")?.textContent ===
      before.tools.find((item) => item.id === id)?.name && !editor()?.disabled;
  const dialog = () =>
    document.querySelector<HTMLElement>(".character-dialog")!;
  const edit = (
    input: HTMLInputElement | HTMLTextAreaElement,
    value: string
  ) => {
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };
  let createdId: string | undefined;
  try {
    application.mount(host);
    await wait(() => Boolean(host.querySelector(".tool-card:not(:disabled)")));
    const creation = [
      ...host.querySelectorAll<HTMLButtonElement>(".tool-card")
    ].find((item) => item.querySelector("strong")?.textContent === "创作工具")!;
    creation.click();
    await wait(() => Boolean(current("creation")));
    const original = await api.read({ toolId: "creation", path: "SKILL.md" });
    edit(editor(), original.content + "\n界面保存验收。\n");
    await nextTick();
    button("保存").click();
    await wait(
      () =>
        !editor().disabled &&
        host.querySelector(".tool-file-toolbar small")?.textContent === "已保存"
    );
    if (
      !(
        await api.read({ toolId: "creation", path: "SKILL.md" })
      ).content.endsWith("界面保存验收。\n")
    )
      throw new Error("Tool save did not persist");
    button("创作上下文工具 →").click();
    await wait(() => Boolean(current("creation-context")));
    button("创作空间工具 →").click();
    await wait(() => Boolean(current("workspace")));
    button("← 返回上一工具").click();
    await wait(() => Boolean(current("creation-context")));
    button("← 返回上一工具").click();
    await wait(() => Boolean(current("creation")));
    button("← 返回工具列表").click();
    await wait(() => Boolean(host.querySelector(".tool-card:not(:disabled)")));
    button("＋ 新增工具").click();
    await wait(() => Boolean(dialog()));
    edit(dialog().querySelector<HTMLInputElement>("input")!, "工具界面验收");
    edit(dialog().querySelector<HTMLTextAreaElement>("textarea")!, "独立工具");
    await nextTick();
    button("创建工具", dialog()).click();
    await wait(
      () =>
        host.querySelector(".tool-detail-heading h2")?.textContent ===
          "工具界面验收" &&
        !editor()?.disabled &&
        !dialog()
    );
    createdId = (await api.list()).tools.find(
      ({ name }) => name === "工具界面验收"
    )!.id;
    button("＋", host.querySelector(".tool-files")!).click();
    await wait(() => Boolean(dialog()));
    edit(
      dialog().querySelector<HTMLInputElement>("input")!,
      "scripts/check.mjs"
    );
    await nextTick();
    button("创建文件", dialog()).click();
    await wait(
      () =>
        host
          .querySelector(".tool-file-toolbar span")
          ?.textContent?.includes("scripts/check.mjs") === true &&
        !editor()?.disabled &&
        !dialog()
    );
    edit(editor(), 'console.log("editable");\n');
    await nextTick();
    button("保存").click();
    await wait(
      () =>
        !editor().disabled &&
        host.querySelector(".tool-file-toolbar small")?.textContent === "已保存"
    );
    if (
      (await api.read({ toolId: createdId, path: "scripts/check.mjs" }))
        .content !== 'console.log("editable");\n'
    )
      throw new Error("Script save failed");
    button("编辑", host.querySelector(".tool-relations")!).click();
    await wait(() => Boolean(dialog()));
    const choice = [...dialog().querySelectorAll("label")]
      .find((item) => item.textContent?.trim() === "创作空间工具")!
      .querySelector<HTMLInputElement>("input")!;
    choice.click();
    await wait(
      () =>
        !choice.disabled &&
        Boolean(
          host
            .querySelector(".tool-relations")
            ?.textContent?.includes("创作空间工具")
        )
    );
    button("关闭弹窗", dialog()).click();
    await wait(() => !dialog());
    if (
      !(await api.list()).tools
        .find(({ id }) => id === createdId)
        ?.relatedToolIds.includes("workspace")
    )
      throw new Error("Relation save failed");
    button("删除工具").click();
    await wait(() => Boolean(dialog()));
    if (!(await api.list()).tools.some(({ id }) => id === createdId))
      throw new Error("Tool deleted before confirmation");
    button("确认删除", dialog()).click();
    await wait(
      () =>
        !dialog() && Boolean(host.querySelector(".tool-card:not(:disabled)"))
    );
    if ((await api.list()).tools.some(({ id }) => id === createdId))
      throw new Error("Tool deletion failed");
    return {
      status: "ok",
      save: true,
      linkedNavigation: true,
      scriptEdit: true,
      relations: true,
      confirmedDelete: true
    };
  } finally {
    application.unmount();
    host.remove();
    if (
      createdId &&
      (await api.list()).tools.some(({ id }) => id === createdId)
    )
      await api.delete(createdId);
  }
}
