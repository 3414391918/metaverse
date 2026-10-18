import { onBeforeUnmount, ref, watch } from "vue";
import {
  PROMPT_ATTACHMENT_MAX_ITEMS,
  PROMPT_IMAGE_ATTACHMENTS_MAX_BYTES,
  PROMPT_TEXT_ATTACHMENTS_MAX_CONTENT_LENGTH,
  type UserPromptAttachment
} from "@deepwrite/contracts";
import { uiMessage } from "../ui-feedback";
import {
  promptAttachmentFilesFromClipboard,
  readPromptAttachment
} from "../utils/promptAttachments";

export function formatFileSize(size: number): string {
  if (size < 1_024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export function attachmentPreview(
  attachment: UserPromptAttachment
): string | undefined {
  return attachment.kind === "image"
    ? `data:${attachment.mediaType};base64,${attachment.data}`
    : undefined;
}

export function useConversationAttachments(options: {
  currentSessionId: () => string;
  closeReferenceMenu: () => void;
}) {
  const attachmentInput = ref<HTMLInputElement>();
  const pendingAttachments = ref<UserPromptAttachment[]>([]);
  const readingAttachments = ref(false);
  let attachmentReadEpoch = 0;

  function openAttachmentPicker(): void {
    attachmentInput.value?.click();
  }

  function attachmentKey(file: File): string {
    return `${file.name}\u0000${file.size}\u0000${file.lastModified}`;
  }

  function pendingAttachmentKey(attachment: UserPromptAttachment): string {
    return `${attachment.name}\u0000${attachment.size}`;
  }

  function validateAttachmentCapacity(
    attachment: UserPromptAttachment
  ): string | undefined {
    if (pendingAttachments.value.length >= PROMPT_ATTACHMENT_MAX_ITEMS) {
      return `每条消息最多上传 ${PROMPT_ATTACHMENT_MAX_ITEMS} 个附件。`;
    }
    if (attachment.kind === "text") {
      const textLength = pendingAttachments.value.reduce(
        (total, item) =>
          total + (item.kind === "text" ? item.content.length : 0),
        attachment.content.length
      );
      if (textLength > PROMPT_TEXT_ATTACHMENTS_MAX_CONTENT_LENGTH) {
        return `文本附件合计最多携带 ${PROMPT_TEXT_ATTACHMENTS_MAX_CONTENT_LENGTH.toLocaleString("zh-CN")} 个字符。`;
      }
    } else {
      const imageBytes = pendingAttachments.value.reduce(
        (total, item) => total + (item.kind === "image" ? item.size : 0),
        attachment.size
      );
      if (imageBytes > PROMPT_IMAGE_ATTACHMENTS_MAX_BYTES) {
        return "图片附件合计不能超过 25 MB。";
      }
    }
    return undefined;
  }

  async function addAttachmentFiles(files: File[]): Promise<void> {
    if (!files.length || readingAttachments.value) return;
    const readEpoch = ++attachmentReadEpoch;
    readingAttachments.value = true;
    const failures: string[] = [];
    let added = 0;
    try {
      const existing = new Set(
        pendingAttachments.value.map(pendingAttachmentKey)
      );
      const seenFiles = new Set<string>();
      for (const file of files) {
        const fileKey = attachmentKey(file);
        const duplicateKey = `${file.name}\u0000${file.size}`;
        if (seenFiles.has(fileKey) || existing.has(duplicateKey)) continue;
        seenFiles.add(fileKey);
        try {
          const result = await readPromptAttachment(file);
          if (readEpoch !== attachmentReadEpoch) return;
          const capacityError = validateAttachmentCapacity(result.attachment);
          if (capacityError) {
            failures.push(capacityError);
            continue;
          }
          pendingAttachments.value.push(result.attachment);
          existing.add(duplicateKey);
          added += 1;
          if (result.warning) uiMessage.warning(result.warning);
        } catch (error: unknown) {
          failures.push(
            error instanceof Error ? error.message : `读取“${file.name}”失败。`
          );
        }
      }
    } finally {
      if (readEpoch === attachmentReadEpoch) {
        readingAttachments.value = false;
      }
    }
    if (readEpoch !== attachmentReadEpoch) return;
    if (failures.length) {
      uiMessage.error(
        failures.length === 1
          ? failures[0]!
          : `${failures[0]}（另有 ${failures.length - 1} 个附件未添加）`
      );
    } else if (added > 0) {
      uiMessage.success(`已添加 ${added} 个附件`);
    }
  }

  function handleAttachmentChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = "";
    void addAttachmentFiles(files);
  }

  function handleComposerPaste(event: ClipboardEvent): void {
    const files = promptAttachmentFilesFromClipboard(event.clipboardData);
    if (!files.length) return;

    event.preventDefault();
    options.closeReferenceMenu();
    if (readingAttachments.value) {
      uiMessage.warning("正在读取附件，请稍后再粘贴。");
      return;
    }
    void addAttachmentFiles(files);
  }

  function removePendingAttachment(id: string): void {
    pendingAttachments.value = pendingAttachments.value.filter(
      (attachment) => attachment.id !== id
    );
  }

  function resetAttachments(): void {
    attachmentReadEpoch += 1;
    readingAttachments.value = false;
    pendingAttachments.value = [];
  }

  watch(
    () => options.currentSessionId(),
    () => {
      resetAttachments();
    }
  );

  onBeforeUnmount(() => {
    attachmentReadEpoch += 1;
  });

  return {
    attachmentInput,
    pendingAttachments,
    readingAttachments,
    openAttachmentPicker,
    addAttachmentFiles,
    handleAttachmentChange,
    handleComposerPaste,
    removePendingAttachment,
    resetAttachments
  };
}
