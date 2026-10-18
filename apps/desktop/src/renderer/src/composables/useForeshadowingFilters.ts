import { computed } from "vue";
import type {
  LongForeshadowingBeatType,
  LongForeshadowingStatus,
  LongWorkspaceIndexSnapshot
} from "@deepwrite/contracts";
import type { PopupSelectOption } from "../components/PopupSelect.vue";

export type WorkspaceMode = "overview" | "volume" | "plotPoint";
export type PlannedSpan = "local" | "within_volume" | "cross_volume";
export type FilterValue = "all" | LongForeshadowingStatus;
export type SpanFilterValue = "all" | PlannedSpan;
type SnapshotThread =
  LongWorkspaceIndexSnapshot["plot"]["foreshadowing"][number];
type SnapshotBeat = SnapshotThread["beats"][number];

export interface ForeshadowingBeat extends SnapshotBeat {
  volumeId?: string | null;
  arcId?: string | null;
}

export interface ForeshadowingThread extends Omit<SnapshotThread, "beats"> {
  hiddenTruth?: string;
  plannedSpan?: PlannedSpan;
  beats: ForeshadowingBeat[];
}

export const spanLabels: Record<PlannedSpan, string> = {
  local: "剧情点内",
  within_volume: "卷内",
  cross_volume: "跨卷"
};

export const lifecycleLabels: Record<LongForeshadowingStatus, string> = {
  planned: "构思中",
  open: "已埋设",
  progressing: "发展中",
  resolved: "已回收",
  abandoned: "已废弃"
};

export const beatTypeLabels: Record<LongForeshadowingBeatType, string> = {
  source: "真相源头",
  plant: "埋设",
  reinforce: "强化",
  misdirect: "误导",
  partial_reveal: "部分揭示",
  reveal: "揭示",
  payoff: "回收",
  aftermath: "余波"
};

export const spanOptions: readonly PopupSelectOption[] = (
  Object.entries(spanLabels) as Array<[PlannedSpan, string]>
).map(([value, label]) => ({ value, label }));

export const spanFilterOptions: readonly PopupSelectOption[] = [
  { value: "all", label: "全部跨度" },
  ...spanOptions
];

export const lifecycleFilterOptions: readonly PopupSelectOption[] = [
  { value: "all", label: "全部生命周期" },
  ...(
    Object.entries(lifecycleLabels) as Array<[LongForeshadowingStatus, string]>
  ).map(([value, label]) => ({ value, label }))
];

export const editableLifecycleOptions: readonly PopupSelectOption[] = [
  {
    value: "planned",
    label: lifecycleLabels.planned,
    description: "尚未由正文提交产生实际触点"
  },
  {
    value: "abandoned",
    label: lifecycleLabels.abandoned,
    description: "保留记录，但不再继续推进"
  }
];

export const beatTypeOptions: readonly PopupSelectOption[] = (
  Object.entries(beatTypeLabels) as Array<[LongForeshadowingBeatType, string]>
).map(([value, label]) => ({ value, label }));

