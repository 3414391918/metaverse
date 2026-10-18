<script setup lang="ts">
import type { LongWorkspaceIndexSnapshot } from "@deepwrite/contracts";
import PopupSelect, {
  type PopupSelectValue,
  type PopupSelectOption
} from "./PopupSelect.vue";
defineProps<{
  settings: LongWorkspaceIndexSnapshot["featureSettings"];
  disabled: boolean;
}>();
const emit = defineEmits<{
  updateLayout: [
    key:
      | "worldbuildingItemLayout"
      | "characterAndContinuityItemLayout"
      | "plotItemLayout",
    value: PopupSelectValue
  ];
}>();
const worldbuildingItemLayoutOptions: readonly PopupSelectOption[] = [
  { value: "top-tabs", label: "上方横向标签" },
  { value: "right-list", label: "右侧纵向列表" },
  { value: "left-tree", label: "左侧树形结构" }
];
</script>

<template>
  <div
    id="long-structure-panel-content-features"
    class="structure-panel-content"
    role="tabpanel"
    aria-labelledby="long-structure-panel-features"
  >
    <div class="feature-settings-list">
      <section class="feature-setting-card">
        <div class="feature-setting-copy">
          <strong>世界观条目样式</strong>
          <span>
            选择列表型世界观分类中的概览与条目如何排列。
            左侧树形结构会把概览与条目放到世界观分类下方。
          </span>
        </div>
        <PopupSelect
          :model-value="settings.worldbuildingItemLayout"
          :options="worldbuildingItemLayoutOptions"
          accessible-label="选择世界观条目样式"
          :disabled="disabled"
          :menu-z-index="2300"
          @update:model-value="
            emit('updateLayout', 'worldbuildingItemLayout', $event)
          "
        />
      </section>
      <section class="feature-setting-card">
        <div class="feature-setting-copy">
          <strong>人物与连续性条目样式</strong>
          <span>
            统一选择人物集合与连续性账本文件的排列方式。
            左侧树形结构会把人物与账本文件放到对应标题下方。
          </span>
        </div>
        <PopupSelect
          :model-value="settings.characterAndContinuityItemLayout"
          :options="worldbuildingItemLayoutOptions"
          accessible-label="选择人物与连续性条目样式"
          :disabled="disabled"
          :menu-z-index="2300"
          @update:model-value="
            emit('updateLayout', 'characterAndContinuityItemLayout', $event)
          "
        />
      </section>
      <section class="feature-setting-card">
        <div class="feature-setting-copy">
          <strong>剧情设计条目样式</strong>
          <span>
            选择全书故事线、剧情点和章卡集合的排列方式；左侧树形结构不会改变故事情节面板。
          </span>
        </div>
        <PopupSelect
          :model-value="settings.plotItemLayout"
          :options="worldbuildingItemLayoutOptions"
          accessible-label="选择剧情设计条目样式"
          :disabled="disabled"
          :menu-z-index="2300"
          @update:model-value="emit('updateLayout', 'plotItemLayout', $event)"
        />
      </section>
    </div>
  </div>
</template>
<style scoped src="./LongStructureFeatureSettings.css"></style>
