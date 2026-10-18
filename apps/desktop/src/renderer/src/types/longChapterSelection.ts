import type {
  LongBookSummary,
  LongChapterCardId,
  LongWorkspaceIndexSnapshot
} from "@deepwrite/contracts";
import type { LongWorkspaceSelection } from "./longWorkspace";
import { indexedChapterCard, indexedVolume } from "./longIndexedChapter";

/** Resolve the next empty chapter in volume and narrative order. */
export function nextWritableLongChapterId(
  workspaceIndex: LongWorkspaceIndexSnapshot
): LongChapterCardId | null {
  const volumeOrder = new Map(
    workspaceIndex.plot.volumes.map(({ id, order }) => [id, order])
  );
  const ordered = [...workspaceIndex.plot.chapterCards].sort(
    (left, right) =>
      (volumeOrder.get(left.volumeId) ?? Number.MAX_SAFE_INTEGER) -
        (volumeOrder.get(right.volumeId) ?? Number.MAX_SAFE_INTEGER) ||
      left.narrativeOrder - right.narrativeOrder ||
      left.id.localeCompare(right.id)
  );
  return (
    ordered.find((candidate) =>
      workspaceIndex.chapters.some(
        ({ chapterCardId, bodyStatus }) =>
          chapterCardId === candidate.id && bodyStatus === "empty"
      )
    )?.id ?? null
  );
}

export function createLongChapterSelection(
  summary: LongBookSummary,
  workspaceIndex: LongWorkspaceIndexSnapshot,
  chapterCardId: LongChapterCardId
): LongWorkspaceSelection | undefined {
  const chapter = indexedChapterCard(summary, workspaceIndex, chapterCardId);
  const volume = chapter
    ? indexedVolume(summary, workspaceIndex, chapter.volumeId)
    : undefined;
  const entry = workspaceIndex.chapters.find(
    (candidate) => candidate.chapterCardId === chapterCardId
  );
  if (!chapter || !volume || !entry) return undefined;
  const committed = entry.commitId !== null;
  const nextWritable = nextWritableLongChapterId(workspaceIndex);
  return {
    key: `chapter:${chapter.id}`,
    root: "draft",
    chapterCardId: chapter.id,
    title: chapter.title || chapter.id,
    breadcrumbs: [
      summary.title,
      "正文",
      volume.title,
      chapter.title || chapter.id
    ],
    files: [
      {
        role: "body",
        label: "正文",
        file: entry.body
      }
    ],
    preferredRole: "body",
    description: committed
      ? "本章已有连续性记录；章末状态与接续包可直接编辑保存，正文仍可继续修改。"
      : entry.bodyStatus === "written"
        ? "本章正文已完成，可继续修改或按需补充连续性记录。"
        : nextWritable === chapter.id
          ? "这是连续下一张空白章卡，可启动单章写作。"
          : "本章仍为空白；自动写作需先完成前面的空白章节。"
  };
}
