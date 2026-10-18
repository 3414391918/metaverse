import { computed, onMounted, ref } from "vue";
import {
  isDeepWriteSiteOfficialModel,
  type ModelUsageDashboard,
  type ModelUsageModule,
  type ModelUsageQueryInput
} from "@deepwrite/contracts/renderer";
import { MODULE_META } from "../components/modelUsageModuleMeta";

type TimeRange = "24h" | 7 | 30 | "all";

interface RangeOption {
  id: TimeRange;
  label: string;
}

interface TrendChartPoint {
  x: number;
  y: number;
  bucketStart: string;
  value: number;
}

const RANGE_OPTIONS: readonly RangeOption[] = [
  { id: "24h", label: "近 24 小时" },
  { id: 7, label: "近 7 天" },
  { id: 30, label: "近 30 天" },
  { id: "all", label: "全部" }
];

export function useModelUsagePanel(
  props: { dashboard: ModelUsageDashboard | null },
  emit: (event: "query", input: ModelUsageQueryInput) => void
) {
  const selectedRange = ref<TimeRange>("24h");
  const CHART_WIDTH = 640;
  const CHART_HEIGHT = 136;
  const CHART_PADDING_X = 12;
  const CHART_PADDING_TOP = 12;
  const CHART_PADDING_BOTTOM = 18;

  const hasDashboard = computed(() => props.dashboard !== null);
  const isEmpty = computed(
    () => Boolean(props.dashboard) && props.dashboard!.totals.requestCount === 0
  );
  const hasModels = computed(() => Boolean(props.dashboard?.models.length));
  const showDashboard = computed(
    () => hasDashboard.value && (!isEmpty.value || hasModels.value)
  );
  const rangeLabel = computed(
    () =>
      RANGE_OPTIONS.find((option) => option.id === selectedRange.value)
        ?.label ?? "近 24 小时"
  );

  const moduleRows = computed(() =>
    (props.dashboard?.modules ?? [])
      .filter((item) => item.totals.requestCount > 0)
      .slice()
      .sort((left, right) => right.totals.totalTokens - left.totals.totalTokens)
  );
  const maxModuleTokens = computed(() =>
    Math.max(1, ...moduleRows.value.map((item) => item.totals.totalTokens))
  );

  const trendChartPoints = computed<TrendChartPoint[]>(() => {
    const trend = props.dashboard?.trend ?? [];
    if (!trend.length) return [];

    const maxValue = Math.max(
      1,
      ...trend.map((item) => item.totals.totalTokens)
    );
    const usableWidth = CHART_WIDTH - CHART_PADDING_X * 2;
    const usableHeight =
      CHART_HEIGHT - CHART_PADDING_TOP - CHART_PADDING_BOTTOM;

    return trend.map((item, index) => {
      const x =
        trend.length === 1
          ? CHART_WIDTH / 2
          : CHART_PADDING_X + (usableWidth * index) / (trend.length - 1);
      const y =
        CHART_PADDING_TOP +
        usableHeight * (1 - item.totals.totalTokens / maxValue);
      return {
        x,
        y,
        bucketStart: item.bucketStart,
        value: item.totals.totalTokens
      };
    });
  });

  const trendLinePath = computed(() => {
    const points = trendChartPoints.value;
    if (!points.length) return "";
    return points
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
      .join(" ");
  });

  const trendAreaPath = computed(() => {
    const points = trendChartPoints.value;
    if (!points.length) return "";
    const first = points[0];
    const last = points.at(-1);
    if (!first || !last) return "";
    const baseline = CHART_HEIGHT - CHART_PADDING_BOTTOM;
    const line = points
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
      .join(" ");
    return `${line} L ${last.x} ${baseline} L ${first.x} ${baseline} Z`;
  });

  const trendStartLabel = computed(
    () => trendChartPoints.value[0]?.bucketStart ?? ""
  );
  const trendEndLabel = computed(
    () =>
      trendChartPoints.value[trendChartPoints.value.length - 1]?.bucketStart ??
      ""
  );
  const trendAccessibleLabel = computed(() => {
    if (!trendChartPoints.value.length)
      return `${rangeLabel.value}暂无趋势数据`;
    return `${rangeLabel.value}模型总 Token 趋势，共 ${formatTokens(
      props.dashboard?.totals.totalTokens ?? 0
    )}`;
  });

  function createQuery(range: TimeRange): ModelUsageQueryInput {
    if (range === "all") return {};
    const endAt = new Date();
    const startAt = new Date(endAt);
    if (range === "24h") {
      startAt.setTime(endAt.getTime() - 24 * 60 * 60 * 1_000);
    } else {
      startAt.setHours(0, 0, 0, 0);
      startAt.setDate(startAt.getDate() - (range - 1));
    }
    return { startAt: startAt.toISOString(), endAt: endAt.toISOString() };
  }

  function selectRange(range: TimeRange): void {
    if (selectedRange.value === range) return;
    selectedRange.value = range;
    emit("query", createQuery(range));
  }

  function refresh(): void {
    emit("query", createQuery(selectedRange.value));
  }

  function formatTokens(value: number): string {
    const safeValue = Number.isFinite(value) ? Math.max(0, value) : 0;
    return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 }).format(
      safeValue
    );
  }

  function formatTrendBucket(value: string): string {
    const timestamp = Date.parse(value);
    if (!Number.isFinite(timestamp)) return "—";
    if (props.dashboard?.trendGranularity === "hour") {
      return new Intl.DateTimeFormat("zh-CN", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit"
      }).format(timestamp);
    }
    if (props.dashboard?.trendGranularity === "month") {
      return new Intl.DateTimeFormat("zh-CN", {
        year: "numeric",
        month: "numeric"
      }).format(timestamp);
    }
    return new Intl.DateTimeFormat("zh-CN", {
      month: "numeric",
      day: "numeric"
    }).format(timestamp);
  }

  function formatDateTime(value: string | undefined): string {
    if (!value) return "未使用";
    const timestamp = Date.parse(value);
    if (!Number.isFinite(timestamp)) return "—";
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(timestamp);
  }

  function moduleLabel(module: ModelUsageModule): string {
    return MODULE_META[module].label;
  }

  function moduleDetail(module: ModelUsageModule): string {
    return MODULE_META[module].detail;
  }

  function modulePercentage(value: number): string {
    return `${Math.max(4, Math.round((value / maxModuleTokens.value) * 100))}%`;
  }

  function modelStatusLabel(status: "current" | "historical" | "faux"): string {
    if (status === "current") return "当前配置";
    if (status === "historical") return "历史模型";
    return "本地模拟";
  }

  function modelProviderLabel(
    model: ModelUsageDashboard["models"][number]["model"]
  ): string {
    if (model.managedBy === "deepwrite-official") return "旧官方小站";
    if (isDeepWriteSiteOfficialModel(model)) return "新官方小站";
    if (model.managedBy === "deepwrite-free") return "DeepWrite 免费";
    return model.provider;
  }

  function modelBadgeLabel(
    model: ModelUsageDashboard["models"][number]["model"]
  ): string {
    const source = model.managedBy ? "D" : model.provider.trim().slice(0, 1);
    return source.toLocaleUpperCase() || "M";
  }

  function actorLabel(
    actor: ModelUsageDashboard["recentCalls"][number]["actor"]
  ): string {
    if (actor === "subagent") return "子智能体";
    if (actor === "connection-test") return "连接测试";
    return "主智能体";
  }

  function callStatusLabel(
    status: ModelUsageDashboard["recentCalls"][number]["status"]
  ): string {
    if (status === "error") return "错误";
    if (status === "aborted") return "已中止";
    return "完成";
  }

  onMounted(() => {
    emit("query", createQuery(selectedRange.value));
  });

  return {
    isEmpty,
    hasModels,
    showDashboard,
    selectedRange,
    rangeLabel,
    moduleRows,
    trendChartPoints,
    trendLinePath,
    trendAreaPath,
    trendStartLabel,
    trendEndLabel,
    trendAccessibleLabel,
    selectRange,
    refresh,
    formatTokens,
    formatTrendBucket,
    formatDateTime,
    moduleLabel,
    moduleDetail,
    modulePercentage,
    modelStatusLabel,
    modelProviderLabel,
    modelBadgeLabel,
    actorLabel,
    callStatusLabel,
    RANGE_OPTIONS,
    CHART_WIDTH,
    CHART_HEIGHT,
    CHART_PADDING_X,
    CHART_PADDING_TOP,
    CHART_PADDING_BOTTOM
  };
}
