<script setup lang="ts">
import { computed, ref, shallowRef } from "vue";
import { createId } from "@deepwrite/shared";
import type {
  FishAudioCommandPayload,
  FishAudioFile
} from "@deepwrite/contracts";
import { uiMessage } from "../../ui-feedback";
import FishAudioProgress from "./FishAudioProgress.vue";
import { useFishAudioProgress } from "./useFishAudioProgress";

const props = defineProps<{
  bookId: string;
  characterId: string;
  characterName: string;
}>();
const emit = defineEmits<{ close: [] }>();
const title = ref(props.characterName + "的声音");
const files = ref<FishAudioFile[]>([]);
const busy = ref(false);
const completed = ref(false);
const taskController = shallowRef<AbortController | null>(null);
let activeOperationId = "";
let cancelRequested = false;
const progress = useFishAudioProgress();
const progressNodes = progress.nodes;
const input = ref<HTMLInputElement | null>(null);
const totalSeconds = computed(() =>
  files.value.reduce((sum, file) => sum + file.durationSeconds, 0)
);

function closeDialog() {
  if (!busy.value) emit("close");
}

function startTask(): AbortSignal {
  taskController.value = new AbortController();
  cancelRequested = false;
  busy.value = true;
  return taskController.value.signal;
}

function finishTask() {
  taskController.value = null;
  busy.value = false;
}

function cancelTask() {
  if (!busy.value || !taskController.value || cancelRequested) return;
  cancelRequested = true;
  progress.cancel();
  if (activeOperationId) {
    const operationId = activeOperationId;
    void window
      .deepwrite!.fishAudio.execute({ action: "operation.cancel", operationId })
      .then((result) => {
        if ((result as { cancelled: boolean }).cancelled) return;
        cancelRequested = false;
        if (!busy.value) return;
        progress.start(
          "platform.connect",
          "连接 FishAudio",
          "正在等待平台结果"
        );
        uiMessage.error("平台任务当前无法取消，请查看执行结果。");
      })
      .catch((error: unknown) => {
        cancelRequested = false;
        if (!busy.value) return;
        progress.start(
          "platform.connect",
          "连接 FishAudio",
          "取消失败，任务仍在执行"
        );
        uiMessage.error(
          error instanceof Error ? error.message : "取消任务失败"
        );
      });
    return;
  }
  taskController.value.abort();
}

async function executeWithProgress(
  payload: Extract<FishAudioCommandPayload, { action: "voice.create" }>,
  signal: AbortSignal
) {
  if (signal.aborted) throw new DOMException("任务已取消", "AbortError");
  const operationId = createId("fish_audio_operation");
  activeOperationId = operationId;
  progress.start("platform.connect", "连接 FishAudio", "正在提交任务");
  const unsubscribe = window.deepwrite!.events.subscribe((event) => {
    if (
      !cancelRequested &&
      event.type === "fishAudio.progress" &&
      event.payload.operationId === operationId
    ) {
      progress.complete("platform.connect", "平台已接收任务");
      progress.acceptPlatform(operationId, event.payload);
    }
  });
  try {
    await window.deepwrite!.fishAudio.execute({ ...payload, operationId });
    if (!cancelRequested)
      progress.complete("platform.connect", "平台已接收任务");
  } finally {
    activeOperationId = "";
    unsubscribe();
  }
}

function showFailure(error: unknown, fallback: string) {
  if (progressNodes.value.at(-1)?.status !== "error") progress.fail(error);
  uiMessage.error(error instanceof Error ? error.message : fallback);
}

function duration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const audio = document.createElement("audio");
    const done = (value?: number) => {
      audio.removeAttribute("src");
      audio.load();
      URL.revokeObjectURL(url);
      if (value && Number.isFinite(value)) resolve(value);
      else reject(new Error(`无法读取音频时长：${file.name}`));
    };
    audio.onloadedmetadata = () => done(audio.duration);
    audio.onerror = () => done();
    audio.src = url;
  });
}

function asBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",", 2)[1] ?? "");
    reader.onerror = () => reject(new Error(`无法读取音频：${file.name}`));
    reader.readAsDataURL(file);
  });
}

