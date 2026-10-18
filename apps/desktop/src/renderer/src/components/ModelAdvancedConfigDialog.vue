<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import {
  DEFAULT_CUSTOM_MODEL_CONTEXT_WINDOW,
  DEFAULT_CUSTOM_MODEL_MAX_TOKENS,
  MODEL_CONTEXT_WINDOW_MAX,
  MODEL_CONTEXT_WINDOW_MIN,
  MODEL_MAX_TOKENS_MAX,
  MODEL_MAX_TOKENS_MIN
} from "@deepwrite/contracts/renderer";
import { uiMessage } from "../ui-feedback";
import { toModelInput, type DraftModel } from "./modelSettingsDraft";

const props = defineProps<{
  model: DraftModel | null;
  busy: boolean;
}>();

const emit = defineEmits<{
  close: [];
  save: [capacity: { contextWindow: number; maxTokens: number }];
}>();

const firstInput = ref<HTMLInputElement | null>(null);
const contextWindowText = ref("");
const maxTokensText = ref("");
const resolving = ref(false);
let resolveSequence = 0;

function hasCapacity(
  model: DraftModel
): model is DraftModel & { contextWindow: number; maxTokens: number } {
  return model.contextWindow !== undefined && model.maxTokens !== undefined;
}

function hasCustomCapacity(
  model: DraftModel
): model is DraftModel & { contextWindow: number; maxTokens: number } {
  return (
    hasCapacity(model) &&
    (model.contextWindow !== DEFAULT_CUSTOM_MODEL_CONTEXT_WINDOW ||
      model.maxTokens !== DEFAULT_CUSTOM_MODEL_MAX_TOKENS)
  );
}

function hydrate(contextWindow: number, maxTokens: number): void {
  contextWindowText.value = String(contextWindow);
  maxTokensText.value = String(maxTokens);
}

function commandErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error) || !error.message.trim()) return fallback;
  const separator = error.message.indexOf(": ");
  return separator >= 0 ? error.message.slice(separator + 2) : error.message;
}

async function fillFromRuntime(model: DraftModel): Promise<void> {
  const sequence = ++resolveSequence;
  resolving.value = true;
  contextWindowText.value = "";
  maxTokensText.value = "";
  if (!window.deepwrite) {
    resolving.value = false;
    uiMessage.error("当前环境无法读取模型实际请求容量。");
    return;
  }
  try {
    const result = await window.deepwrite.models.resolveCapacity(
      toModelInput({
        ...model,
        contextWindow: undefined,
        maxTokens: undefined
      })
    );
    if (sequence !== resolveSequence || !props.model) return;
    hydrate(result.contextWindow, result.maxTokens);
    void nextTick(() => firstInput.value?.focus());
  } catch (error: unknown) {
    if (sequence !== resolveSequence) return;
    uiMessage.error(commandErrorMessage(error, "读取模型实际请求容量失败。"));
  } finally {
    if (sequence === resolveSequence) resolving.value = false;
  }
}

watch(
  () => props.model,
  (model) => {
    resolveSequence += 1;
    resolving.value = false;
    if (!model) {
      contextWindowText.value = "";
      maxTokensText.value = "";
      return;
    }
    if (hasCustomCapacity(model)) {
      hydrate(model.contextWindow, model.maxTokens);
      void nextTick(() => firstInput.value?.focus());
      return;
    }
    void fillFromRuntime(model);
  },
  { immediate: true }
);

function close(): void {
  if (!props.busy) emit("close");
}

function parseTokenCount(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/u.test(trimmed)) return null;
  const value = Number.parseInt(trimmed, 10);
  return Number.isInteger(value) ? value : null;
}

function save(): void {
  if (props.busy || resolving.value || !props.model) return;
  const contextWindow = parseTokenCount(contextWindowText.value);
  const maxTokens = parseTokenCount(maxTokensText.value);
  if (
    contextWindow === null ||
    contextWindow < MODEL_CONTEXT_WINDOW_MIN ||
    contextWindow > MODEL_CONTEXT_WINDOW_MAX
  ) {
    uiMessage.warning(
      `请填写 ${MODEL_CONTEXT_WINDOW_MIN} 到 ${MODEL_CONTEXT_WINDOW_MAX} 之间的上下文长度。`
    );
    return;
  }
  if (
    maxTokens === null ||
    maxTokens < MODEL_MAX_TOKENS_MIN ||
    maxTokens > MODEL_MAX_TOKENS_MAX
  ) {
    uiMessage.warning(
      `请填写 ${MODEL_MAX_TOKENS_MIN} 到 ${MODEL_MAX_TOKENS_MAX} 之间的最高输出长度。`
    );
    return;
  }
  if (maxTokens > contextWindow) {
    uiMessage.warning("最高输出长度不能超过上下文长度。");
    return;
  }
  emit("save", { contextWindow, maxTokens });
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="model"
      class="dialog-backdrop model-fetch-hint-overlay"
      @mousedown.self="close"
      @keydown.esc.stop="close"
    >
      <section
        class="model-fetch-hint-dialog model-advanced-config-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="model-advanced-config-title"
        tabindex="-1"
        @keydown.esc.stop="close"
      >
        <header>
          <div>
            <span class="dialog-eyebrow">模型配置</span>
            <h2 id="model-advanced-config-title">高级配置</h2>
          </div>
        </header>
        <p>
          为「{{
            model.label
          }}」设置请求容量。默认值与当前实际请求一致，保存后按修改值传输。
        </p>
        <div class="model-advanced-config-fields">
          <label>
            <span>上下文长度</span>
            <input
              ref="firstInput"
              v-model="contextWindowText"
              type="text"
              inputmode="numeric"
              :disabled="resolving"
              :placeholder="resolving ? '正在读取实际请求容量…' : ''"
              aria-label="上下文长度"
            />
            <small>一次请求可容纳的总 token 数，含输入与输出。</small>
          </label>
          <label>
            <span>最高输出长度</span>
            <input
              v-model="maxTokensText"
              type="text"
              inputmode="numeric"
              :disabled="resolving"
              :placeholder="resolving ? '正在读取实际请求容量…' : ''"
              aria-label="最高输出长度"
            />
            <small>单次回复允许生成的最大 token 数。</small>
          </label>
        </div>
        <footer class="dialog-actions">
          <button
            class="dialog-secondary-button"
            type="button"
            :disabled="busy"
            @click="close"
          >
            取消
          </button>
          <button
            class="dialog-primary-button"
            type="button"
            :disabled="busy || resolving"
            @click="save"
          >
            {{ busy ? "保存中…" : "保存" }}
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.model-advanced-config-fields {
  display: grid;
  gap: 12px;
  padding: 14px 18px 0;
}

.model-advanced-config-fields label {
  display: grid;
  gap: 5px;
  color: var(--text-secondary);
  font-size: 0.678571rem;
}

.model-advanced-config-fields input {
  width: 100%;
  height: 34px;
  padding: 0 9px;
  border: 1px solid var(--theme-line);
  border-radius: 7px;
  outline: 0;
  background: var(--surface-main);
  color: var(--text-primary);
  font-size: 0.785714rem;
  font-variant-numeric: tabular-nums;
}

.model-advanced-config-fields input:focus {
  border-color: color-mix(in srgb, var(--accent) 28%, var(--theme-line));
}

.model-advanced-config-fields small {
  color: var(--text-tertiary);
  font-size: 0.642857rem;
  line-height: 1.5;
}
</style>
