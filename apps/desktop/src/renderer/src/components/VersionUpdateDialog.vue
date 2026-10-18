<script setup lang="ts">
import { computed } from "vue";
import type { UpdateState } from "@deepwrite/contracts";

const props = defineProps<{
  updateState: UpdateState;
  announcedVersion?: string | undefined;
  officialDocsUrl?: string | undefined;
  manualUpdateRequired: boolean;
}>();
const emit = defineEmits<{ close: []; check: []; download: []; install: [] }>();
const updateChecking = computed(() => props.updateState.status === "checking");
const updateDownloading = computed(
  () => props.updateState.status === "downloading"
);
const updateInstalling = computed(
  () => props.updateState.status === "installing"
);
const updateProgressLabel = computed(
  () => `${Math.round(props.updateState.percent ?? 0)}%`
);
function close(): void {
  if (!updateInstalling.value) emit("close");
}
function formatBytes(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return "—";
  if (value < 1024) return `${Math.round(value)} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${(value / 1024 ** 3).toFixed(1)} GB`;
}
</script>

<template>
  <div class="dialog-backdrop" @mousedown.self="close">
    <section
      class="workspace-dialog profile-dialog update-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="version-update-dialog-title"
    >
      <header>
        <div>
          <span class="dialog-eyebrow">DeepWrite</span>
          <h2 id="version-update-dialog-title">版本更新</h2>
        </div>
        <button
          class="dialog-close"
          type="button"
          aria-label="关闭"
          :disabled="updateInstalling"
          @click="close"
        >
          ×
        </button>
      </header>

      <div class="dialog-content update-dialog-content">
        <div class="update-version-summary">
          <div>
            <span>当前版本</span>
            <strong>v{{ updateState.currentVersion }}</strong>
          </div>
          <div v-if="announcedVersion">
            <span>公告最新版本</span>
            <strong>v{{ announcedVersion }}</strong>
          </div>
          <div v-if="updateState.latestVersion">
            <span>更新源版本</span>
            <strong>v{{ updateState.latestVersion }}</strong>
          </div>
          <span v-if="updateState.mandatory" class="update-required-badge"
            >重要更新</span
          >
        </div>

        <div v-if="updateChecking" class="update-checking" aria-live="polite">
          <span class="update-spinner" aria-hidden="true" />
          <span>正在检查更新…</span>
        </div>

        <div
          v-else-if="updateInstalling"
          class="update-checking"
          aria-live="assertive"
        >
          <span class="update-spinner" aria-hidden="true" />
          <span>正在安全退出并准备安装…</span>
        </div>

        <template v-else>
          <div v-if="updateState.title" class="update-release-copy">
            <strong>{{ updateState.title }}</strong>
            <ul v-if="updateState.releaseNotes.length">
              <li v-for="note in updateState.releaseNotes" :key="note">
                {{ note }}
              </li>
            </ul>
          </div>

          <div
            v-if="updateDownloading"
            class="update-progress"
            aria-live="polite"
          >
            <div class="update-progress-heading">
              <span>正在后台下载</span>
              <strong>{{ updateProgressLabel }}</strong>
            </div>
            <div
              class="update-progress-track"
              role="progressbar"
              :aria-valuenow="updateState.percent ?? 0"
            >
              <span :style="{ width: `${updateState.percent ?? 0}%` }" />
            </div>
            <small>
              {{ formatBytes(updateState.transferred) }} /
              {{ formatBytes(updateState.total) }}
              <template v-if="updateState.bytesPerSecond">
                · {{ formatBytes(updateState.bytesPerSecond) }}/s
              </template>
            </small>
          </div>

          <p
            v-if="manualUpdateRequired"
            class="update-status-message"
            role="status"
          >
            {{
              officialDocsUrl
                ? "更新源版本低于公告版本，请从官方文档渠道手动下载更新。"
                : "更新源版本低于公告版本。官方文档链接：没有配置。"
            }}
          </p>
          <p
            v-else-if="updateState.message && updateState.status !== 'error'"
            class="update-status-message"
            :data-status="updateState.status"
          >
            {{ updateState.message }}
          </p>
        </template>

        <div class="dialog-actions">
          <a
            v-if="manualUpdateRequired && officialDocsUrl"
            class="dialog-primary-button"
            :href="officialDocsUrl"
            target="_blank"
            rel="noopener noreferrer"
            >打开官方文档</a
          >
          <button
            v-if="
              manualUpdateRequired ||
              updateState.status === 'error' ||
              updateState.status === 'not-available' ||
              updateState.status === 'unsupported'
            "
            class="dialog-secondary-button"
            type="button"
            :disabled="updateChecking"
            @click="emit('check')"
          >
            重新检查
          </button>
          <button
            v-if="updateState.canDownload && !manualUpdateRequired"
            class="dialog-primary-button"
            type="button"
            @click="emit('download')"
          >
            后台下载更新
          </button>
          <button
            v-else-if="updateState.canInstall && !manualUpdateRequired"
            class="dialog-primary-button"
            type="button"
            @click="emit('install')"
          >
            {{ updateState.status === "error" ? "重试安装" : "重启并安装" }}
          </button>
          <button
            v-else-if="updateInstalling"
            class="dialog-primary-button"
            type="button"
            disabled
          >
            正在安装…
          </button>
          <button
            v-else-if="
              !updateChecking && !updateDownloading && !updateInstalling
            "
            class="dialog-primary-button"
            type="button"
            @click="close"
          >
            关闭
          </button>
        </div>
      </div>
    </section>
  </div>
</template>
