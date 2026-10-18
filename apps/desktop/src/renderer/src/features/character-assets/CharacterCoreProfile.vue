<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount, onMounted } from "vue";
import SavedProfileField from "./SavedProfileField.vue";
import CharacterAssetGallery from "./CharacterAssetGallery.vue";
import CharacterAssetDialog from "./CharacterAssetDialog.vue";
import CreateCharacterAppearanceDialog from "./CreateCharacterAppearanceDialog.vue";
import CharacterVoiceActions from "./CharacterVoiceActions.vue";
import DeleteCharacterAppearanceDialog from "./DeleteCharacterAppearanceDialog.vue";
import type { LongDeleteCharacterAppearanceInput } from "@deepwrite/contracts";
import PopupSelect from "../../components/PopupSelect.vue";
import { uiMessage } from "../../ui-feedback";
import { useCharacterProfile } from "./useCharacterProfile";
const props = defineProps<{
  bookId: string;
  characterId: string;
  updatedAt?: string | undefined;
  locked?: boolean;
}>();
const emit = defineEmits<{ saved: []; dirty: [value: boolean] }>();
const {
  snapshot,
  draft,
  loading,
  saving,
  error,
  dirty,
  selectedAppearance,
  activeAppearance,
  save,
  load,
  discard,
  updateAssets,
  deleteAppearance,
  createAppearance: saveNewAppearance
} = useCharacterProfile(props, () => emit("saved"));
const gallery = ref<InstanceType<typeof CharacterAssetGallery> | null>(null);
const menuOpen = ref(false);
const voiceAction = ref(false);
const disabled = computed(() =>
  Boolean(props.locked || saving.value || loading.value)
);
const appearanceOptions = computed(
  () =>
    draft.value?.appearances.map((item) => ({
      value: item.id,
      label: item.name || "未命名形象"
    })) ?? []
);
const savedAppearance = computed(() =>
  snapshot.value?.profile.appearances.find(
    (item) => item.id === selectedAppearance.value
  )
);
const leaveOpen = ref(false);
const createOpen = ref(false);
const deleteTarget = ref<{
  name: string;
  input: LongDeleteCharacterAppearanceInput;
} | null>(null);
let pendingLeave: Promise<boolean> | null = null;
let resolveLeave: ((allowed: boolean) => void) | null = null;
function settleLeave(allowed: boolean) {
  leaveOpen.value = false;
  resolveLeave?.(allowed);
  resolveLeave = null;
  pendingLeave = null;
}
async function prepareLeave(): Promise<boolean> {
  if (saving.value || gallery.value?.isBusy) {
    uiMessage.info("请等待当前操作完成");
    return false;
  }
  if (!dirty.value) return true;
  if (pendingLeave) return pendingLeave;
  leaveOpen.value = true;
  pendingLeave = new Promise((resolve) => {
    resolveLeave = resolve;
  });
  return pendingLeave;
}
async function saveAndLeave() {
  if (await save("all")) settleLeave(true);
}
async function selectAppearance(value: string | number | boolean | null) {
  if (value === selectedAppearance.value) return;
  if (await prepareLeave()) selectedAppearance.value = String(value ?? "");
}
async function createAppearance() {
  if (await prepareLeave()) createOpen.value = true;
}
async function requestDeleteAppearance() {
  const bookId = props.bookId,
    characterId = props.characterId,
    appearanceId = selectedAppearance.value;
  if (
    !(await prepareLeave()) ||
    bookId !== props.bookId ||
    characterId !== props.characterId
  )
    return;
  const appearance = snapshot.value?.profile.appearances.find(
    (a) => a.id === appearanceId
  );
  if (!appearance || !snapshot.value) return;
  deleteTarget.value = {
    name: appearance.name,
    input: {
      bookId,
      characterId,
      appearanceId,
      expectedRevision: snapshot.value.revision,
      expectedAssetIds: snapshot.value.assets
        .filter((a) => a.appearanceId === appearanceId)
        .map((a) => a.id)
    }
  };
}
async function confirmDeleteAppearance() {
  if (disabled.value || gallery.value?.isBusy) return;
  const target = deleteTarget.value;
  if (target && (await deleteAppearance(target.input)))
    deleteTarget.value = null;
}
async function reload() {
  menuOpen.value = false;
  if (dirty.value && !(await prepareLeave())) return;
  await load();
}
function openVoiceAction() {
  menuOpen.value = false;
  if (!snapshot.value) return;
  if (dirty.value) {
    uiMessage.info("请先保存角色档案的修改，再创建声音。");
    return;
  }
  voiceAction.value = true;
}
function beforeUnload(event: BeforeUnloadEvent) {
  if (dirty.value) {
    event.preventDefault();
    event.returnValue = "";
  }
}
onMounted(() => window.addEventListener("beforeunload", beforeUnload));
onBeforeUnmount(() => {
  window.removeEventListener("beforeunload", beforeUnload);
  settleLeave(false);
});
watch(dirty, (value) => emit("dirty", value), { immediate: true });
watch(
  () => [props.bookId, props.characterId],
  () => {
    createOpen.value = false;
    deleteTarget.value = null;
  }
);
defineExpose({ prepareLeave, saveAll: () => save("all"), dirty });
</script>
<template>
  <div class="character-profile" aria-label="角色核心档案">
    <header class="character-profile-heading">
      <div>
        <span>人物设计 · 核心档案</span>
        <h1>{{ snapshot?.profile.name ?? "角色档案" }}</h1>
      </div>
      <div class="character-profile-more">
        <button
          type="button"
          aria-label="角色操作"
          :aria-expanded="menuOpen"
          :disabled="disabled"
          @click="menuOpen = !menuOpen"
        >
          •••
        </button>
        <div v-if="menuOpen" class="character-profile-more-menu">
          <button type="button" @click="reload">重新读取</button>
          <button type="button" @click="openVoiceAction()">创建声音</button>
        </div>
      </div>
    </header>
    <div v-if="loading && !draft" class="character-profile-empty">
      正在读取角色档案…
    </div>
    <div v-else-if="!draft || !snapshot" class="character-profile-empty">
      <p>{{ error || "暂无档案" }}</p>
      <button type="button" @click="load">重新读取</button>
    </div>
    <template v-else>
      <CharacterVoiceActions
        v-if="voiceAction && snapshot"
        :key="`${bookId}:${characterId}`"
        :book-id="bookId"
        :character-id="characterId"
        :character-name="snapshot.profile.name"
        @close="voiceAction = false"
      />
      <SavedProfileField
        v-model="draft.name"
        label="角色名称"
        :saved-value="snapshot.profile.name"
        :disabled="disabled"
        single-line
        @save="save('name')"
      />
      <SavedProfileField
        v-model="draft.keywords"
        label="角色关键词"
        :saved-value="snapshot.profile.keywords"
        :disabled="disabled"
        :rows="2"
        @save="save('keywords')"
      />
      <SavedProfileField
        v-model="draft.faceDescription"
        label="脸部身材描述"
        :saved-value="snapshot.profile.faceDescription"
        :disabled="disabled"
        :rows="6"
        @save="save('faceDescription')"
      />
      <SavedProfileField
        v-model="draft.settingDescription"
        label="角色设定描述"
        :saved-value="snapshot.profile.settingDescription"
        :disabled="disabled"
        :rows="7"
        @save="save('settingDescription')"
      />
      <section class="character-appearances">
        <header class="character-appearance-heading">
          <div>
            <h2>角色形象描述</h2>
            <span>{{ draft.appearances.length }} 种形象</span>
          </div>
          <div class="character-appearance-actions">
            <button
              type="button"
              :disabled="disabled"
              @click="createAppearance"
            >
              ＋ 新增形象
            </button>
            <button
              type="button"
              :disabled="disabled || !savedAppearance"
              @click="requestDeleteAppearance"
            >
              删除形象
            </button>
          </div>
        </header>
        <PopupSelect
          :model-value="selectedAppearance"
          :options="appearanceOptions"
          accessible-label="选择角色形象"
          placeholder="请选择形象"
          :disabled="disabled"
          @update:model-value="selectAppearance"
        />
        <div v-if="activeAppearance" class="character-appearance-body">
          <SavedProfileField
            v-model="activeAppearance.name"
            label="形象名称"
            :saved-value="savedAppearance?.name ?? ''"
            :disabled="disabled"
            single-line
            @save="
              save(
                savedAppearance ? 'appearance-name' : 'appearance-create',
                selectedAppearance
              )
            "
          />
          <SavedProfileField
            v-model="activeAppearance.description"
            label="形象文本描述"
            :saved-value="savedAppearance?.description ?? ''"
            :disabled="disabled"
            :rows="7"
            @save="
              save(
                savedAppearance
                  ? 'appearance-description'
                  : 'appearance-create',
                selectedAppearance
              )
            "
          />
          <CharacterAssetGallery
            ref="gallery"
            :book-id="bookId"
            :character-id="characterId"
            :appearance-id="selectedAppearance"
            :assets="snapshot.assets"
            :disabled="disabled || !savedAppearance"
            @updated="updateAssets"
          />
          <span v-if="!savedAppearance" class="character-help"
            >保存新形象后即可上传图片。</span
          >
        </div>
        <div v-else class="character-profile-empty">
          新增形象后，可以分别填写外观和上传角色资产图。
        </div>
      </section>
    </template>
    <CreateCharacterAppearanceDialog
      v-if="createOpen"
      :book-id="bookId"
      :character-id="characterId"
      :locked="disabled"
      :create="saveNewAppearance"
      @close="createOpen = false"
    />
    <DeleteCharacterAppearanceDialog
      v-if="deleteTarget"
      :name="deleteTarget.name"
      :count="deleteTarget.input.expectedAssetIds.length"
      :busy="saving"
      :disabled="disabled"
      @close="deleteTarget = null"
      @confirm="confirmDeleteAppearance"
    />
    <CharacterAssetDialog
      v-if="leaveOpen"
      title="角色档案有未保存修改"
      :busy="saving"
      @close="settleLeave(false)"
    >
      <p>保存这些修改后再切换，或放弃修改继续。</p>
      <template #actions
        ><button type="button" :disabled="saving" @click="settleLeave(false)">
          取消</button
        ><button
          type="button"
          :disabled="saving"
          @click="
            discard();
            settleLeave(true);
          "
        >
          放弃修改</button
        ><button
          type="button"
          class="character-save"
          :disabled="saving || locked"
          @click="saveAndLeave"
        >
          保存并继续
        </button></template
      >
    </CharacterAssetDialog>
  </div>
</template>
<style src="./character-profile.css"></style>
