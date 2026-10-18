<script setup lang="ts">
import { onMounted, ref } from "vue";
import { uiMessage } from "../ui-feedback";

const apiKey = ref("");
const hasApiKey = ref(false);
const busy = ref(false);

async function load() {
  try {
    const result = (await window.deepwrite!.fishAudio.execute({
      action: "settings.get"
    })) as { hasApiKey: boolean };
    hasApiKey.value = result.hasApiKey;
  } catch (error) {
    uiMessage.error(
      error instanceof Error ? error.message : "读取 FishAudio 设置失败"
    );
  }
}

async function save() {
  if (!apiKey.value.trim()) return;
  busy.value = true;
  try {
    await window.deepwrite!.fishAudio.execute({
      action: "settings.save",
      apiKey: apiKey.value.trim()
    });
    apiKey.value = "";
    hasApiKey.value = true;
    uiMessage.success("FishAudio API Key 已保存");
  } catch (error) {
    uiMessage.error(error instanceof Error ? error.message : "保存失败");
  } finally {
    busy.value = false;
  }
}

async function clear() {
  busy.value = true;
  try {
    await window.deepwrite!.fishAudio.execute({ action: "settings.clear" });
    hasApiKey.value = false;
    apiKey.value = "";
    uiMessage.success("FishAudio API Key 已移除");
  } catch (error) {
    uiMessage.error(error instanceof Error ? error.message : "移除失败");
  } finally {
    busy.value = false;
  }
}

onMounted(() => void load());
</script>

<template>
  <section class="settings-group fish-audio-settings">
    <div class="settings-card">
      <h2>FishAudio</h2>
      <p>用于应用内的声音克隆。密钥仅保存在本机的系统加密存储中。</p>
      <p>{{ hasApiKey ? "已配置 API Key" : "尚未配置 API Key" }}</p>
      <label for="fish-audio-api-key">API Key</label>
      <input
        id="fish-audio-api-key"
        v-model="apiKey"
        type="password"
        autocomplete="off"
        placeholder="粘贴 FishAudio API Key"
      />
      <div class="fish-audio-settings-actions">
        <button type="button" :disabled="busy || !apiKey.trim()" @click="save">
          保存密钥
        </button>
        <button type="button" :disabled="busy || !hasApiKey" @click="clear">
          移除密钥
        </button>
        <a
          href="https://fish.audio/app/api-keys/"
          target="_blank"
          rel="noopener noreferrer"
          >获取 API Key ↗</a
        >
      </div>
    </div>
  </section>
</template>

<style scoped>
.fish-audio-settings .settings-card {
  display: grid;
  gap: 14px;
}
.fish-audio-settings h2 {
  margin: 0;
}
.fish-audio-settings p {
  margin: 0;
  color: var(--text-secondary);
}
.fish-audio-settings input {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid var(--theme-line);
  border-radius: 10px;
  background: var(--surface-main);
  color: inherit;
}
.fish-audio-settings-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.fish-audio-settings-actions button {
  padding: 9px 14px;
  border-radius: 9px;
  border: 1px solid var(--theme-line);
  background: var(--surface-muted);
  color: inherit;
  cursor: pointer;
}
.fish-audio-settings-actions button:disabled {
  opacity: 0.5;
  cursor: default;
}
.fish-audio-settings-actions a {
  color: var(--accent);
}
</style>
