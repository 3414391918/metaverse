<script setup lang="ts">
import { onBeforeUnmount, onMounted } from "vue";
import { usePromptTemplates } from "../composables/usePromptTemplates";
import { uiMessage } from "../ui-feedback";
import PromptTemplateDialog from "./PromptTemplateDialog.vue";

const model = usePromptTemplates({
  api: () => window.deepwrite?.promptTemplates,
  error: uiMessage.error,
  warning: uiMessage.warning,
  success: uiMessage.success
});
const { templates, draft, previews, busy, loaded, existing } = model;
const refresh = () => void model.load();
onMounted(() => {
  refresh();
  window.addEventListener("focus", refresh);
});
onBeforeUnmount(() => {
  window.removeEventListener("focus", refresh);
  model.dispose();
});
</script>

<template>
  <section class="prompt-template-page">
    <header class="page-heading">
      <div>
        <p>工作目录</p>
        <h1>提示词模板</h1>
        <span>保存常用提示词和参考图片，随当前工作目录一起迁移。</span>
      </div>
      <button
        type="button"
        class="dialog-primary-button"
        :disabled="busy || !loaded"
        @click="model.open()"
      >
        ＋ 新增模板
      </button>
    </header>

    <div v-if="!loaded" class="template-empty">
      <p>{{ busy ? "正在读取模板…" : "模板尚未加载。" }}</p>
      <button v-if="!busy" type="button" @click="refresh">重新读取</button>
    </div>
    <div v-else-if="!templates.length" class="template-empty">
      <h2>还没有模板</h2>
      <p>点击“新增模板”，保存提示词与需要参考的图片。</p>
    </div>
    <div v-else class="template-grid" aria-label="提示词模板列表">
      <button
        v-for="template in templates"
        :key="template.id"
        type="button"
        class="template-card"
        :disabled="busy"
        @click="model.open(template)"
      >
        <strong>{{ template.name }}</strong>
        <span class="template-excerpt">{{ template.content }}</span>
        <small>{{ template.imageIds?.length ?? 0 }} 张图片</small>
      </button>
    </div>

    <PromptTemplateDialog
      v-if="draft"
      :draft="draft"
      :previews="previews"
      :busy="busy"
      :existing="existing"
      @close="model.close"
      @save="model.save"
      @delete="model.remove"
      @update-name="draft.name = $event"
      @update-content="draft.content = $event"
      @add-image="model.addImage"
      @remove-image="model.removeImage"
    />
  </section>
</template>

<style scoped>
.prompt-template-page {
  width: min(1160px, 100%);
  margin: 0 auto;
  padding: clamp(28px, 5vw, 64px);
  box-sizing: border-box;
  color: var(--text-primary);
}
.page-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 36px;
}
.page-heading p {
  margin: 0 0 10px;
  color: var(--text-tertiary);
  font-size: 0.857143rem;
}
.page-heading h1 {
  margin: 0 0 10px;
  font-size: clamp(1.8rem, 3vw, 2.4rem);
}
.page-heading span,
.template-empty p {
  color: var(--text-secondary);
}
.page-heading button {
  flex: none;
}
.template-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}
.template-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-height: 165px;
  padding: 20px;
  border: 1px solid var(--theme-line);
  border-radius: 14px;
  background: var(--surface-raised);
  color: var(--text-primary);
  text-align: left;
  cursor: pointer;
}
.template-card:hover {
  border-color: var(--accent);
  background: var(--surface-hover);
}
.template-card strong {
  font-size: 1.071429rem;
}
.template-excerpt {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  overflow: hidden;
  margin-top: 12px;
  line-height: 1.55;
  color: var(--text-secondary);
  overflow-wrap: anywhere;
}
.template-card small {
  margin-top: auto;
  padding-top: 18px;
  color: var(--text-tertiary);
}
.template-empty {
  padding: 52px 24px;
  border: 1px dashed var(--theme-line);
  border-radius: 14px;
  text-align: center;
}
.template-empty h2 {
  margin: 0;
}
.template-empty button {
  color: var(--text-primary);
}
@media (max-width: 720px) {
  .page-heading {
    flex-wrap: wrap;
  }
}
</style>
