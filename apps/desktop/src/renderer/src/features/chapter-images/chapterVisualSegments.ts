export interface ChapterVisualSegment {
  kind: "text" | "image";
  start: number;
  end: number;
  source: string;
  url?: string;
  imageSource?: string;
  alt?: string;
}

export interface ChapterVisualSelection {
  start: number;
  end: number;
}

export interface ChapterVisualInput {
  content: string;
  selectionBefore: ChapterVisualSelection;
  selectionAfter: ChapterVisualSelection;
  inputType: string;
  timestamp: number;
}

export function splitChapterVisualSegments(
  content: string,
  resolveImageUrl: (source: string) => string | undefined
): ChapterVisualSegment[] {
  const segments: ChapterVisualSegment[] = [];
  const expression = /!\[([^\]\n]*)\]\(([^)\n]+)\)/g;
  let cursor = 0;
  for (const match of content.matchAll(expression)) {
    const start = match.index;
    const source = match[2] ?? "";
    const url = resolveImageUrl(source);
    if (!url) continue;
    segments.push({
      kind: "text",
      start: cursor,
      end: start,
      source: content.slice(cursor, start)
    });
    const end = start + match[0].length;
    segments.push({
      kind: "image",
      start,
      end,
      source: match[0],
      url,
      imageSource: source,
      alt: match[1] ?? ""
    });
    cursor = end;
  }
  segments.push({
    kind: "text",
    start: cursor,
    end: content.length,
    source: content.slice(cursor)
  });
  return segments;
}

export function replaceChapterVisualText(
  content: string,
  segment: ChapterVisualSegment,
  replacement: string
): string {
  if (
    segment.kind !== "text" ||
    content.slice(segment.start, segment.end) !== segment.source
  )
    throw new Error("章节正文已变化，请重新定位编辑位置。");
  return (
    content.slice(0, segment.start) + replacement + content.slice(segment.end)
  );
}
