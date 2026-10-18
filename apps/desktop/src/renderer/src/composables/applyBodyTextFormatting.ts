import { nextTick } from "vue";
import type { BodyTextFormat } from "@deepwrite/contracts";
import type { BodyTextFormattingOptions } from "./useBodyTextFormatting";
import { formatBodyText } from "../utils/bodyTextFormat";
import { uiMessage } from "../ui-feedback";

export function applyBodyTextFormatting(
  options: BodyTextFormattingOptions,
  format: BodyTextFormat
): void {
  const content = options.content();
  const nextContent = formatBodyText(content, format);
  if (nextContent === content) {
    uiMessage.info("正文已符合格式规范");
    return;
  }
  const input = options.editorInput();
  const key = options.documentKey();
  const scrollTop = input?.scrollTop;
  const activeSelection = options.selection?.();
  const selection = {
    start: Math.min(
      activeSelection?.start ?? input?.selectionStart ?? 0,
      nextContent.length
    ),
    end: Math.min(
      activeSelection?.end ?? input?.selectionEnd ?? 0,
      nextContent.length
    )
  };
  const delta = options.recordChange(nextContent, selection);
  options.updateContent(nextContent, delta);
  uiMessage.success("已规范正文格式");
  void nextTick(() => {
    if (key !== options.documentKey()) return;
    if (input && input === options.editorInput()) {
      input.setSelectionRange(selection.start, selection.end);
      if (scrollTop !== undefined) input.scrollTop = scrollTop;
    }
    if (activeSelection)
      options.restoreSelection?.(selection.start, selection.end);
  });
}
