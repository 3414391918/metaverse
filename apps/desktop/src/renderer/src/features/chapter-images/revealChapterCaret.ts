/** Reveal a caret inside an auto-height textarea without scrolling its entire chapter segment. */
export function revealChapterCaret(
  input: HTMLTextAreaElement,
  offset: number
): void {
  const scroller = input.closest<HTMLElement>(".long-document-preview");
  if (!scroller) return;
  const style = getComputedStyle(input);
  const mirror = document.createElement("div");
  mirror.style.position = "fixed";
  mirror.style.visibility = "hidden";
  mirror.style.pointerEvents = "none";
  mirror.style.width = `${input.clientWidth}px`;
  mirror.style.boxSizing = "border-box";
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.overflowWrap = "break-word";
  mirror.style.fontFamily = style.fontFamily;
  mirror.style.fontSize = style.fontSize;
  mirror.style.fontWeight = style.fontWeight;
  mirror.style.fontStyle = style.fontStyle;
  mirror.style.lineHeight = style.lineHeight;
  mirror.style.letterSpacing = style.letterSpacing;
  mirror.style.tabSize = style.tabSize;
  mirror.textContent = input.value.slice(0, offset);
  const caret = document.createElement("span");
  caret.textContent = "\u200b";
  mirror.append(caret);
  document.body.append(mirror);
  const caretTop =
    caret.getBoundingClientRect().top - mirror.getBoundingClientRect().top;
  mirror.remove();

  const caretY =
    input.getBoundingClientRect().top -
    scroller.getBoundingClientRect().top +
    scroller.scrollTop +
    caretTop;
  const lineHeight = Number.parseFloat(style.lineHeight) || 28;
  if (
    caretY < scroller.scrollTop + 16 ||
    caretY + lineHeight > scroller.scrollTop + scroller.clientHeight - 16
  ) {
    scroller.scrollTop = Math.max(0, caretY - scroller.clientHeight / 3);
  }
}