async function addFiles(event: Event) {
  const selected = Array.from((event.target as HTMLInputElement).files ?? []);
  (event.target as HTMLInputElement).value = "";
  if (selected.length + files.value.length > 20) {
    uiMessage.error("最多添加 20 段音频");
    return;
  }
  busy.value = true;
  try {
    for (const file of selected) {
      const extension = file.name.split(".").pop()?.toLowerCase();
      if (!extension || !["wav", "mp3", "m4a", "opus"].includes(extension))
        throw new Error("仅支持 WAV、MP3、M4A、Opus 音频");
      const seconds = await duration(file);
      if (totalSeconds.value + seconds > 120)
        throw new Error("音频总时长不能超过 120 秒");
      if (
        files.value.reduce((n, f) => n + f.base64.length * 0.75, 0) +
          file.size >
        20 * 1024 * 1024
      )
        throw new Error("音频总大小不能超过 20 MB");
      files.value.push({
        name: file.name,
        mimeType:
          file.type ||
          (
            {
              wav: "audio/wav",
              mp3: "audio/mpeg",
              m4a: "audio/mp4",
              opus: "audio/opus"
            } as Record<string, string>
          )[extension]!,
        durationSeconds: seconds,
        base64: await asBase64(file)
      });
    }
  } catch (error) {
    uiMessage.error(error instanceof Error ? error.message : "添加音频失败");
  } finally {
    busy.value = false;
  }
}

async function createVoice() {
  if (!title.value.trim() || !files.value.length) return;
  progress.clear();
  const signal = startTask();
  try {
    progress.start(
      "prepare",
      "准备声音资料",
      `已选择 ${files.value.length} 段音频，共 ${totalSeconds.value.toFixed(1)} 秒`
    );
    progress.complete("prepare");
    await executeWithProgress(
      {
        action: "voice.create",
        bookId: props.bookId,
        characterId: props.characterId,
        characterName: props.characterName,
        title: title.value.trim(),
        mode: "clone",
        files: files.value
      },
      signal
    );
    if (signal.aborted) return;
    completed.value = true;
    uiMessage.success("声音已创建，已在浏览器中打开");
  } catch (error) {
    if (cancelRequested) progress.cancel();
    else showFailure(error, "创建声音失败");
  } finally {
    finishTask();
  }
}
</script>

<template>
  <div class="fish-overlay" role="presentation" @click.self="closeDialog">
    <section
      class="fish-dialog"
      role="dialog"
      aria-modal="true"
      aria-label="创建声音"
    >
      <header>
        <h2>创建声音</h2>
        <button type="button" :disabled="busy" @click="closeDialog">×</button>
      </header>
      <label
        >声音名称<input v-model="title" maxlength="120" :disabled="busy"
      /></label>
      <p>上传 1～20 段音频，合计不超过 120 秒、20 MB。</p>
      <input
        ref="input"
        type="file"
        accept=".wav,.mp3,.m4a,.opus,audio/*"
        multiple
        hidden
        @change="addFiles"
      />
      <button type="button" :disabled="busy" @click="input?.click()">
        上传音频
      </button>
      <ul class="fish-file-list">
        <li v-for="(file, index) in files" :key="index">
          {{ file.name }} · {{ file.durationSeconds.toFixed(1) }} 秒
          <button
            type="button"
            :disabled="busy"
            @click="files.splice(index, 1)"
          >
            删除
          </button>
        </li>
      </ul>
      <p>合计 {{ totalSeconds.toFixed(1) }} / 120 秒</p>
      <FishAudioProgress :nodes="progressNodes" />
      <footer>
        <button
          type="button"
          :disabled="busy && !taskController"
          @click="busy ? cancelTask() : closeDialog()"
        >
          {{
            busy && taskController ? "取消任务" : completed ? "完成" : "取消"
          }}</button
        ><button
          type="button"
          :disabled="busy || completed || !files.length"
          @click="createVoice"
        >
          {{ completed ? "已创建" : busy ? "处理中…" : "创建声音" }}
        </button>
      </footer>
    </section>
  </div>
</template>

<style scoped src="../../components/fish-audio.css"></style>
