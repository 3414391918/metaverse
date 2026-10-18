import type { LongWorkspaceIndexSnapshot } from "@deepwrite/contracts";

export type LongDeletionTargetKind =
  "character" | "volume" | "plotPoint" | "chapterCard";

function uniqueCount(values: readonly string[]): number {
  return new Set(values).size;
}

function chapterFileCount(
  index: LongWorkspaceIndexSnapshot,
  chapterCardIds: ReadonlySet<string>
): number {
  return index.chapters
    .filter(({ chapterCardId }) => chapterCardIds.has(chapterCardId))
    .reduce(
      (count, chapter) =>
        count +
        5 +
        (chapter.worldReveals ? 1 : 0) +
        chapter.characterContinuity.length * 2,
      0
    );
}

export function longDeletionImpactLines(
  index: LongWorkspaceIndexSnapshot,
  kind: LongDeletionTargetKind,
  id: string
): string[] {
  if (kind === "character") {
    const eventReferences = index.plot.storyEvents.filter((event) =>
      event.characterIds.includes(id)
    ).length;
    const continuityReferences = index.chapters.filter((chapter) =>
      chapter.characterContinuity.some(({ characterId }) => characterId === id)
    ).length;
    return [
      "删除该人物的核心档案与人物关系文件",
      eventReferences
        ? `从 ${eventReferences} 个故事事件中解除人物引用，故事事件保留`
        : "",
      continuityReferences
        ? `删除 ${continuityReferences} 章中的人物连续性映射及其文件，章节保留`
        : ""
    ].filter(Boolean);
  }

  if (kind === "volume") {
    const arcIds = new Set(
      index.plot.arcs
        .filter(({ volumeId }) => volumeId === id)
        .map(({ id }) => id)
    );
    const chapterIds = new Set(
      index.plot.chapterCards
        .filter(({ volumeId }) => volumeId === id)
        .map(({ id }) => id)
    );
    const storyPlotIds = index.plot.storyPlots
      .filter(({ arcId }) => arcIds.has(arcId))
      .map(({ id }) => id);
    const placementIds = new Set(
      index.plot.narrativePlacements
        .filter(({ chapterCardId }) => chapterIds.has(chapterCardId))
        .map(({ id }) => id)
    );
    const beatIds = index.plot.foreshadowing.flatMap(({ beats }) =>
      beats
        .filter(
          ({ volumeId, arcId, chapterCardId, placementId }) =>
            volumeId === id ||
            (typeof arcId === "string" && arcIds.has(arcId)) ||
            (typeof chapterCardId === "string" &&
              chapterIds.has(chapterCardId)) ||
            (typeof placementId === "string" && placementIds.has(placementId))
        )
        .map(({ id }) => id)
    );
    const eventReferences = index.plot.storyEvents.filter((event) =>
      event.arcIds.some((arcId) => arcIds.has(arcId))
    ).length;
    const ledgerRecords = index.ledger.commits.filter((commit) =>
      (commit.chapterCardIds ?? [commit.chapterCardId]).some((chapterCardId) =>
        chapterIds.has(chapterCardId)
      )
    ).length;
    return [
      arcIds.size ? `删除 ${arcIds.size} 个从属剧情点` : "",
      chapterIds.size ? `删除 ${chapterIds.size} 张从属章卡` : "",
      storyPlotIds.length
        ? `删除 ${storyPlotIds.length} 个从属故事线及正文`
        : "",
      placementIds.size ? `删除 ${placementIds.size} 个从属叙事落点` : "",
      uniqueCount(beatIds)
        ? `解除 ${uniqueCount(beatIds)} 个伏笔触点的分卷、剧情点、章卡或落点关联，伏笔线与触点保留`
        : "",
      chapterIds.size
        ? `删除 ${chapterFileCount(index, chapterIds)} 个章卡、正文与连续性文件`
        : "",
      ledgerRecords ? `更新 ${ledgerRecords} 条连续性记录并解除相关决策` : "",
      eventReferences
        ? `从 ${eventReferences} 个故事事件中解除剧情点引用，故事事件保留`
        : ""
    ].filter(Boolean);
  }

  if (kind === "plotPoint") {
    const storyPlots = index.plot.storyPlots.filter(
      ({ arcId }) => arcId === id
    ).length;
    const eventReferences = index.plot.storyEvents.filter((event) =>
      event.arcIds.includes(id)
    ).length;
    const chapterReferences = index.plot.chapterCards.filter(
      ({ primaryArcId }) => primaryArcId === id
    ).length;
    const beats = index.plot.foreshadowing.flatMap(({ beats }) =>
      beats.filter(({ arcId }) => arcId === id)
    ).length;
    return [
      storyPlots ? `删除 ${storyPlots} 个从属故事线及正文` : "",
      beats ? `解除 ${beats} 个伏笔触点的剧情点关联，伏笔线与触点保留` : "",
      eventReferences
        ? `从 ${eventReferences} 个故事事件中解除剧情点引用，故事事件保留`
        : "",
      chapterReferences
        ? `解除 ${chapterReferences} 张章卡的主剧情点引用，章卡与正文保留`
        : ""
    ].filter(Boolean);
  }

  const chapterIds = new Set([id]);
  const placements = index.plot.narrativePlacements.filter(
    ({ chapterCardId }) => chapterCardId === id
  );
  const placementIds = new Set(placements.map(({ id }) => id));
  const beats = index.plot.foreshadowing.flatMap(({ beats }) =>
    beats.filter(
      ({ chapterCardId, placementId }) =>
        chapterCardId === id ||
        (typeof placementId === "string" && placementIds.has(placementId))
    )
  ).length;
  const ledgerRecords = index.ledger.commits.filter(
    ({ chapterCardId }) => chapterCardId === id
  ).length;
  return [
    `删除 ${chapterFileCount(index, chapterIds)} 个章卡、正文与连续性文件`,
    placements.length ? `删除 ${placements.length} 个从属叙事落点` : "",
    beats ? `解除 ${beats} 个伏笔触点的章卡或落点关联，伏笔线与触点保留` : "",
    ledgerRecords ? `更新 ${ledgerRecords} 条连续性记录并解除相关决策` : "",
    placements.length ? "叙事落点关联的故事事件不会删除" : ""
  ].filter(Boolean);
}

export function longDeletionDescription(
  index: LongWorkspaceIndexSnapshot,
  kind: LongDeletionTargetKind,
  id: string
): string {
  const impacts = longDeletionImpactLines(index, kind, id);
  return impacts.length
    ? `删除目标后将同时处理以下关联：${impacts.join("；")}。`
    : "该条目没有其他关联，确认后将直接删除。";
}
