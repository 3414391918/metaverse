import { characterApi } from "./character-api";
import { computed, ref, watch, type Ref } from "vue";
import type {
  LongCharacterProfileSnapshot,
  LongDeleteCharacterAppearanceInput,
  LongCharacterProfile
} from "@deepwrite/contracts";
import { uiMessage } from "../../ui-feedback";
import { useCharacterProfileFocusRefresh } from "./useCharacterProfileFocusRefresh";
import {
  cloneProfile,
  mergeProfileField,
  rebaseProfileDraft,
  type ProfileField
} from "./profile-draft";

export interface CreatedCharacterAppearance {
  appearanceId: string;
  snapshot: LongCharacterProfileSnapshot;
}

export function useCharacterProfile(
  props: {
    bookId: string;
    characterId: string;
    updatedAt?: string | undefined;
  },
  onSaved: () => void
) {
  const snapshot = ref<LongCharacterProfileSnapshot | null>(null);
  const draft: Ref<LongCharacterProfile | null> = ref(null);
  const loading = ref(false);
  const saving = ref(false);
  const selectedAppearance = ref("");
  const error = ref("");
  const dirty = computed(() =>
    Boolean(
      snapshot.value &&
      draft.value &&
      JSON.stringify(snapshot.value.profile) !== JSON.stringify(draft.value)
    )
  );
  const activeAppearance = computed(() =>
    draft.value?.appearances.find(
      (item) => item.id === selectedAppearance.value
    )
  );
  let request = 0;
  async function load() {
    const version = ++request;
    loading.value = true;
    error.value = "";
    try {
      const next = await characterApi().readCharacterProfile({
        bookId: props.bookId,
        characterId: props.characterId
      });
      if (version !== request) return;
      if (dirty.value) {
        if (snapshot.value?.revision !== next.revision)
          uiMessage.warning(
            "角色档案已更新，请保存前核对最新内容。当前输入仍保留。"
          );
        snapshot.value!.assets = next.assets;
      } else {
        snapshot.value = next;
        draft.value = cloneProfile(next.profile);
        if (
          !next.profile.appearances.some(
            (item) => item.id === selectedAppearance.value
          )
        )
          selectedAppearance.value = next.profile.appearances[0]?.id ?? "";
      }
    } catch (e) {
      if (version === request) {
        error.value = e instanceof Error ? e.message : "读取角色档案失败";
        uiMessage.error(error.value);
      }
    } finally {
      if (version === request) loading.value = false;
    }
  }
  async function save(
    field: ProfileField,
    appearanceId?: string
  ): Promise<boolean> {
    if (saving.value || !draft.value || !snapshot.value) return false;
    const before = cloneProfile(snapshot.value.profile);
    let submitted: LongCharacterProfile;
    try {
      submitted = mergeProfileField(before, draft.value, field, appearanceId);
    } catch (e) {
      uiMessage.warning(e instanceof Error ? e.message : "请先选择形象");
      return false;
    }
    return Boolean(await persist(before, submitted));
  }
  async function persist(
    before: LongCharacterProfile,
    submitted: LongCharacterProfile
  ) {
    if (saving.value || !snapshot.value || !draft.value) return null;
    const version = request;
    saving.value = true;
    try {
      const next = await characterApi().saveCharacterProfile({
        bookId: props.bookId,
        characterId: props.characterId,
        profile: submitted,
        expectedRevision: snapshot.value.revision
      });
      if (version !== request || !draft.value) return null;
      draft.value = rebaseProfileDraft(
        before,
        draft.value,
        submitted,
        next.profile
      );
      snapshot.value = next;
      onSaved();
      uiMessage.success("已保存");
      return next;
    } catch (e) {
      uiMessage.error(e instanceof Error ? e.message : "保存失败，输入仍保留");
      return null;
    } finally {
      saving.value = false;
    }
  }
  function discard() {
    if (snapshot.value) draft.value = cloneProfile(snapshot.value.profile);
  }
  function updateAssets(next: LongCharacterProfileSnapshot) {
    if (
      next.bookId === props.bookId &&
      next.characterId === props.characterId &&
      snapshot.value
    )
      snapshot.value.assets = next.assets;
  }
  async function createAppearance(
    name: string
  ): Promise<CreatedCharacterAppearance | null> {
    if (!snapshot.value || !draft.value || saving.value || loading.value)
      return null;
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 256 || /[\r\n]/u.test(trimmed)) {
      uiMessage.warning("请填写 1～256 字的形象名称");
      return null;
    }
    if (
      snapshot.value.profile.appearances.some((item) => item.name === trimmed)
    ) {
      uiMessage.warning("已有同名形象，请换一个名称");
      return null;
    }
    if (!snapshot.value.profile.faceDescription.trim()) {
      uiMessage.warning("请先填写并保存脸部身材描述");
      return null;
    }
    const id = "appearance_" + crypto.randomUUID().replaceAll("-", "");
    const before = cloneProfile(snapshot.value.profile);
    const submitted = cloneProfile(before);
    submitted.appearances.push({ id, name: trimmed, description: "" });
    const next = await persist(before, submitted);
    if (!next) return null;
    selectedAppearance.value = id;
    return { appearanceId: id, snapshot: next };
  }
  async function deleteAppearance(
    input: LongDeleteCharacterAppearanceInput
  ): Promise<boolean> {
    if (
      !snapshot.value ||
      !draft.value ||
      saving.value ||
      loading.value ||
      input.bookId !== props.bookId ||
      input.characterId !== props.characterId
    )
      return false;
    const before = cloneProfile(snapshot.value.profile);
    const version = request;
    saving.value = true;
    try {
      const next = await characterApi().deleteCharacterAppearance({
        ...input,
        expectedAssetIds: [...input.expectedAssetIds]
      });
      if (version !== request || !draft.value) return false;
      const submitted = {
        ...before,
        appearances: before.appearances.filter(
          (a) => a.id !== input.appearanceId
        )
      };
      draft.value = rebaseProfileDraft(
        before,
        draft.value,
        submitted,
        next.profile
      );
      draft.value.appearances = draft.value.appearances.filter(
        (a) => a.id !== input.appearanceId
      );
      snapshot.value = next;
      if (
        !next.profile.appearances.some((a) => a.id === selectedAppearance.value)
      )
        selectedAppearance.value = next.profile.appearances[0]?.id ?? "";
      onSaved();
      if (next.directoryCleanupWarning)
        uiMessage.warning(next.directoryCleanupWarning);
      else uiMessage.success("形象及相关图片已永久删除");
      return true;
    } catch (e) {
      uiMessage.error(e instanceof Error ? e.message : "删除形象失败");
      return false;
    } finally {
      saving.value = false;
    }
  }
  watch(
    () => [props.bookId, props.characterId],
    () => {
      snapshot.value = null;
      draft.value = null;
      selectedAppearance.value = "";
      void load();
    },
    { immediate: true }
  );
  useCharacterProfileFocusRefresh(() => {
    if (!saving.value && !loading.value) void load();
  });
  watch(
    () => props.updatedAt,
    () => {
      if (!saving.value) void load();
    }
  );
  return {
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
    createAppearance
  };
}
