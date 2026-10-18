<script setup lang="ts">
import { watch } from "vue";
import type {
  LinkedMaterialIdsByKind,
  LinkedSkillIdsByKind
} from "@deepwrite/contracts";
import AppIcon from "./AppIcon.vue";
import PopupSelect from "./PopupSelect.vue";
import {
  useBookLibrarySelection,
  type BookLibrarySelectionProps
} from "../composables/useBookLibrarySelection";
const props = defineProps<
  BookLibrarySelectionProps & { loading?: boolean; submitting?: boolean }
>();
const emit = defineEmits<{
  change: [
    value: {
      linkedMaterialIdsByKind: LinkedMaterialIdsByKind;
      linkedSkillIdsByKind: LinkedSkillIdsByKind;
    }
  ];
}>();
const {
  MATERIAL_KINDS,
  SKILL_KINDS,
  materialBindingMode,
  skillBindingMode,
  selectedMaterialGroupId,
  selectedSkillGroupId,
  selectedMaterialIds,
  selectedSkillIds,
  availableMaterialGroups,
  availableSkillGroups,
  selectedMaterialGroup,
  selectedSkillGroup,
  materialById,
  skillById,
  materialKindDescription,
  skillKindDescription,
  materialSelectOptions,
  skillSelectOptions,
  materialGroupOptions,
  skillGroupOptions,
  selectedMaterialLinks,
  selectedSkillLinks
} = useBookLibrarySelection(props);
watch(
  () => [selectedMaterialLinks(), selectedSkillLinks()] as const,
  ([linkedMaterialIdsByKind, linkedSkillIdsByKind]) =>
    emit("change", { linkedMaterialIdsByKind, linkedSkillIdsByKind }),
  { immediate: true, deep: true }
);
</script>
<template>
  <section
    class="create-short-binding-panel"
    aria-labelledby="create-short-skill-heading"
  >
    <div class="create-short-binding-heading">
      <span class="create-short-binding-icon"
        ><AppIcon name="library" :size="17"
      /></span>
      <div>
        <h3 id="create-short-skill-heading">绑定技能库</h3>
        <p>已绑定技能可在所有阶段按需加载。</p>
      </div>
    </div>

    <div
      class="create-short-binding-modes"
      role="radiogroup"
      aria-label="技能库绑定方式"
    >
      <label :class="{ 'is-selected': skillBindingMode === 'single' }">
        <input
          v-model="skillBindingMode"
          type="radio"
          value="single"
          :disabled="submitting"
        />
        按分类选择
      </label>
      <label
        :class="{ 'is-selected': skillBindingMode === 'group' }"
        :title="availableSkillGroups.length ? '' : '暂无可用技能分组'"
      >
        <input
          v-model="skillBindingMode"
          type="radio"
          value="group"
          :disabled="submitting || availableSkillGroups.length === 0"
        />
        选择分组
      </label>
    </div>

    <div v-if="skillBindingMode === 'single'" class="create-short-kind-grid">
      <label
        v-for="kind in SKILL_KINDS"
        :key="kind.id"
        class="create-short-kind-field"
      >
        <span>
          <strong>{{ kind.label }}</strong>
          <small>{{ skillKindDescription(kind) }}</small>
        </span>
        <PopupSelect
          :model-value="selectedSkillIds[kind.id]"
          :options="skillSelectOptions(kind.id)"
          :accessible-label="kind.label"
          size="large"
          :disabled="loading || submitting"
          :menu-min-width="260"
          @update:model-value="selectedSkillIds[kind.id] = String($event)"
        />
      </label>
    </div>
    <div v-else class="create-short-group-picker">
      <label class="create-short-book-field">
        <span>技能分组</span>
        <PopupSelect
          :model-value="selectedSkillGroupId"
          :options="skillGroupOptions"
          accessible-label="技能分组"
          size="large"
          :disabled="loading || submitting"
          :menu-min-width="260"
          @update:model-value="selectedSkillGroupId = String($event)"
        />
      </label>
      <div v-if="selectedSkillGroup" class="create-short-group-members">
        <span v-for="kind in SKILL_KINDS" :key="kind.id">
          <small>{{ kind.label }}</small>
          <strong>
            {{
              skillById.get(selectedSkillGroup.members[kind.id] ?? "")?.title ??
              "未配置"
            }}
          </strong>
        </span>
      </div>
      <p v-else class="create-short-stable-hint">
        选择分组后，会一次绑定其中已配置的各类技能库。
      </p>
    </div>
  </section>

  <section
    class="create-short-binding-panel"
    aria-labelledby="create-short-material-heading"
  >
    <div class="create-short-binding-heading">
      <span class="create-short-binding-icon"
        ><AppIcon name="archive" :size="17"
      /></span>
      <div>
        <h3 id="create-short-material-heading">关联素材库</h3>
        <p>按用途选择素材库；未选择的分类可在创作空间中稍后补充。</p>
      </div>
    </div>

    <div
      class="create-short-binding-modes"
      role="radiogroup"
      aria-label="素材库关联方式"
    >
      <label :class="{ 'is-selected': materialBindingMode === 'single' }">
        <input
          v-model="materialBindingMode"
          type="radio"
          value="single"
          :disabled="submitting"
        />
        按分类选择
      </label>
      <label
        :class="{ 'is-selected': materialBindingMode === 'group' }"
        :title="availableMaterialGroups.length ? '' : '暂无可用素材分组'"
      >
        <input
          v-model="materialBindingMode"
          type="radio"
          value="group"
          :disabled="submitting || availableMaterialGroups.length === 0"
        />
        选择分组
      </label>
    </div>

    <div v-if="materialBindingMode === 'single'" class="create-short-kind-grid">
      <label
        v-for="kind in MATERIAL_KINDS"
        :key="kind.id"
        class="create-short-kind-field"
      >
        <span>
          <strong>{{ kind.label }}</strong>
          <small>{{ materialKindDescription(kind) }}</small>
        </span>
        <PopupSelect
          :model-value="selectedMaterialIds[kind.id]"
          :options="materialSelectOptions(kind.id)"
          :accessible-label="kind.label"
          size="large"
          :disabled="loading || submitting"
          :menu-min-width="260"
          @update:model-value="selectedMaterialIds[kind.id] = String($event)"
        />
      </label>
    </div>
    <div v-else class="create-short-group-picker">
      <label class="create-short-book-field">
        <span>素材分组</span>
        <PopupSelect
          :model-value="selectedMaterialGroupId"
          :options="materialGroupOptions"
          accessible-label="素材分组"
          size="large"
          :disabled="loading || submitting"
          :menu-min-width="260"
          @update:model-value="selectedMaterialGroupId = String($event)"
        />
      </label>
      <div v-if="selectedMaterialGroup" class="create-short-group-members">
        <span v-for="kind in MATERIAL_KINDS" :key="kind.id">
          <small>{{ kind.label }}</small>
          <strong>
            {{
              materialById.get(selectedMaterialGroup.members[kind.id] ?? "")
                ?.title ?? "未配置"
            }}
          </strong>
        </span>
      </div>
      <p v-else class="create-short-stable-hint">
        选择分组后，会一次关联其中已配置的各类素材库。
      </p>
    </div>
  </section>
</template>
