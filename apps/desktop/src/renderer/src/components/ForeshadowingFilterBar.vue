<script setup lang="ts">
import AppIcon from "./AppIcon.vue";
import PopupSelect, { type PopupSelectValue } from "./PopupSelect.vue";
import {
  lifecycleFilterOptions,
  lifecycleLabels,
  spanFilterOptions,
  spanLabels,
  type FilterValue,
  type SpanFilterValue
} from "../composables/useForeshadowingFilters";

defineProps<{
  query: string;
  lifecycleFilter: FilterValue;
  spanFilter: SpanFilterValue;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  "update:query": [value: string];
  "update:lifecycleFilter": [value: FilterValue];
  "update:spanFilter": [value: SpanFilterValue];
}>();

function setLifecycleFilter(value: PopupSelectValue): void {
  if (
    value === "all" ||
    Object.prototype.hasOwnProperty.call(lifecycleLabels, value)
  ) {
    emit("update:lifecycleFilter", value as FilterValue);
  }
}

function setSpanFilter(value: PopupSelectValue): void {
  if (
    value === "all" ||
    Object.prototype.hasOwnProperty.call(spanLabels, value)
  ) {
    emit("update:spanFilter", value as SpanFilterValue);
  }
}

function setQuery(event: Event): void {
  if (event.target instanceof HTMLInputElement) {
    emit("update:query", event.target.value);
  }
}
</script>

<template>
  <div class="overview-filters">
    <label class="search-field">
      <AppIcon name="search" :size="15" />
      <input
        :value="query"
        @input="setQuery"
        type="search"
        autocomplete="off"
        placeholder="搜索名称、问题、真相或触点"
        aria-label="搜索伏笔"
      />
    </label>
    <PopupSelect
      :model-value="lifecycleFilter"
      :options="lifecycleFilterOptions"
      accessible-label="按生命周期筛选伏笔"
      variant="compact"
      size="small"
      :disabled="disabled"
      @update:model-value="setLifecycleFilter"
    />
    <PopupSelect
      :model-value="spanFilter"
      :options="spanFilterOptions"
      accessible-label="按跨度筛选伏笔"
      variant="compact"
      size="small"
      :disabled="disabled"
      @update:model-value="setSpanFilter"
    />
  </div>
</template>

<style scoped>
.overview-filters {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 7px;
}

.search-field {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  min-width: 9rem;
  height: 32px;
  gap: 7px;
  padding: 0 9px;
  border: 1px solid var(--theme-line);
  border-radius: 8px;
  background: var(--surface-main);
  color: var(--text-tertiary);
}

.search-field:focus-within {
  border-color: color-mix(in srgb, var(--accent) 55%, var(--theme-line));
  box-shadow: 0 0 0 2px var(--accent-soft);
}

.search-field input {
  flex: 1 1 auto;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text-primary);
  font: inherit;
  font-size: 0.75rem;
}

.search-field input::placeholder {
  color: var(--text-tertiary);
}

@container (max-width: 38rem) {
  .overview-filters {
    flex-wrap: wrap;
  }

  .search-field {
    flex-basis: 100%;
  }
}
</style>
