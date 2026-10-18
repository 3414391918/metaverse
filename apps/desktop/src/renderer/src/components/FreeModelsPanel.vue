<script setup lang="ts">
import { computed } from "vue";
import type {
  ModelConfig,
  ModelConfigInput,
  ModelSettings
} from "@deepwrite/contracts";
import AppIcon from "./AppIcon.vue";
import { freeModelStatus, isFreeModelAvailable } from "./freeModelPresentation";
import { toModelInput } from "./modelSettingsDraft";

const props = defineProps<{
  settings: ModelSettings | null;
  refreshing: boolean;
  saving: boolean;
  testingModelId: string | null;
}>();

const emit = defineEmits<{
  refresh: [];
  setModelEnabled: [payload: { modelId: string; enabled: boolean }];
  test: [model: ModelConfigInput];
}>();

const currentModels = computed(() => props.settings?.deepwriteFreeModels ?? []);
const currentModelIds = computed(
  () => new Set(currentModels.value.map((model) => model.id))
);
const deprecatedModels = computed(() =>
  (props.settings?.deepwriteFreeDeprecatedModels ?? []).filter(
    (model) => !currentModelIds.value.has(model.id)
  )
);
const enabledModelIds = computed(
  () => new Set(props.settings?.deepwriteFreeEnabledModelIds ?? [])
);

function toggleModel(model: ModelConfig, event: Event): void {
  emit("setModelEnabled", {
    modelId: model.id,
    enabled: (event.target as HTMLInputElement).checked
  });
}

function testModel(model: ModelConfig): void {
  emit("test", toModelInput(model));
}
</script>

<template>
  <section class="free-models-panel" aria-labelledby="free-models-title">
    <header class="free-models-header">
      <div>
        <span class="free-models-kicker">
          <AppIcon name="model" :size="15" /> DeepWrite 免费模型
        </span>
        <h2 id="free-models-title">免费模型</h2>
        <p>
          选择要在模型配置和各模型选择器中显示的免费模型。需要更新目录时请点击“刷新列表”，新加入的模型默认关闭。
        </p>
      </div>
      <button
        class="free-models-refresh"
        type="button"
        :disabled="refreshing || saving"
        @click="emit('refresh')"
      >
        <AppIcon name="history" :size="15" />
        {{ refreshing ? "刷新中…" : "刷新列表" }}
      </button>
    </header>

    <p v-if="settings?.deepwriteFreeMessage" class="free-models-message">
      {{ settings.deepwriteFreeMessage }}
    </p>

    <div v-if="refreshing && !settings" class="free-models-empty">
      正在拉取免费模型…
    </div>
    <template v-else>
      <section class="free-models-group" aria-labelledby="current-free-models">
        <header>
          <div>
            <span>当前目录</span>
            <h3 id="current-free-models">可配置模型</h3>
          </div>
          <span>{{ currentModels.length }} 个模型</span>
        </header>

        <div v-if="currentModels.length" class="free-models-list">
          <article
            v-for="model in currentModels"
            :key="model.id"
            class="free-model-card"
            :class="{ 'is-unavailable': !isFreeModelAvailable(model) }"
          >
            <span class="free-model-logo">{{
              model.label.slice(0, 1).toUpperCase()
            }}</span>
            <div class="free-model-details">
              <div class="free-model-title-row">
                <strong>{{ model.label }}</strong>
                <span
                  class="free-model-status"
                  :class="{ 'is-available': isFreeModelAvailable(model) }"
                >
                  {{ freeModelStatus(model) }}
                </span>
              </div>
              <small>{{ model.provider }} · {{ model.modelId }}</small>
              <small>{{ model.api }} · {{ model.id }}</small>
            </div>
            <div class="free-model-actions">
              <button
                v-if="isFreeModelAvailable(model)"
                class="free-model-test"
                type="button"
                :disabled="saving || refreshing || testingModelId !== null"
                :aria-label="`测试 ${model.label} 联通情况`"
                @click="testModel(model)"
              >
                {{ testingModelId === model.id ? "测试中…" : "测试联通" }}
              </button>
              <label class="free-model-toggle">
                <input
                  type="checkbox"
                  :checked="enabledModelIds.has(model.id)"
                  :disabled="
                    saving || refreshing || !isFreeModelAvailable(model)
                  "
                  :aria-label="`${enabledModelIds.has(model.id) ? '停用' : '启用'} ${model.label}`"
                  @change="toggleModel(model, $event)"
                />
                <span aria-hidden="true" />
              </label>
            </div>
          </article>
        </div>
        <p v-else class="free-models-empty">当前没有可配置的免费模型。</p>
      </section>

      <section
        v-if="deprecatedModels.length"
        class="free-models-group is-deprecated"
        aria-labelledby="deprecated-free-models"
      >
        <header>
          <div>
            <span>历史记录</span>
            <h3 id="deprecated-free-models">已废弃模型</h3>
          </div>
          <span>{{ deprecatedModels.length }} 个模型</span>
        </header>
        <div class="free-models-list">
          <article
            v-for="model in deprecatedModels"
            :key="model.id"
            class="free-model-card is-unavailable"
          >
            <span class="free-model-logo">{{
              model.label.slice(0, 1).toUpperCase()
            }}</span>
            <div class="free-model-details">
              <div class="free-model-title-row">
                <strong>{{ model.label }}</strong>
                <span class="free-model-status is-deprecated">已废弃</span>
              </div>
              <small>{{ model.provider }} · {{ model.modelId }}</small>
              <small>{{ model.api }} · {{ model.id }}</small>
            </div>
            <label class="free-model-toggle" title="已废弃模型不可启用">
              <input
                type="checkbox"
                disabled
                :aria-label="`${model.label} 已废弃`"
              />
              <span aria-hidden="true" />
            </label>
          </article>
        </div>
      </section>
    </template>
  </section>
</template>

<style scoped src="./free-models-panel.css"></style>
