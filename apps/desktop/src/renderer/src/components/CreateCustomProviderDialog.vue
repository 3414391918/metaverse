<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  close: [];
  submit: [name: string];
}>();

const nameDraft = ref("");
const nameInput = ref<HTMLInputElement | null>(null);

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    nameDraft.value = "";
    void nextTick(() => nameInput.value?.focus());
  }
);

function requestClose(): void {
  emit("close");
}

function submit(): void {
  emit("submit", nameDraft.value);
}

function handleKeydown(event: KeyboardEvent): void {
  if (props.open && event.key === "Escape") requestClose();
}

onMounted(() => document.addEventListener("keydown", handleKeydown));
onBeforeUnmount(() => document.removeEventListener("keydown", handleKeydown));
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="dialog-backdrop" @mousedown.self="requestClose">
      <section
        class="workspace-dialog book-resource-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-custom-provider-title"
      >
        <header>
          <div>
            <span class="dialog-eyebrow">模型配置</span>
            <h2 id="create-custom-provider-title">新建提供商</h2>
          </div>
          <button
            class="dialog-close"
            type="button"
            aria-label="关闭"
            @click="requestClose"
          >
            ×
          </button>
        </header>

        <form class="dialog-content" @submit.prevent="submit">
          <label class="book-resource-name-field">
            <span>名称</span>
            <input
              ref="nameInput"
              v-model="nameDraft"
              type="text"
              maxlength="120"
              autocomplete="off"
              aria-label="提供商名称"
              placeholder="例如：硅基流动"
            />
          </label>
          <p class="book-resource-help">
            名称用于设置页分组和再次选择，API 类型与地址仍按每个模型填写。
          </p>

          <div class="dialog-actions">
            <button
              class="dialog-secondary-button"
              type="button"
              @click="requestClose"
            >
              取消
            </button>
            <button class="dialog-primary-button" type="submit">创建</button>
          </div>
        </form>
      </section>
    </div>
  </Teleport>
</template>
