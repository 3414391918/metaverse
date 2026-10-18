<script setup lang="ts">
defineProps<{
  label: string;
  modelValue: string;
  savedValue: string;
  disabled?: boolean;
  singleLine?: boolean;
  rows?: number;
}>();
const emit = defineEmits<{ "update:modelValue": [value: string]; save: [] }>();
function update(event: Event) {
  emit("update:modelValue", (event.target as HTMLInputElement).value);
}
</script>
<template>
  <section class="character-field">
    <div class="character-field-heading">
      <strong>{{ label }}</strong
      ><span v-if="modelValue !== savedValue" class="character-dirty"
        >未保存</span
      >
      <button
        type="button"
        class="character-save"
        :disabled="disabled || modelValue === savedValue"
        :aria-label="`保存${label}`"
        @click="emit('save')"
      >
        保存
      </button>
    </div>
    <input
      v-if="singleLine"
      :value="modelValue"
      :aria-label="label"
      :disabled="disabled"
      autocomplete="off"
      @input="update"
    />
    <textarea
      v-else
      :value="modelValue"
      :aria-label="label"
      :disabled="disabled"
      :rows="rows ?? 5"
      spellcheck="false"
      @input="update"
    />
  </section>
</template>
