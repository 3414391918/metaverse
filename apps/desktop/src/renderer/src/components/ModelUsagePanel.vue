<script setup lang="ts">
import type {
  ModelUsageDashboard,
  ModelUsageQueryInput
} from "@deepwrite/contracts";
import AppIcon from "./AppIcon.vue";
import { useModelUsagePanel } from "../composables/useModelUsagePanel";

const props = defineProps<{
  dashboard: ModelUsageDashboard | null;
  loading: boolean;
}>();
const emit = defineEmits<{
  query: [input: ModelUsageQueryInput];
}>();
const {
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
} = useModelUsagePanel(props, emit);
</script>

<template>
  <section class="model-usage-panel" aria-labelledby="model-usage-title">
    <header class="usage-header">
      <div class="usage-heading">
        <span class="usage-kicker"
          ><AppIcon name="ledger" :size="15" /> 本地用量账本</span
        >
        <h2 id="model-usage-title">模型用量</h2>
        <p>
          查看此设备上各模型和模块的 Token 使用情况。逐次明细仅保留最近 100
          条，更早调用只保留聚合统计。
        </p>
      </div>
      <button
        type="button"
        class="usage-refresh"
        :disabled="loading"
        :aria-busy="loading"
        :aria-label="loading ? '正在刷新用量' : '刷新用量'"
        @click="refresh"
      >
        <AppIcon
          name="history"
          :size="15"
          class="usage-refresh-icon"
          :class="{ 'is-loading': loading }"
        />
        刷新
      </button>
    </header>

    <div class="usage-toolbar" role="toolbar" aria-label="用量时间范围">
      <span>时间范围</span>
      <div class="usage-range-options" role="group" aria-label="选择时间范围">
        <button
          v-for="option in RANGE_OPTIONS"
          :key="option.id"
          type="button"
          class="usage-range-option"
          :class="{ 'is-active': selectedRange === option.id }"
          :aria-pressed="selectedRange === option.id"
          @click="selectRange(option.id)"
        >
          {{ option.label }}
        </button>
      </div>
      <span v-if="dashboard" class="usage-updated-at">
        更新于 {{ formatDateTime(dashboard.generatedAt) }}
      </span>
    </div>

    <div
      v-if="loading && !dashboard"
      class="usage-state is-loading"
      aria-live="polite"
    >
      <span class="usage-spinner" aria-hidden="true" />
      <strong>正在读取本地用量…</strong>
      <p>正在汇总模型与模块的使用记录。</p>
    </div>

    <div v-else-if="!dashboard" class="usage-state">
      <AppIcon name="ledger" :size="24" />
      <strong>尚未加载用量数据</strong>
      <p>请刷新后重试。</p>
      <button type="button" class="usage-refresh" @click="refresh">
        刷新用量
      </button>
    </div>

    <div v-else-if="isEmpty && !hasModels" class="usage-state">
      <AppIcon name="sparkles" :size="24" />
      <strong>还没有模型用量</strong>
      <p>之后的模型调用会自动统计并仅保存在此设备中。</p>
    </div>

    <div v-else-if="showDashboard && dashboard" class="usage-dashboard">
      <section class="usage-summary-grid" aria-label="用量汇总">
        <article class="usage-summary-card is-total">
          <span>总 Token</span>
          <strong>{{ formatTokens(dashboard.totals.totalTokens) }}</strong>
          <small
            >{{ formatTokens(dashboard.totals.requestCount) }} 次模型请求</small
          >
        </article>
        <article class="usage-summary-card">
          <span>输入 Token</span>
          <strong>{{ formatTokens(dashboard.totals.inputTokens) }}</strong>
          <small>发送给模型的上下文</small>
        </article>
        <article class="usage-summary-card">
          <span>输出 Token</span>
          <strong>{{ formatTokens(dashboard.totals.outputTokens) }}</strong>
          <small>模型生成的内容</small>
        </article>
        <article class="usage-summary-card">
          <span>缓存 Token</span>
          <strong>{{
            formatTokens(
              dashboard.totals.cacheReadTokens +
                dashboard.totals.cacheWriteTokens
            )
          }}</strong>
          <small
            >读取 {{ formatTokens(dashboard.totals.cacheReadTokens) }} · 写入
            {{ formatTokens(dashboard.totals.cacheWriteTokens) }}</small
          >
        </article>
      </section>

      <section
        class="usage-card usage-trend-card"
        aria-labelledby="usage-trend-title"
      >
        <header class="usage-card-header">
          <div>
            <span>趋势</span>
            <h3 id="usage-trend-title">{{ rangeLabel }}总 Token</h3>
          </div>
          <strong>{{ formatTokens(dashboard.totals.totalTokens) }}</strong>
        </header>
        <div v-if="trendChartPoints.length" class="usage-trend-chart">
          <svg
            :viewBox="`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`"
            preserveAspectRatio="none"
            role="img"
            :aria-label="trendAccessibleLabel"
          >
            <title>{{ trendAccessibleLabel }}</title>
            <line
              v-for="position in [0.2, 0.5, 0.8]"
              :key="position"
              class="usage-chart-gridline"
              :x1="CHART_PADDING_X"
              :x2="CHART_WIDTH - CHART_PADDING_X"
              :y1="
                CHART_PADDING_TOP +
                (CHART_HEIGHT - CHART_PADDING_TOP - CHART_PADDING_BOTTOM) *
                  position
              "
              :y2="
                CHART_PADDING_TOP +
                (CHART_HEIGHT - CHART_PADDING_TOP - CHART_PADDING_BOTTOM) *
                  position
              "
            />
            <path class="usage-chart-area" :d="trendAreaPath" />
            <path class="usage-chart-line" :d="trendLinePath" />
            <circle
              v-for="point in trendChartPoints"
              :key="point.bucketStart"
              class="usage-chart-point"
              :cx="point.x"
              :cy="point.y"
              r="2.8"
            >
              <title>
                {{
                  `${formatTrendBucket(point.bucketStart)}：${formatTokens(point.value)} Token`
                }}
              </title>
            </circle>
          </svg>
          <div class="usage-chart-dates" aria-hidden="true">
            <span>{{ formatTrendBucket(trendStartLabel) }}</span>
            <span>{{ formatTrendBucket(trendEndLabel) }}</span>
          </div>
        </div>
        <div v-else class="usage-chart-empty">
          这个时间范围内没有可展示的趋势数据。
        </div>
      </section>

      <div class="usage-detail-grid">
        <section
          class="usage-card usage-module-card"
          aria-labelledby="usage-module-title"
        >
          <header class="usage-card-header">
            <div>
              <span>模块</span>
              <h3 id="usage-module-title">模块分布</h3>
            </div>
            <AppIcon name="sparkles" :size="17" />
          </header>
          <div v-if="moduleRows.length" class="usage-module-list">
            <div
              v-for="item in moduleRows"
              :key="item.module"
              class="usage-module-row"
            >
              <div class="usage-module-name">
                <strong>{{ moduleLabel(item.module) }}</strong>
                <small>{{ moduleDetail(item.module) }}</small>
              </div>
              <div class="usage-module-value">
                <strong>{{ formatTokens(item.totals.totalTokens) }}</strong>
                <small
                  >{{ formatTokens(item.totals.requestCount) }} 次请求</small
                >
              </div>
              <div class="usage-module-track" aria-hidden="true">
                <span
                  :style="{ width: modulePercentage(item.totals.totalTokens) }"
                />
              </div>
            </div>
          </div>
          <p v-else class="usage-inline-empty">这个时间范围内尚无模块用量。</p>
        </section>

        <section
          class="usage-card usage-model-card"
          aria-labelledby="usage-model-title"
        >
          <header class="usage-card-header">
            <div>
              <span>模型</span>
              <h3 id="usage-model-title">模型状态</h3>
            </div>
            <AppIcon name="model" :size="17" />
          </header>
          <div class="usage-model-table-wrap">
            <table class="usage-model-table">
              <thead>
                <tr>
                  <th scope="col">模型</th>
                  <th scope="col">状态</th>
                  <th scope="col">总 Token</th>
                  <th scope="col">调用</th>
                  <th scope="col">最近使用</th>
                </tr>
              </thead>
              <tbody v-if="dashboard.models.length">
                <tr
                  v-for="item in dashboard.models"
                  :key="`${item.model.configId}:${item.model.revisionId}`"
                >
                  <td>
                    <div class="usage-model-identity">
                      <span class="usage-model-badge" aria-hidden="true">{{
                        modelBadgeLabel(item.model)
                      }}</span>
                      <span>
                        <strong>{{ item.model.label }}</strong>
                        <small
                          >{{ modelProviderLabel(item.model) }} ·
                          {{ item.model.modelId }}</small
                        >
                      </span>
                    </div>
                  </td>
                  <td>
                    <span
                      class="usage-model-status"
                      :class="`is-${item.status}`"
                    >
                      <i aria-hidden="true" />{{
                        modelStatusLabel(item.status)
                      }}
                    </span>
                  </td>
                  <td>
                    <strong>{{ formatTokens(item.totals.totalTokens) }}</strong>
                    <small
                      >入 {{ formatTokens(item.totals.inputTokens) }} · 出
                      {{ formatTokens(item.totals.outputTokens) }}</small
                    >
                  </td>
                  <td>{{ formatTokens(item.totals.requestCount) }}</td>
                  <td>
                    <time v-if="item.lastUsedAt" :datetime="item.lastUsedAt">
                      {{ formatDateTime(item.lastUsedAt) }}
                    </time>
                    <span v-else class="usage-model-unused">未使用</span>
                  </td>
                </tr>
              </tbody>
              <tbody v-else>
                <tr>
                  <td colspan="5" class="usage-table-empty">
                    这个时间范围内尚无模型记录。
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section
        class="usage-card usage-recent-card"
        aria-labelledby="usage-recent-title"
      >
        <header class="usage-card-header">
          <div>
            <span>调用明细</span>
            <h3 id="usage-recent-title">最近实际调用</h3>
          </div>
          <small
            >显示 {{ dashboard.recentCalls.length }} 条 · 本地最多保留 100
            条</small
          >
        </header>
        <div class="usage-model-table-wrap">
          <table class="usage-model-table usage-recent-table">
            <thead>
              <tr>
                <th scope="col">时间</th>
                <th scope="col">模型</th>
                <th scope="col">模块</th>
                <th scope="col">调用方</th>
                <th scope="col">状态</th>
                <th scope="col">Token</th>
              </tr>
            </thead>
            <tbody v-if="dashboard.recentCalls.length">
              <tr
                v-for="(call, index) in dashboard.recentCalls"
                :key="`${call.occurredAt}:${call.model.configId}:${index}`"
              >
                <td>
                  <time :datetime="call.occurredAt">{{
                    formatDateTime(call.occurredAt)
                  }}</time>
                </td>
                <td>
                  <strong>{{ call.model.label }}</strong>
                  <small
                    >{{ modelProviderLabel(call.model) }} ·
                    {{ call.model.modelId }}</small
                  >
                </td>
                <td>{{ moduleLabel(call.module) }}</td>
                <td>{{ actorLabel(call.actor) }}</td>
                <td>
                  <span class="usage-call-status" :class="`is-${call.status}`">
                    {{ callStatusLabel(call.status) }}
                  </span>
                </td>
                <td>
                  <strong>{{ formatTokens(call.usage.totalTokens) }}</strong>
                  <small>
                    入 {{ formatTokens(call.usage.inputTokens) }} · 出
                    {{ formatTokens(call.usage.outputTokens) }} · 缓存
                    {{
                      formatTokens(
                        call.usage.cacheReadTokens + call.usage.cacheWriteTokens
                      )
                    }}
                  </small>
                </td>
              </tr>
            </tbody>
            <tbody v-else>
              <tr>
                <td colspan="6" class="usage-table-empty">
                  尚无实际模型调用明细。
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped src="./model-usage-panel.css"></style>
