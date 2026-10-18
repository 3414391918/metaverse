<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { LongGetCharacterAppearanceReferencesResult } from "@deepwrite/contracts";
import CharacterAssetDialog from "./CharacterAssetDialog.vue";
import PopupSelect from "../../components/PopupSelect.vue";
import { characterApi } from "./character-api";
import { uiMessage } from "../../ui-feedback";
import {
  buildCharacterAppearancePrompt,
  type CharacterAppearanceMode
} from "./appearance-prompt";
import type { CreatedCharacterAppearance } from "./useCharacterProfile";

const props = defineProps<{
  bookId: string;
  characterId: string;
  locked?: boolean | undefined;
  create: (name: string) => Promise<CreatedCharacterAppearance | null>;
}>();
const emit = defineEmits<{ close: [] }>();
const mode = ref<CharacterAppearanceMode | null>(null);
const references = ref<LongGetCharacterAppearanceReferencesResult | null>(null);
const referenceCharacter = ref("");
const referenceAppearance = ref("");
const name = ref("");
const loading = ref(false);
const busy = ref(false);
const prompt = ref("");
const promptField = ref<HTMLTextAreaElement | null>(null);
let alive = true;
const selectedCharacter = computed(() =>
  references.value?.characters.find(
    (item) => item.characterId === referenceCharacter.value
  )
);
const selectedAppearance = computed(() =>
  selectedCharacter.value?.appearances.find(
    (item) => item.id === referenceAppearance.value
  )
);
const characterOptions = computed(
  () =>
    references.value?.characters.map((item) => ({
      value: item.characterId,
      label: item.name
    })) ?? []
);
const appearanceOptions = computed(
  () =>
    selectedCharacter.value?.appearances.map((item) => ({
      value: item.id,
      label: `${item.name}（${item.assets.length} 张）`
    })) ?? []
);
const disabled = computed(() =>
  Boolean(props.locked || loading.value || busy.value)
);
watch(referenceCharacter, () => {
  const appearances = selectedCharacter.value?.appearances ?? [];
  referenceAppearance.value =
    appearances.length === 1 ? appearances[0]!.id : "";
});
async function loadReferences() {
  loading.value = true;
  try {
    const result = await characterApi().getCharacterAppearanceReferences({
      bookId: props.bookId,
      characterId: props.characterId
    });
    if (!alive) return;
    if (
      result.bookId !== props.bookId ||
      result.characterId !== props.characterId
    )
      throw new Error("参考资料与当前角色不一致，请重新打开。");
    references.value = result;
  } catch (error) {
    if (alive)
      uiMessage.error(
        error instanceof Error ? error.message : "读取参考角色失败"
      );
  } finally {
    if (alive) loading.value = false;
  }
}
async function confirm() {
  if (disabled.value) return;
  const inventory = references.value,
    source = selectedCharacter.value,
    appearance = selectedAppearance.value;
  if (!mode.value || !inventory || !source || !appearance) {
    uiMessage.warning("请选择制作方式、参考角色和参考形象");
    return;
  }
  if (!name.value.trim()) {
    uiMessage.warning("请输入新形象名称");
    return;
  }
  const selectedMode = mode.value;
  busy.value = true;
  try {
    await characterApi().prepareCharacterAppearanceDirectory({
      bookId: props.bookId,
      characterId: source.characterId,
      appearanceId: appearance.id
    });
    const latest = await characterApi().getCharacterAppearanceReferences({
      bookId: props.bookId,
      characterId: props.characterId
    });
    if (!alive) return;
    const currentSource = latest.characters.find(
      (item) => item.characterId === source.characterId
    );
    const currentAppearance = currentSource?.appearances.find(
      (item) => item.id === appearance.id
    );
    if (!currentSource || !currentAppearance?.assetsDirectory)
      throw new Error("参考形象已更新，请重新选择参考资料");
    const result = await props.create(name.value);
    if (!result || !alive) return;
    const created = result.snapshot.profile.appearances.find(
      (item) => item.id === result.appearanceId
    );
    if (!created) throw new Error("新形象未保存，请重新读取角色档案");
    prompt.value = buildCharacterAppearancePrompt({
      mode: selectedMode,
      targetName: result.snapshot.profile.name,
      faceDescription: result.snapshot.profile.faceDescription,
      appearance: created,
      target: latest.target,
      reference: currentSource,
      referenceAppearance: currentAppearance
    });
  } catch (error) {
    if (alive)
      uiMessage.error(
        error instanceof Error ? error.message : "创建新形象失败"
      );
  } finally {
    if (alive) busy.value = false;
  }
}
async function copyPrompt() {
  try {
    await navigator.clipboard.writeText(prompt.value);
    uiMessage.success("提示词已复制");
  } catch {
    promptField.value?.focus();
    promptField.value?.select();
    uiMessage.warning("复制失败，已选中提示词，可按 ⌘C 或 Ctrl+C 复制");
  }
}
onMounted(() => void loadReferences());
onBeforeUnmount(() => {
  alive = false;
});
</script>
<template>
  <CharacterAssetDialog
    :title="prompt ? '新形象提示词' : '新增形象'"
    :busy="busy"
    :wide="Boolean(prompt)"
    @close="emit('close')"
  >
    <div v-if="!prompt" class="appearance-create-form">
      <div class="appearance-modes" aria-label="选择形象制作方式">
        <button
          type="button"
          :aria-pressed="mode === 'make'"
          :disabled="busy"
          data-appearance-mode="make"
          @click="mode = 'make'"
        >
          <strong>形象制作</strong><span>参考图片组织和动作，制作新形象</span>
        </button>
        <button
          type="button"
          :aria-pressed="mode === 'replace'"
          :disabled="busy"
          data-appearance-mode="replace"
          @click="mode = 'replace'"
        >
          <strong>形象替换</strong><span>保留动作、角度和表情，替换外观</span>
        </button>
      </div>
      <template v-if="mode">
        <label class="appearance-create-field">
          <span>参考角色</span>
          <PopupSelect
            v-model="referenceCharacter"
            :options="characterOptions"
            accessible-label="选择参考角色"
            :disabled="disabled"
            :menu-z-index="2600"
            :placeholder="loading ? '正在读取…' : '请选择已有图片的角色'"
          />
        </label>
        <label class="appearance-create-field">
          <span>参考形象</span>
          <PopupSelect
            v-model="referenceAppearance"
            :options="appearanceOptions"
            accessible-label="选择参考形象"
            :disabled="disabled || !selectedCharacter"
            :menu-z-index="2600"
            placeholder="请选择一套参考形象"
          />
        </label>
        <label class="appearance-create-field">
          <span>新形象名称</span>
          <input
            v-model="name"
            type="text"
            maxlength="256"
            aria-label="新形象名称"
            placeholder="例如：雨夜行装"
            :disabled="disabled"
            @keydown.enter.prevent="confirm"
          />
        </label>
        <p class="character-help">
          确认后创建新形象并提供提示词。参考形象图和特殊说明由你在外部 Agent
          中补充。
        </p>
        <p v-if="references && !characterOptions.length" class="character-help">
          当前作品没有带图片的参考角色，请先上传一套角色资产图。
        </p>
        <button
          v-if="!loading && !references"
          type="button"
          @click="loadReferences"
        >
          重新读取参考角色
        </button>
      </template>
    </div>
    <div v-else class="appearance-prompt-result">
      <p class="character-help">
        新形象已保存。复制提示词交给 Codex、Claude 等桌面
        Agent，上传参考图并补充特殊说明后执行。
      </p>
      <textarea
        ref="promptField"
        :value="prompt"
        readonly
        rows="16"
        aria-label="新形象制作提示词"
      />
    </div>
    <template #actions>
      <button type="button" :disabled="busy" @click="emit('close')">
        {{ prompt ? "关闭" : "取消" }}
      </button>
      <button
        v-if="prompt"
        type="button"
        class="character-save"
        @click="copyPrompt"
      >
        复制提示词
      </button>
      <button
        v-else-if="mode"
        type="button"
        class="character-save"
        :disabled="disabled || !references || !characterOptions.length"
        @click="confirm"
      >
        {{ busy ? "正在创建…" : "确认并生成提示词" }}
      </button>
    </template>
  </CharacterAssetDialog>
</template>
<style src="./appearance-create.css"></style>
