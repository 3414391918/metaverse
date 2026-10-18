<script setup lang="ts">
import { onMounted, ref } from "vue";
import type { FishAudioCatalogItem } from "@deepwrite/contracts";
import { uiMessage } from "../ui-feedback";
import { fishAudioPageUrl } from "./fishAudioPageUrl";

const records = ref<FishAudioCatalogItem[]>([]);
const busy = ref(false);
const loadError = ref("");
const deleteTarget = ref<FishAudioCatalogItem | null>(null);

async function load() {
  busy.value = true;
  loadError.value = "";
  try {
    records.value = (await window.deepwrite!.fishAudio.execute({
      action: "catalog.list"
    })) as FishAudioCatalogItem[];
  } catch (error) {
    loadError.value =
      error instanceof Error ? error.message : "读取声音管理失败";
    uiMessage.error(loadError.value);
  } finally {
    busy.value = false;
  }
}
onMounted(() => void load());

async function remove() {
  const target = deleteTarget.value;
  if (!target || busy.value) return;
  busy.value = true;
  try {
    await window.deepwrite!.fishAudio.execute({
      action: "record.delete",
      kind: target.kind,
      id: target.id
    });
    records.value = records.value.filter(
      (item) => item.id !== target.id || item.kind !== target.kind
    );
    deleteTarget.value = null;
    uiMessage.success("已从 FishAudio 删除");
  } catch (error) {
    uiMessage.error(error instanceof Error ? error.message : "删除失败");
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <main class="fish-manager">
    <header>
      <div>
        <h1>声音管理</h1>
      </div>
      <button type="button" :disabled="busy" @click="load">重新读取</button>
    </header>
    <section v-if="!records.length" class="fish-manager-empty">
      {{ busy ? "正在读取…" : loadError || "FishAudio 平台上还没有声音" }}
    </section>
    <div v-else class="fish-manager-groups">
      <section class="fish-manager-group">
        <div class="fish-manager-group-heading">
          <h2>声音</h2>
          <span class="fish-manager-count">{{ records.length }}</span>
        </div>
        <div class="fish-manager-grid">
          <article
            v-for="record in records"
            :key="record.id"
            class="fish-manager-card"
          >
            <div class="fish-manager-card-content">
              <strong :title="record.title">{{ record.title }}</strong>
              <small v-if="record.createdAt">{{
                new Date(record.createdAt).toLocaleString()
              }}</small>
            </div>
            <div class="fish-manager-card-actions">
              <a
                :href="fishAudioPageUrl(record)"
                target="_blank"
                rel="noopener noreferrer"
                >查看</a
              >
              <button type="button" @click="deleteTarget = record">删除</button>
            </div>
          </article>
        </div>
      </section>
    </div>
    <div
      v-if="deleteTarget"
      class="fish-overlay"
      role="presentation"
      @click.self="deleteTarget = null"
    >
      <section
        class="fish-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-label="确认删除"
      >
        <header>
          <h2>确认删除“{{ deleteTarget.title }}”？</h2>
        </header>
        <p>这会删除 FishAudio 上的声音，无法撤销。</p>
        <footer>
          <button type="button" :disabled="busy" @click="deleteTarget = null">
            取消</button
          ><button type="button" :disabled="busy" @click="remove">
            确认删除
          </button>
        </footer>
      </section>
    </div>
  </main>
</template>

<style scoped src="./fish-audio.css"></style>
<style scoped>
.fish-manager {
  width: 100%;
  height: 100%;
  overflow: auto;
  padding: 48px clamp(24px, 5vw, 72px) 72px;
  background: var(--surface-main);
  color: var(--text-primary);
}
.fish-manager > header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  max-width: 1160px;
}
.fish-manager h1 {
  margin: 0;
  font-size: 32px;
  line-height: 1.2;
}
.fish-manager h2 {
  margin: 0;
  font-size: 20px;
  line-height: 1.3;
}
.fish-manager p,
.fish-manager small,
.fish-manager span {
  color: var(--text-secondary);
}
.fish-manager button {
  padding: 9px 14px;
  border: 1px solid var(--theme-line);
  border-radius: 9px;
  background: var(--surface-raised);
  color: inherit;
  cursor: pointer;
}
.fish-manager button:focus-visible,
.fish-manager a:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.fish-manager-groups {
  max-width: 1160px;
  display: grid;
  gap: 48px;
  margin-top: 52px;
}
.fish-manager-group-heading {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
}
.fish-manager-count {
  min-width: 24px;
  padding: 2px 7px;
  border-radius: 999px;
  background: var(--surface-muted);
  text-align: center;
  font-size: 12px;
  line-height: 20px;
}
.fish-manager-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 285px), 1fr));
  gap: 16px;
}
.fish-manager-card {
  min-width: 0;
  min-height: 156px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 24px;
  padding: 20px;
  border: 1px solid var(--theme-line-soft);
  border-radius: 14px;
  background: var(--surface-raised);
  transition:
    border-color 160ms ease,
    background-color 160ms ease;
}
.fish-manager-card:hover {
  border-color: var(--theme-line);
  background: var(--surface-muted);
}
.fish-manager-card-content {
  min-width: 0;
  display: grid;
  gap: 8px;
}
.fish-manager-card-content strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 17px;
  line-height: 1.4;
}
.fish-manager-card-content small {
  font-size: 12px;
}
.fish-manager-card-actions {
  display: flex;
  gap: 10px;
}
.fish-manager-card-actions a,
.fish-manager-card-actions button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 72px;
  padding: 8px 14px;
  border: 1px solid var(--theme-line);
  border-radius: 9px;
  background: var(--surface-main);
  color: var(--text-primary);
  font: inherit;
  text-decoration: none;
  cursor: pointer;
}
.fish-manager-card-actions a:hover,
.fish-manager-card-actions button:hover {
  border-color: var(--accent);
  background: var(--surface-selected);
}
.fish-manager-empty {
  max-width: 1160px;
  margin-top: 52px;
  color: var(--text-secondary);
}
</style>