export function useForeshadowingFilters(props: {
  snapshot: LongWorkspaceIndexSnapshot;
  mode: WorkspaceMode;
  volumeId?: string | undefined;
  plotPointId?: string | undefined;
}) {
  const volumeById = computed(
    () =>
      new Map(
        props.snapshot.plot.volumes.map(
          (volume) => [volume.id, volume] as const
        )
      )
  );
  const arcById = computed(
    () => new Map(props.snapshot.plot.arcs.map((arc) => [arc.id, arc] as const))
  );
  const chapterById = computed(
    () =>
      new Map(
        props.snapshot.plot.chapterCards.map(
          (chapter) => [chapter.id, chapter] as const
        )
      )
  );
  const eventById = computed(
    () =>
      new Map(
        props.snapshot.plot.storyEvents.map(
          (event) => [event.id, event] as const
        )
      )
  );
  const placementById = computed(
    () =>
      new Map(
        props.snapshot.plot.narrativePlacements.map(
          (placement) => [placement.id, placement] as const
        )
      )
  );
  const resolvedContextVolumeId = computed(
    () =>
      props.volumeId ??
      (props.plotPointId
        ? arcById.value.get(props.plotPointId)?.volumeId
        : undefined)
  );

  const volumeOptions = computed<PopupSelectOption[]>(() => [
    { value: "", label: "暂不指定分卷" },
    ...[...props.snapshot.plot.volumes]
      .sort(
        (left, right) =>
          left.order - right.order || left.id.localeCompare(right.id)
      )
      .map((volume) => ({ value: volume.id, label: volume.title }))
  ]);

  const arcOptions = computed<PopupSelectOption[]>(() => {
    const scopedVolumeId =
      props.mode === "overview" ? undefined : resolvedContextVolumeId.value;
    return [
      { value: "", label: "暂不指定剧情点" },
      ...[...props.snapshot.plot.arcs]
        .filter((arc) => !scopedVolumeId || arc.volumeId === scopedVolumeId)
        .sort((left, right) => {
          const leftVolume = volumeById.value.get(left.volumeId)?.order ?? 0;
          const rightVolume = volumeById.value.get(right.volumeId)?.order ?? 0;
          return (
            leftVolume - rightVolume ||
            left.order - right.order ||
            left.id.localeCompare(right.id)
          );
        })
        .map((arc) => ({
          value: arc.id,
          label: `${volumeTitle(arc.volumeId)} · ${arc.title}`
        }))
    ];
  });

  function unique(values: Array<string | null | undefined>): string[] {
    return [
      ...new Set(values.filter((value): value is string => Boolean(value)))
    ];
  }

  function resolveBeatArcIds(beat: ForeshadowingBeat): string[] {
    if (beat.arcId) return [beat.arcId];
    const chapterId =
      beat.chapterCardId ??
      (beat.placementId
        ? placementById.value.get(beat.placementId)?.chapterCardId
        : undefined);
    const chapterArcId = chapterId
      ? chapterById.value.get(chapterId)?.primaryArcId
      : undefined;
    if (chapterArcId) return [chapterArcId];
    const eventArcIds = beat.eventId
      ? unique(eventById.value.get(beat.eventId)?.arcIds ?? [])
      : [];
    return beat.volumeId
      ? eventArcIds.filter(
          (arcId) => arcById.value.get(arcId)?.volumeId === beat.volumeId
        )
      : eventArcIds;
  }

  function resolveBeatVolumeIds(beat: ForeshadowingBeat): string[] {
    if (beat.arcId) {
      const arcVolumeId = arcById.value.get(beat.arcId)?.volumeId;
      return arcVolumeId ? [arcVolumeId] : [];
    }
    if (beat.volumeId) return [beat.volumeId];
    const arcVolumeIds = resolveBeatArcIds(beat).map(
      (arcId) => arcById.value.get(arcId)?.volumeId
    );
    if (arcVolumeIds.some(Boolean)) return unique(arcVolumeIds);
    const chapterId =
      beat.chapterCardId ??
      (beat.placementId
        ? placementById.value.get(beat.placementId)?.chapterCardId
        : undefined);
    const chapterVolumeId = chapterId
      ? chapterById.value.get(chapterId)?.volumeId
      : undefined;
    return chapterVolumeId ? [chapterVolumeId] : [];
  }

  function beatMatchesVolume(
    beat: ForeshadowingBeat,
    volumeId: string | undefined
  ): boolean {
    return Boolean(volumeId && resolveBeatVolumeIds(beat).includes(volumeId));
  }

  function beatMatchesPlotPoint(
    beat: ForeshadowingBeat,
    plotPointId: string | undefined
  ): boolean {
    return Boolean(
      plotPointId && resolveBeatArcIds(beat).includes(plotPointId)
    );
  }

  function threadMatchesScope(thread: ForeshadowingThread): boolean {
    if (props.mode === "overview") return true;
    if (props.mode === "volume") {
      return thread.beats.some((beat) =>
        beatMatchesVolume(beat, resolvedContextVolumeId.value)
      );
    }
    return thread.beats.some((beat) =>
      beatMatchesPlotPoint(beat, props.plotPointId)
    );
  }

  function derivedSpan(thread: ForeshadowingThread): PlannedSpan {
    if (thread.plannedSpan) return thread.plannedSpan;
    const volumeIds = unique(
      thread.beats.flatMap((beat) => resolveBeatVolumeIds(beat))
    );
    if (volumeIds.length > 1) return "cross_volume";
    const arcIds = unique(
      thread.beats.flatMap((beat) => resolveBeatArcIds(beat))
    );
    if (arcIds.length > 1) return "within_volume";
    return volumeIds.length === 1 && arcIds.length === 0
      ? "within_volume"
      : "local";
  }

  function volumeTitle(volumeId: string): string {
    return volumeById.value.get(volumeId)?.title ?? `缺失分卷（${volumeId}）`;
  }

  function arcTitle(arcId: string): string {
    return arcById.value.get(arcId)?.title ?? `缺失剧情点（${arcId}）`;
  }

  return {
    volumeById,
    arcById,
    resolvedContextVolumeId,
    volumeOptions,
    arcOptions,
    unique,
    resolveBeatArcIds,
    resolveBeatVolumeIds,
    beatMatchesVolume,
    beatMatchesPlotPoint,
    threadMatchesScope,
    derivedSpan,
    volumeTitle,
    arcTitle
  };
}
