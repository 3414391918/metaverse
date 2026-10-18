import { createApp, h, nextTick, reactive, type App } from "vue";
import CharacterCoreProfile from "./CharacterCoreProfile.vue";
import { uiMessageItems } from "../../ui-feedback";

let live: {
  app: App;
  host: HTMLElement;
  style: HTMLLinkElement;
  props: { bookId: string; characterId: string; locked: boolean };
} | null = null;

async function until(test: () => boolean, label: string) {
  const deadline = Date.now() + 8000;
  while (!test()) {
    const error = uiMessageItems.value.find((item) => item.kind === "error");
    if (error) throw new Error(`Appearance smoke ${label}: ${error.content}`);
    if (Date.now() > deadline)
      throw new Error(
        `Appearance smoke timed out: ${label}. ${live?.host.textContent}`
      );
    await new Promise((resolve) => setTimeout(resolve, 20));
    await nextTick();
  }
}
function clickText(root: ParentNode, label: string) {
  const button = [...root.querySelectorAll<HTMLButtonElement>("button")].find(
    (item) => item.textContent?.trim() === label
  );
  if (!button) throw new Error(`Appearance smoke button missing: ${label}`);
  button.click();
}
async function select(label: string, optionText: string) {
  const trigger = document.querySelector<HTMLButtonElement>(
    `button[aria-label="${label}"]`
  );
  if (!trigger || trigger.disabled)
    throw new Error(`Appearance smoke select unavailable: ${label}`);
  trigger.click();
  await until(
    () =>
      Boolean(
        document.querySelector(`.popup-select-menu[aria-label="${label}"]`)
      ),
    label
  );
  const menu = document.querySelector(
    `.popup-select-menu[aria-label="${label}"]`
  )!;
  const option = [
    ...menu.querySelectorAll<HTMLElement>('[role="option"]')
  ].find((item) => item.textContent?.includes(optionText));
  if (!option)
    throw new Error(`Appearance smoke option missing: ${optionText}`);
  option.click();
  await nextTick();
}

/** Actual SFC and real Preload commands, only imported into a temporary smoke bundle. */
export async function runCharacterAppearanceRendererSmoke(input: {
  bookId: string;
  characterId: string;
}) {
  const api = window.deepwrite?.long;
  if (!api) throw new Error("Appearance smoke API unavailable");
  const host = document.createElement("div");
  host.style.cssText =
    "position:fixed;inset:0;z-index:2000;overflow:auto;background:var(--surface-main)";
  document.body.append(host);
  const style = document.createElement("link");
  style.rel = "stylesheet";
  style.href = new URL(
    /* @vite-ignore */ "./chapter-image.smoke.css",
    import.meta.url
  ).href;
  await new Promise<void>((resolve, reject) => {
    style.onload = () => resolve();
    style.onerror = () => reject(new Error("Appearance smoke styles failed"));
    document.head.append(style);
  });
  const props = reactive({ ...input, locked: false });
  const app = createApp({ render: () => h(CharacterCoreProfile, props) });
  app.config.errorHandler = (error) => {
    host.textContent = `Vue error: ${String(error)}`;
  };
  live = { app, host, style, props };
  app.mount(host);
  await until(
    () => Boolean(host.querySelector('input[aria-label="角色名称"]')),
    "initial profile"
  );
  // Cancelling before confirmation must not create a shape.
  const original = await api.readCharacterProfile(input);
  clickText(host, "＋ 新增形象");
  await until(
    () => Boolean(document.querySelector("[data-appearance-mode]")),
    "mode dialog"
  );
  if (document.querySelector('input[aria-label="新形象名称"]'))
    throw new Error("Fields shown before choosing mode");
  clickText(document.querySelector('[role="dialog"]')!, "取消");
  await nextTick();
  if (
    (await api.readCharacterProfile(input)).profile.appearances.length !==
    original.profile.appearances.length
  )
    throw new Error("Cancel created an appearance");
  clickText(host, "＋ 新增形象");
  await until(
    () => Boolean(document.querySelector("[data-appearance-mode]")),
    "new dialog"
  );
  document
    .querySelector<HTMLButtonElement>('[data-appearance-mode="replace"]')!
    .click();
  await until(
    () =>
      Boolean(
        document.querySelector<HTMLButtonElement>(
          'button[aria-label="选择参考角色"]'
        )?.disabled === false
      ),
    "loaded references"
  );
  await select("选择参考角色", "参考角色");
  await select("选择参考形象", "常服（2 张）");
  const name = document.querySelector<HTMLInputElement>(
    'input[aria-label="新形象名称"]'
  )!;
  name.value = "雨夜新形象";
  name.dispatchEvent(new Event("input", { bubbles: true }));
  await nextTick();
  clickText(document.querySelector('[role="dialog"]')!, "确认并生成提示词");
  await until(
    () =>
      Boolean(
        document.querySelector('textarea[aria-label="新形象制作提示词"]')
      ),
    "saved prompt"
  );
  const prompt = document.querySelector<HTMLTextAreaElement>(
    'textarea[aria-label="新形象制作提示词"]'
  )!.value;
  const saved = await api.readCharacterProfile(input);
  const appearance = saved.profile.appearances.find(
    (item) => item.name === "雨夜新形象"
  );
  if (
    !appearance ||
    !prompt.includes(appearance.id) ||
    !prompt.includes("共 2 张") ||
    prompt.includes("多余形象专用图")
  )
    throw new Error("Saved prompt has wrong target or reference images");
  clickText(document.querySelector('[role="dialog"]')!, "复制提示词");
  await new Promise((resolve) => setTimeout(resolve, 100));
  clickText(document.querySelector('[role="dialog"]')!, "关闭");
  await nextTick();
  return { appearanceId: appearance.id, prompt, cancelled: true };
}

