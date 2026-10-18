<script setup lang="ts">
import { computed } from "vue";
import type { AgentSubagentRun, ChatMessage } from "../types/conversation";
import {
  subagentDuration,
  subagentProcessingDisplayItems,
  subagentRetryProgress,
  subagentRetryStatus,
  subagentReviewHint,
  subagentStatusLabel,
  subagentUsageLabel
} from "./subagentRunPresentation";
import AppIcon from "./AppIcon.vue";
import ConversationDetails from "./ConversationDetails.vue";
import ConversationRunClock from "./ConversationRunClock.vue";
import ConversationWorkGroup from "./ConversationWorkGroup.vue";
import StreamedContent from "./StreamedContent.vue";

const props = defineProps<{
  message: ChatMessage;
  runs?: AgentSubagentRun[];
}>();

const runs = computed(() => props.runs ?? props.message.subagentRuns ?? []);
</script>

<template>
  <section
    v-if="runs.length"
    class="subagent-run-list"
    aria-label="子智能体执行记录"
  >
    <ConversationDetails
      v-for="run in runs"
      :key="run.parentToolCallId"
      :detail-id="run.parentToolCallId"
      class="subagent-run-card"
      :class="`is-${run.status}`"
      :aria-busy="run.status === 'running'"
    >
      <template #summary>
        <span class="subagent-run-icon" aria-hidden="true">
          <AppIcon name="user" :size="17" />
        </span>
        <span class="subagent-run-heading">
          <span class="subagent-run-title-row">
            <strong>{{ run.name }}</strong>
            <span class="subagent-run-status" :class="`is-${run.status}`">
              <ConversationRunClock
                v-slot="{ now }"
                :active="run.status === 'running'"
              >
                {{ subagentStatusLabel(run, now) }}
              </ConversationRunClock>
            </span>
          </span>
          <span class="subagent-run-task">{{ run.task }}</span>
        </span>
        <span class="subagent-run-meta" aria-label="子任务运行摘要">
          <ConversationRunClock
            v-slot="{ now }"
            :active="run.status === 'running'"
          >
            <span v-if="subagentDuration(run, now)">{{
              subagentDuration(run, now)
            }}</span>
          </ConversationRunClock>
          <span v-if="subagentRetryProgress(run)">{{
            subagentRetryProgress(run)
          }}</span>
          <span>{{ run.toolCalls.length }} 个工具</span>
          <span v-if="subagentUsageLabel(run)" aria-label="子智能体 token 用量">
            {{ subagentUsageLabel(run) }}
          </span>
          <span v-if="subagentReviewHint(message, run)" class="is-review">
            {{ subagentReviewHint(message, run) }}
          </span>
        </span>
        <AppIcon class="subagent-run-chevron" name="chevron" :size="14" />
      </template>

      <div class="subagent-run-detail">
        <section class="subagent-run-handoff subagent-run-assigned-task">
          <strong>主智能体下发的任务</strong>
          <p>{{ run.task }}</p>
        </section>
        <ConversationRunClock
          v-slot="{ now }"
          :active="run.status === 'running'"
        >
          <div
            v-if="subagentRetryStatus(run, now)"
            class="subagent-run-waiting"
          >
            {{ subagentRetryStatus(run, now) }}
          </div>
        </ConversationRunClock>
        <div
          v-if="subagentProcessingDisplayItems(run).length"
          class="subagent-processing-list"
          aria-label="子智能体执行过程"
        >
          <template
            v-for="item in subagentProcessingDisplayItems(run)"
            :key="item.id"
          >
            <ConversationWorkGroup
              v-if="item.type === 'work-group'"
              :item="item"
              :streaming="run.status === 'running'"
              :detail-id-prefix="run.parentToolCallId"
            />
            <div
              v-else-if="item.type === 'response'"
              class="processing-step processing-response subagent-processing-response"
            >
              <StreamedContent
                :content="item.content"
                format="markdown"
                :streaming="run.status === 'running'"
              />
            </div>
          </template>
        </div>
        <div v-else-if="run.status === 'running'" class="subagent-run-waiting">
          正在启动独立上下文并接收执行事件…
        </div>

        <section
          v-if="run.summary || run.errorMessage"
          class="subagent-run-handoff"
          :class="{ 'is-error': run.status === 'error' }"
        >
          <strong>{{
            run.status === "completed" ? "交接摘要" : "结束说明"
          }}</strong>
          <StreamedContent
            v-if="run.summary"
            :content="run.summary"
            format="markdown"
          />
          <p
            v-if="run.errorMessage && !run.summary?.includes(run.errorMessage)"
          >
            {{ run.errorMessage }}
          </p>
        </section>
      </div>
    </ConversationDetails>
  </section>
</template>
