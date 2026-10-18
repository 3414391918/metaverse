import { mapMergedOffset } from "../../composables/mergeExternalDocument";
import type { ChapterVisualSelection } from "./chapterVisualSegments";

export interface ChapterViewportSnapshot {
  scrollTop: number;
  focused: boolean;
  selection?: ChapterVisualSelection | undefined;
  anchorOffset?: number | undefined;
}

function visualSegments(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      "[data-segment-start][data-segment-end]"
    )
  );
}

export function captureChapterViewport(
  container: HTMLElement | null,
  selection: ChapterVisualSelection | undefined
): ChapterViewportSnapshot | null {
  if (!container) return null;
  const top = container.getBoundingClientRect().top;
  const visible = visualSegments(container).find(
    (element) => element.getBoundingClientRect().bottom > top + 2
  );
  const start = Number(visible?.dataset.segmentStart);
  const end = Number(visible?.dataset.segmentEnd);
  const rect = visible?.getBoundingClientRect();
  const fraction = rect?.height
    ? Math.max(0, Math.min(1, (top - rect.top) / rect.height))
    : 0;
  return {
    scrollTop: container.scrollTop,
    focused: container.contains(document.activeElement),
    selection,
    anchorOffset:
      Number.isFinite(start) && Number.isFinite(end)
        ? Math.round(start + fraction * (end - start))
        : undefined
  };
}

export function restoreChapterViewport(
  container: HTMLElement | null,
  snapshot: ChapterViewportSnapshot | null,
  previous: string,
  merged: string,
  focusRange: (start: number, end: number, reveal: boolean) => void
): void {
  if (!container || !snapshot) return;
  if (snapshot.focused && snapshot.selection) {
    focusRange(
      mapMergedOffset(previous, merged, snapshot.selection.start),
      mapMergedOffset(previous, merged, snapshot.selection.end),
      true
    );
    return;
  }
  const position = snapshot.anchorOffset;
  if (position === undefined) {
    container.scrollTop = snapshot.scrollTop;
    return;
  }
  const mapped = mapMergedOffset(previous, merged, position);
  const target = visualSegments(container).find((element) => {
    const start = Number(element.dataset.segmentStart);
    const end = Number(element.dataset.segmentEnd);
    return start <= mapped && mapped <= end;
  });
  if (!target) {
    container.scrollTop = snapshot.scrollTop;
    return;
  }
  const start = Number(target.dataset.segmentStart);
  const end = Number(target.dataset.segmentEnd);
  const fraction = end > start ? (mapped - start) / (end - start) : 0;
  const rect = target.getBoundingClientRect();
  const top = container.getBoundingClientRect().top;
  container.scrollTop += rect.top + rect.height * fraction - top;
}
