import { computed, nextTick, ref, watch, type Ref } from "vue";
import {
  PROMPT_ATTACHMENT_MAX_ITEMS,
  PROMPT_TEXT_ATTACHMENTS_MAX_CONTENT_LENGTH,
  type LibraryAgentDomain,
  type UserPromptAttachment
} from "@deepwrite/contracts";
import type {
  ComposerReferenceOption,
  EditorTextReference
} from "../types/conversation";
import { uiMessage } from "../ui-feedback";
import {
  findComposerReferenceMatch,
  insertComposerReference,
  type ComposerReferenceMatch
} from "../utils/composerReferences";
import { createEditorReferenceAttachment } from "../utils/editorTextReferences";

export function useConversationComposer(options: {
  draft: () => string;
  canSend: () => boolean;
  canSendAttachments: () => boolean;
  runtimeAvailable: () => boolean;
  libraryDomain: () => LibraryAgentDomain | undefined;
  availableSkills: () => readonly ComposerReferenceOption[];
  availableMaterials: () => readonly ComposerReferenceOption[];
  editorReferences: () => readonly EditorTextReference[];
  pendingAttachments: Ref<UserPromptAttachment[]>;
  readingAttachments: Ref<boolean>;
  emitDraft: (value: string) => void;
  emitSend: (attachments: UserPromptAttachment[]) => void;
  emitClearEditorReferences: () => void;
}) {
  const composerInput = ref<HTMLTextAreaElement>();
  const activeReference = ref<ComposerReferenceMatch | null>(null);
  const activeReferenceIndex = ref(0);

  const canSubmit = computed(
    () =>
      !options.readingAttachments.value &&
      (options.canSend() ||
        (options.canSendAttachments() &&
          (options.pendingAttachments.value.length > 0 ||
            options.editorReferences().length > 0)))
  );

  const referenceOptions = computed(() =>
    activeReference.value?.trigger === "/"
      ? options.availableSkills()
      : activeReference.value?.trigger === "@"
        ? options.availableMaterials()
        : []
  );
  const filteredReferenceOptions = computed(() => {
    const query =
      activeReference.value?.query.trim().toLocaleLowerCase("zh-CN") ?? "";
    const matches = query
      ? referenceOptions.value.filter((option) =>
          `${option.label} ${option.detail}`
            .toLocaleLowerCase("zh-CN")
            .includes(query)
        )
      : referenceOptions.value;
    return matches.slice(0, 12);
  });
  const referenceMenuTitle = computed(() =>
    activeReference.value?.trigger === "/"
      ? "调用技能"
      : options.libraryDomain() === "skill"
        ? "引用技能"
        : "引用素材"
  );
  const referenceMenuHint = computed(() =>
    activeReference.value?.trigger === "/"
      ? "输入名称搜索技能"
      : options.libraryDomain() === "skill"
        ? "输入名称搜索技能条目"
        : "输入名称搜索素材条目"
  );
  const composerPlaceholder = computed(() => {
    if (!options.runtimeAvailable())
      return "浏览器预览不可发送，请启动桌面客户端";
    if (options.libraryDomain() === "skill") {
      return "描述资料库任务，输入 / 加载方法技能，输入 @ 引用当前库或同分组其它库的技能……";
    }
    if (options.libraryDomain() === "material") {
      return "描述资料库任务，输入 / 加载方法技能，输入 @ 引用当前库或同分组其它库的素材……";
    }
    return "随心输入，输入 / 调用技能，输入 @ 引用素材……";
  });

  watch(
    () =>
      options
        .editorReferences()
        .map((reference) => reference.id)
        .join("\u0000"),
    (ids) => {
      if (!ids) return;
      void nextTick(() => composerInput.value?.focus());
    }
  );

  watch(
    () =>
      filteredReferenceOptions.value.map((option) => option.id).join("\u0000"),
    () => {
      activeReferenceIndex.value = Math.min(
        activeReferenceIndex.value,
        Math.max(0, filteredReferenceOptions.value.length - 1)
      );
    }
  );

  function updateActiveReference(input: HTMLTextAreaElement): void {
    const next = findComposerReferenceMatch(
      input.value,
      input.selectionStart ?? input.value.length
    );
    const changedTrigger =
      next?.start !== activeReference.value?.start ||
      next?.trigger !== activeReference.value?.trigger;
    activeReference.value = next;
    if (changedTrigger) {
      activeReferenceIndex.value = 0;
    }
  }

  function handleInput(event: Event): void {
    const input = event.target as HTMLTextAreaElement;
    options.emitDraft(input.value);
    updateActiveReference(input);
  }

  function closeReferenceMenu(): void {
    activeReference.value = null;
    activeReferenceIndex.value = 0;
  }

  function focusInput(): void {
    void nextTick(() => {
      const input = composerInput.value;
      if (!input || input.disabled) return;
      input.focus();
      const caret = input.value.length;
      input.setSelectionRange(caret, caret);
    });
  }

  function scrollActiveReferenceOptionIntoView(): void {
    void nextTick(() => {
      document
        .getElementById(
          `composer-reference-option-${activeReferenceIndex.value}`
        )
        ?.scrollIntoView({ block: "nearest" });
    });
  }

  function selectReference(option: ComposerReferenceOption): void {
    const match = activeReference.value;
    if (!match) return;
    const insertion = insertComposerReference(
      composerInput.value?.value ?? options.draft(),
      match,
      option.label
    );
    options.emitDraft(insertion.value);
    closeReferenceMenu();
    void nextTick(() => {
      composerInput.value?.focus();
      composerInput.value?.setSelectionRange(insertion.caret, insertion.caret);
    });
  }

  function submitMessage(): void {
    if (!canSubmit.value) return;
    const attachments = options.pendingAttachments.value.map((attachment) => ({
      ...attachment
    }));
    attachments.push(
      ...options.editorReferences().map(createEditorReferenceAttachment)
    );
    if (attachments.length > PROMPT_ATTACHMENT_MAX_ITEMS) {
      uiMessage.warning(
        `每条消息最多携带 ${PROMPT_ATTACHMENT_MAX_ITEMS} 项附件或正文引用。`
      );
      return;
    }
    const textLength = attachments.reduce(
      (total, attachment) =>
        total + (attachment.kind === "text" ? attachment.content.length : 0),
      0
    );
    if (textLength > PROMPT_TEXT_ATTACHMENTS_MAX_CONTENT_LENGTH) {
      uiMessage.warning(
        `文本附件与正文引用合计最多携带 ${PROMPT_TEXT_ATTACHMENTS_MAX_CONTENT_LENGTH.toLocaleString("zh-CN")} 个字符。`
      );
      return;
    }
    options.pendingAttachments.value = [];
    options.emitSend(attachments);
    if (options.editorReferences().length) options.emitClearEditorReferences();
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (activeReference.value && !event.isComposing) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const count = filteredReferenceOptions.value.length;
        if (count) {
          const offset = event.key === "ArrowDown" ? 1 : -1;
          activeReferenceIndex.value =
            (activeReferenceIndex.value + offset + count) % count;
          scrollActiveReferenceOptionIntoView();
        }
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        closeReferenceMenu();
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        const option =
          filteredReferenceOptions.value[activeReferenceIndex.value];
        if (option) selectReference(option);
        else closeReferenceMenu();
        return;
      }
    }
    if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    if (canSubmit.value) submitMessage();
  }

  return {
    composerInput,
    activeReference,
    activeReferenceIndex,
    canSubmit,
    referenceOptions,
    filteredReferenceOptions,
    referenceMenuTitle,
    referenceMenuHint,
    composerPlaceholder,
    updateActiveReference,
    handleInput,
    closeReferenceMenu,
    focusInput,
    scrollActiveReferenceOptionIntoView,
    selectReference,
    submitMessage,
    handleKeydown
  };
}
