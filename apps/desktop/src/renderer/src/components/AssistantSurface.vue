<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { AssistantConnection } from "@deepwrite/contracts";
import { useAppearance } from "../composables/useAppearance";
import { useSettingsStore } from "../stores/settingsStore";
import { useLayoutStore } from "../stores/layoutStore";
const props = withDefaults(
  defineProps<{ screen?: "assistant" | "models" | "plugins" | "presets" }>(),
  { screen: "assistant" }
);
const frame = ref<
  (HTMLElement & { send(channel: string, value: unknown): void }) | null
>(null);
const connection = ref<AssistantConnection>();
const url = ref("");
const error = ref("");
const loading = ref(true);
const ready = ref(false);
const appearance = useAppearance();
const settings = useSettingsStore();
const layout = useLayoutStore();
let active = true;
let observer: MutationObserver | undefined;
let refreshTimer: ReturnType<typeof setTimeout> | undefined;
let startupTimer: ReturnType<typeof setTimeout> | undefined;
function sync() {
  if (!connection.value || !frame.value) return;
  const css = getComputedStyle(document.body);
  const size = parseFloat(
    css.getPropertyValue("--ui-font-size") || css.fontSize
  );
  frame.value.send("metaverse-assistant:config", {
    source: "metaverse-host",
    nonce: connection.value.nonce,
    screen: props.screen,
    language:
      settings.generalSettings.language === "auto" &&
      navigator.language.startsWith("en")
        ? "en"
        : "zh",
    appearance: {
      scheme: appearance.resolvedScheme.value,
      font: css.fontFamily,
      fontSize: Number.isFinite(size) ? size : 14,
      codeFontSize: parseFloat(css.getPropertyValue("--code-font-size")) || 13,
      palette: Object.fromEntries(
        Object.entries({
          "--dsw-alias-bg-base": "--surface-main",
          "--dsw-alias-bg-layer-1": "--surface-panel",
          "--dsw-alias-bg-layer-2": "--surface-hover",
          "--dsw-alias-bg-overlay": "--surface-panel",
          "--dsw-alias-border-l1": "--theme-line",
          "--dsw-alias-border-l2": "--theme-line",
          "--dsw-alias-label-primary": "--text-primary",
          "--dsw-alias-label-secondary": "--text-secondary",
          "--dsw-specific-sidebar-fill": "--surface-panel"
        }).map(([key, value]) => [key, css.getPropertyValue(value).trim()])
      )
    }
  });
}
async function start(restart = false) {
  clearTimeout(startupTimer);
  url.value = "";
  loading.value = true;
  ready.value = false;
  error.value = "";
  try {
    const api = window.deepwrite?.assistant;
    if (!api) throw new Error("万能助手需要在元宇宙桌面应用中使用。");
    const result = await (restart ? api.restart() : api.start());
    if (!active) return;
    connection.value = result;
    const address = new URL(result.url);
    address.hash = new URLSearchParams({
      metaverse: result.nonce,
      parent: location.origin,
      workspace: result.workspace
    }).toString();
    url.value = address.href;
  } catch (cause) {
    if (active) {
      error.value = cause instanceof Error ? cause.message : "智能体启动失败。";
      loading.value = false;
    }
  }
}
function receive(event: Event) {
  const ipc = event as Event & { channel: string; args: unknown[] };
  if (ipc.channel !== "metaverse-assistant:event") return;
  const data = ipc.args[0] as
    | {
        source?: string;
        nonce?: string;
        type?: string;
        requestId?: string;
        message?: string;
        screen?: string;
      }
    | undefined;
  const current = connection.value;
  if (
    !current ||
    data?.source !== "metaverse-harness" ||
    data?.nonce !== current.nonce
  )
    return;
  if (data.type === "ready") {
    clearTimeout(startupTimer);
    error.value = "";
    loading.value = false;
    ready.value = true;
    sync();
  } else if (data.type === "list-tools" && typeof data.requestId === "string") {
    const requestId = data.requestId;
    const toolLibrary = window.deepwrite?.toolLibrary;
    if (!toolLibrary) return;
    void toolLibrary
      .list()
      .then((result) => {
        if (
          !active ||
          !frame.value ||
          connection.value?.nonce !== current.nonce
        )
          return;
        frame.value.send("metaverse-assistant:config", {
          source: "metaverse-host",
          nonce: current.nonce,
          type: "tools-result",
          requestId,
          tools: result.tools
            .filter((tool) => !tool.error)
            .map(({ id, name, description, directory, entryFile }) => ({
              id,
              name,
              description,
              directory,
              entryFile
            }))
        });
      })
      .catch((cause) => {
        if (
          !active ||
          !frame.value ||
          connection.value?.nonce !== current.nonce
        )
          return;
        frame.value.send("metaverse-assistant:config", {
          source: "metaverse-host",
          nonce: current.nonce,
          type: "tools-result",
          requestId,
          error: cause instanceof Error ? cause.message : "读取工具失败。"
        });
      });
  } else if (data.type === "error") {
    error.value =
      typeof data.message === "string" ? data.message : "智能体发生错误。";
    loading.value = false;
  } else if (data.type === "open-configuration") {
    void window.deepwrite?.assistant?.openConfiguration().catch((cause) => {
      error.value =
        cause instanceof Error ? cause.message : "打开配置文件失败。";
    });
  } else if (data.type === "navigate" && data.screen === "assistant") {
    layout.showWorkspaceFeature("assistant");
  }
}
function onLoad() {
  sync();
  clearTimeout(startupTimer);
  startupTimer = setTimeout(() => {
    if (!ready.value && active) fail("智能体界面加载超时，请重新启动智能体。");
  }, 45_000);
}
function fail(message = "智能体界面加载失败，请重新启动智能体。") {
  if (!active) return;
  error.value = message;
  loading.value = false;
}
onMounted(() => {
  observer = new MutationObserver(() => {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(sync, 30);
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["style", "class", "data-theme"]
  });
  void start();
});
watch(() => props.screen, sync);
watch(() => settings.generalSettings.language, sync);
watch(appearance.resolvedScheme, sync);
onBeforeUnmount(() => {
  active = false;
  observer?.disconnect();
  if (refreshTimer) clearTimeout(refreshTimer);
  clearTimeout(startupTimer);
});
</script>
<template>
  <section
    class="assistant-surface"
    :aria-label="screen === 'assistant' ? '万能助手' : '智能体配置'"
  >
    <div v-if="loading" class="assistant-status" role="status">
      正在准备智能体…
    </div>
    <div v-if="error" class="assistant-error" role="alert">
      <p>{{ error }}</p>
      <button type="button" @click="start(true)">重新启动智能体</button>
    </div>
    <webview
      v-if="url"
      ref="frame"
      :src="url"
      title="元宇宙万能助手"
      partition="persist:metaverse-assistant"
      class="assistant-frame"
      :class="{ 'is-loading': !ready }"
      @dom-ready="onLoad"
      @ipc-message="receive"
      @did-fail-load="fail()"
      @render-process-gone="fail()"
    />
  </section>
</template>
<style scoped>
.assistant-surface {
  position: relative;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--surface-main);
}
.assistant-frame {
  display: flex;
  width: 100%;
  height: 100%;
  border: 0;
}
.assistant-frame.is-loading {
  visibility: hidden;
}
.assistant-status {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: var(--text-secondary);
}
.assistant-error {
  position: absolute;
  z-index: 2;
  inset: 16px;
  padding: 22px;
  max-height: 85%;
  overflow: auto;
  background: var(--surface-main);
  border: 1px solid var(--theme-line);
  border-radius: 12px;
  color: var(--text-primary);
}
.assistant-error p {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.assistant-error button {
  padding: 9px 14px;
  color: var(--text-primary);
  background: var(--surface-hover);
  border: 1px solid var(--theme-line);
  border-radius: 8px;
  cursor: pointer;
}
</style>