export async function finishCharacterAppearanceRendererSmoke() {
  if (!live) throw new Error("Appearance smoke editor missing");
  window.dispatchEvent(new Event("focus"));
  await until(
    () =>
      Boolean(
        live?.host
          .querySelector<HTMLTextAreaElement>(
            'textarea[aria-label="形象文本描述"]'
          )
          ?.value.includes("外部生成的服装描述")
      ),
    "external description refresh"
  );
  await until(
    () =>
      Boolean(
        live?.host.querySelector<HTMLImageElement>(
          '.asset-grid img[alt="新图标签"]'
        )
      ),
    "external image metadata refresh"
  );
  const image = live.host.querySelector<HTMLImageElement>(
    '.asset-grid img[alt="新图标签"]'
  )!;
  image.loading = "eager";
  image.scrollIntoView();
  await image.decode();
  if (!image.naturalWidth) throw new Error("External asset did not render");
  clickText(live.host, "复制绝对路径");
  await until(
    () =>
      uiMessageItems.value.some(
        (item) => item.content === "当前形象资产目录的绝对路径已复制"
      ),
    "copy absolute assets path"
  );
  const storage = await window.deepwrite!.long.getCharacterAppearanceReferences(
    {
      bookId: live.props.bookId,
      characterId: live.props.characterId
    }
  );
  const appearance = storage.characters
    .find((item) => item.characterId === live!.props.characterId)
    ?.appearances.find((item) => item.name === "雨夜新形象");
  if (
    !appearance?.assetsDirectory ||
    appearance.assetsDirectory === storage.target.assetsDirectory
  )
    throw new Error("Copied appearance still shares its character directory");
  await image.decode();

  return {
    refreshed: true,
    rendered: true,
    copiedAssetsDirectory: appearance.assetsDirectory
  };
}

export async function runCharacterAppearanceDeletionSmoke() {
  if (!live) throw new Error("Appearance smoke editor missing");
  const api = window.deepwrite!.long;
  const input = {
    bookId: live.props.bookId,
    characterId: live.props.characterId
  };
  const before = await api.readCharacterProfile(input);
  clickText(live.host, "删除形象");
  await until(
    () =>
      document
        .querySelector('[role="dialog"]')
        ?.textContent?.includes("不进入回收站") === true,
    "deletion confirmation"
  );
  live.props.locked = true;
  await nextTick();
  const confirm = [
    ...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')
  ].find((b) => b.textContent?.trim() === "确认永久删除")!;
  if (!confirm.disabled) throw new Error("Locked profile permits deletion");
  live.props.locked = false;
  await nextTick();
  clickText(document.querySelector('[role="dialog"]')!, "取消");
  await nextTick();
  if (
    JSON.stringify(await api.readCharacterProfile(input)) !==
    JSON.stringify(before)
  )
    throw new Error("Delete cancellation changed files");
  let retained = false;
  for (let index = 0; index < before.profile.appearances.length; index++) {
    clickText(live.host, "删除形象");
    await until(
      () => Boolean(document.querySelector('[role="dialog"]')),
      "reopened delete confirmation"
    );
    await until(
      () =>
        [
          ...document.querySelectorAll<HTMLButtonElement>(
            '[role="dialog"] button'
          )
        ].some((b) => b.textContent?.trim() === "确认永久删除" && !b.disabled),
      "enabled delete confirmation"
    );
    clickText(document.querySelector('[role="dialog"]')!, "确认永久删除");
    await until(
      () => !document.querySelector('[role="dialog"]'),
      "delete completed"
    );
    const next = await api.readCharacterProfile(input);
    if (index === 0)
      retained =
        next.assets.length === 1 &&
        next.assets[0]?.id === before.assets[0]?.id &&
        next.profile.appearances.length === 2;
  }
  if (!retained) throw new Error("Deleting a shape removed other appearances");
  const after = await api.readCharacterProfile(input);
  if (
    after.profile.appearances.length ||
    after.assets.length ||
    after.profile.settingDescription !== before.profile.settingDescription
  )
    throw new Error("Deletion did not persist or removed base fields");
  const disabled = [
    ...live.host.querySelectorAll<HTMLButtonElement>("button")
  ].find((b) => b.textContent?.trim() === "删除形象");
  if (!disabled?.disabled)
    throw new Error("Delete remains enabled with no appearance");
  cleanupCharacterAppearanceSmoke();
  return {
    deleted: true,
    deleteCancelled: true,
    lockedDeletionBlocked: true,
    retainedOtherAppearance: true
  };
}

export function cleanupCharacterAppearanceSmoke() {
  live?.app.unmount();
  live?.host.remove();
  live?.style.remove();
  live = null;
}
