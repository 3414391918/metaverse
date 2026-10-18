<script setup lang="ts">
withDefaults(
  defineProps<{
    discarding?: boolean;
  }>(),
  {
    discarding: false
  }
);

const emit = defineEmits<{
  discard: [];
}>();
</script>

<template>
  <button
    class="approval-target-button approval-discard-button"
    type="button"
    title="舍弃本次修改"
    aria-label="舍弃本次修改"
    :disabled="discarding"
    @click.stop="emit('discard')"
  >
    {{ discarding ? "舍弃中…" : "舍弃本次修改" }}
  </button>
</template>
