<script setup lang="ts">
import { computed } from "vue";
import { LONG_AGENTS_MD_MAX_CHARACTERS } from "@deepwrite/contracts/renderer";
const props = defineProps<{
  modelValue: string;
  characterCount: number;
  locked: boolean;
  pending: boolean;
  dirty: boolean;
  overLimit: boolean;
  saving: boolean;
}>();
const emit = defineEmits<{ "update:modelValue": [value: string]; save: [] }>();
const draft = computed({
  get: () => props.modelValue,
  set: (value) => emit("update:modelValue", value)
});
</script>

<template>
  <div
    id="long-structure-panel-content-agents"
    class="structure-panel-content agents-panel-content"
    role="tabpanel"
    aria-labelledby="long-structure-panel-agents"
  >
    <section class="agents-context-card">
      <div class="section-heading">
        <div>
          <h3>主智能体上下文</h3>
          <p>
            介绍世界观、人物、剧情点、正文和持续性账本五个阶段的作用。
            对话时会注入给主智能体；内容保存在本书目录的 AGENTS.md。
          </p>
        </div>
        <span
          >{{ characterCount }} / {{ LONG_AGENTS_MD_MAX_CHARACTERS }} 字符</span
        >
      </div>
      <textarea
        v-model="draft"
        :disabled="locked || pending"
        spellcheck="false"
        aria-label="主智能体上下文"
        placeholder="介绍五个阶段各自负责什么…"
      />
      <footer class="agents-context-actions">
        <button
          class="primary-button"
          type="button"
          :disabled="locked || pending || !dirty || overLimit"
          @click="emit('save')"
        >
          {{ saving ? "保存中…" : "保存" }}
        </button>
      </footer>
    </section>
  </div>
</template>
<style scoped src="./LongStructureControls.css"></style>
<style scoped src="./LongAgentsMdEditor.css"></style>
