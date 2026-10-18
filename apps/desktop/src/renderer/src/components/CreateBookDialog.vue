<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { LONG_BOOK_GENRES, LongBookGenreSchema } from "@deepwrite/contracts";
import type {
  CreateLongBookInput,
  LinkedMaterialIdsByKind,
  LinkedSkillIdsByKind,
  MaterialLibrary,
  MaterialLibraryGroup,
  SkillLibrary,
  SkillLibraryGroup
} from "@deepwrite/contracts";
import { uiMessage } from "../ui-feedback";
import BookLibraryBindings from "./BookLibraryBindings.vue";

const props = withDefaults(
  defineProps<{
    open: boolean;
    materials?: readonly MaterialLibrary[];
    materialGroups?: readonly MaterialLibraryGroup[];
    skills?: readonly SkillLibrary[];
    skillGroups?: readonly SkillLibraryGroup[];
    loading?: boolean;
    submitting?: boolean;
  }>(),
  {
    materials: () => [],
    materialGroups: () => [],
    skills: () => [],
    skillGroups: () => [],
    loading: false,
    submitting: false
  }
);

const emit = defineEmits<{
  close: [];
  submit: [payload: CreateLongBookInput];
}>();

const title = ref("");
const genre = ref<string>(LONG_BOOK_GENRES[0]);
const genreOptions = LONG_BOOK_GENRES;
const titleInput = ref<HTMLInputElement | null>(null);
const bindings = ref<{
  linkedMaterialIdsByKind: LinkedMaterialIdsByKind;
  linkedSkillIdsByKind: LinkedSkillIdsByKind;
}>();
function resetDraft(): void {
  title.value = "";
  genre.value = LONG_BOOK_GENRES[0];
  bindings.value = undefined;
}

function requestClose(): void {
  if (!props.submitting) emit("close");
}

function submit(): void {
  const normalizedTitle = title.value.trim();
  if (!normalizedTitle) {
    uiMessage.warning("请输入书名");
    titleInput.value?.focus();
    return;
  }
  const linkedMaterialIdsByKind = bindings.value?.linkedMaterialIdsByKind;
  const linkedSkillIdsByKind = bindings.value?.linkedSkillIdsByKind;
  if (Array.from(normalizedTitle).length > 256) {
    uiMessage.warning("书名不能超过 256 个字符");
    titleInput.value?.focus();
    return;
  }
  emit("submit", {
    title: normalizedTitle,
    genre: LongBookGenreSchema.parse(genre.value),
    linkedMaterialIdsByKind,
    linkedSkillIdsByKind
  });
}

function handleKeydown(event: KeyboardEvent): void {
  if (props.open && event.key === "Escape") requestClose();
}

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    resetDraft();
    void nextTick(() => titleInput.value?.focus());
  },
  { immediate: true }
);

onMounted(() => document.addEventListener("keydown", handleKeydown));
onBeforeUnmount(() => document.removeEventListener("keydown", handleKeydown));
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="dialog-backdrop" @mousedown.self="requestClose">
      <section
        class="workspace-dialog create-short-book-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-book-title"
      >
        <header>
          <div>
            <span class="dialog-eyebrow">创作空间</span>
            <h2 id="create-book-title">新建书籍</h2>
          </div>
          <button
            class="dialog-close"
            type="button"
            aria-label="关闭"
            :disabled="submitting"
            @click="requestClose"
          >
            ×
          </button>
        </header>

        <form
          class="dialog-content create-short-book-form"
          @submit.prevent="submit"
        >
          <section
            class="create-short-book-basics"
            aria-labelledby="create-short-basics-heading"
          >
            <h3 id="create-short-basics-heading">书籍信息</h3>
            <label class="create-short-book-field">
              <span>书名</span>
              <input
                ref="titleInput"
                v-model="title"
                type="text"
                maxlength="256"
                autocomplete="off"
                placeholder="请输入书名"
                :disabled="submitting"
              />
            </label>

            <fieldset class="create-short-genre-field">
              <legend>题材</legend>
              <div class="create-short-genre-options">
                <label
                  v-for="option in genreOptions"
                  :key="option"
                  class="create-short-genre-option"
                  :class="{ 'is-selected': genre === option }"
                >
                  <input
                    v-model="genre"
                    type="radio"
                    name="bookGenre"
                    :value="option"
                    :disabled="submitting"
                  />
                  <span>{{ option }}</span>
                </label>
              </div>
            </fieldset>
          </section>

          <BookLibraryBindings
            :key="String(open)"
            :materials="materials"
            :skills="skills"
            :material-groups="materialGroups"
            :skill-groups="skillGroups"
            workspace-type="long"
            :loading="loading"
            :submitting="submitting"
            @change="bindings = $event"
          />

          <div class="dialog-actions create-short-book-actions">
            <span
              v-if="loading"
              class="dialog-action-status"
              aria-live="polite"
            >
              正在加载素材库和技能库目录…
            </span>
            <button
              class="dialog-secondary-button"
              type="button"
              :disabled="submitting"
              @click="requestClose"
            >
              取消
            </button>
            <button
              class="dialog-primary-button"
              type="submit"
              :disabled="loading || submitting"
            >
              {{ submitting ? "创建中…" : "创建书籍" }}
            </button>
          </div>
        </form>
      </section>
    </div>
  </Teleport>
</template>
