import type {
  LongBookSummary,
  LongLedgerCommitIndexEntry
} from "@deepwrite/contracts";

export function longContinuityBatchLabel(
  commit: LongLedgerCommitIndexEntry,
  chapterCards: LongBookSummary["navigation"]["chapterCards"]
): { label: string; badge: string } {
  const chapterCardIds = commit.chapterCardIds ?? [commit.chapterCardId];
  const titleById = new Map(chapterCards.map(({ id, title }) => [id, title]));
  const firstId = chapterCardIds[0]!;
  const lastId = chapterCardIds.at(-1)!;
  const firstTitle = titleById.get(firstId) ?? firstId;
  const lastTitle = titleById.get(lastId) ?? lastId;
  const label =
    chapterCardIds.length === 1 ? lastTitle : `${firstTitle} — ${lastTitle}`;
  const badge =
    commit.mode === "import_checkpoint"
      ? "导入检查点"
      : chapterCardIds.length === 1
        ? `记录 ${commit.sequence}`
        : `${chapterCardIds.length} 章 · 记录 ${commit.sequence}`;
  return { label, badge };
}
