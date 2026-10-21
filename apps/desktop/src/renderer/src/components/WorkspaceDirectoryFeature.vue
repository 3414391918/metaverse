<script setup lang="ts">
import AppIcon from "./AppIcon.vue";

defineProps<{
  path: string | null;
  loading: boolean;
}>();

const emit = defineEmits<{
  choose: [];
}>();
</script>

<template>
  <section class="settings-group directory-settings">
    <h2 class="directory-settings-title">存储位置</h2>
    <div class="directory-settings-card">
      <AppIcon name="directory" :size="20" />
      <div class="directory-settings-details">
        <strong>{{ path ? "当前工作目录" : "尚未选择工作目录" }}</strong>
        <code>{{ path ?? "首次创建或导入时也会提示选择" }}</code>
      </div>
      <button type="button" :disabled="loading" @click="emit('choose')">
        {{ loading ? "选择中…" : path ? "切换目录" : "选择目录" }}
      </button>
    </div>
    <p class="directory-settings-note">
      这里决定以后新建和导入项目的默认位置。切换目录不会移动或影响已经打开的书籍、素材库和技能库。
    </p>
    <p class="directory-settings-note">
      新书和旧版导入保存在 books，新素材库保存在 materials，新技能库保存在
      skills。项目仍采用 deepwrite.json 与 Markdown 文件结构，可由 Git
      或同步盘管理。
    </p>
  </section>
</template>

<style scoped>
.directory-settings {
  max-width: 760px;
}

.directory-settings-title {
  margin: 0 0 14px;
  font-size: 1.07143rem;
  font-weight: 640;
}

.directory-settings-card {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
  padding: 18px;
  border: 1px solid var(--theme-line-soft);
  border-radius: 13px;
  background: var(--surface-raised);
}

.directory-settings-details {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}

.directory-settings-details strong {
  font-size: 1rem;
  font-weight: 590;
}

.directory-settings-details code {
  overflow-wrap: anywhere;
  color: var(--text-secondary);
  font-family: var(--code-font);
  font-size: var(--code-font-size);
}

.directory-settings-card button {
  flex: 0 0 auto;
  padding: 8px 12px;
  border: 1px solid var(--theme-line);
  border-radius: 8px;
  background: var(--surface-main);
  color: var(--text-primary);
  cursor: pointer;
}

.directory-settings-card button:hover:not(:disabled) {
  background: var(--surface-hover);
}

.directory-settings-card button:disabled {
  opacity: 0.55;
  cursor: wait;
}

.directory-settings-note {
  margin: 14px 0 0;
  color: var(--text-secondary);
  font-size: 0.892857rem;
  line-height: 1.6;
}

@media (max-width: 760px) {
  .directory-settings-card {
    flex-wrap: wrap;
  }

  .directory-settings-card button {
    margin-left: 34px;
  }
}
</style>
