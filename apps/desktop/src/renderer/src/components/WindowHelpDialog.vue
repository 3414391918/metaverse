<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
const emit = defineEmits<{ close: [] }>();
const close = ref<HTMLButtonElement | null>(null);
let previous: HTMLElement | null = null;
onMounted(() => {
  previous = document.activeElement as HTMLElement | null;
  close.value?.focus();
});
onBeforeUnmount(() => {
  previous?.focus();
});
</script>
<template>
  <Teleport to="body">
    <div class="dialog-backdrop" @mousedown.self="emit('close')">
      <section
        class="dialog-card window-help"
        role="dialog"
        aria-modal="true"
        aria-labelledby="window-help-title"
        @keydown.esc.stop="emit('close')"
        @keydown.tab.prevent="close?.focus()"
      >
        <div class="dialog-header">
          <h2 id="window-help-title">关于 DeepWrite</h2>
        </div>
        <div class="dialog-content">
          <p>DeepWrite 是本地作品与智能体协作的写作工作台。</p>
          <p>
            从“文件”新建或打开作品，在目录中选择写作内容。作品、素材和技能继续使用现有的本地保存流程。
          </p>
          <p>
            从“视图”切换分栏，或打开外观设置，选择浅色、深色、跟随系统及自定义主题。
          </p>
          <p>
            按 F10 聚焦菜单；方向键选择，Enter 确认，Escape 关闭。按 F11
            进入或退出全屏。
          </p>
          <p>
            关闭窗口遵循常规设置：启用托盘时隐藏窗口；“文件 → 退出
            DeepWrite”执行完整保存与退出流程。
          </p>
        </div>
        <div class="dialog-footer">
          <button
            ref="close"
            class="primary-button"
            type="button"
            @click="emit('close')"
          >
            关闭
          </button>
        </div>
      </section>
    </div>
  </Teleport>
</template>
