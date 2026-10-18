import { toolResultEvents } from "./tool-result-events";
import type {
  AgentRuntimeRef,
  AgentUsage,
  AgentUsageObservationStatus
} from "@deepwrite/contracts";
import type { AgentEvent, AgentMessage } from "@earendil-works/pi-agent-core";
import type { AssistantMessage, Usage } from "@earendil-works/pi-ai";
import type { AgentTurnAttempt } from "./agent-turn-retry";
import type { AgentRunInput, AgentRuntimeEvent } from "./runtime-types";
import { toSubagentRuntimeEvents } from "./subagent-events";
import { isSubagentToolProgressDetails } from "./subagent-runtime";
import type { ToolCallAssistantEvent } from "./tool-stream";

/** @internal Exported for protocol regression tests. */
export function toToolStreamRuntimeEvent(
  streamEvent: ToolCallAssistantEvent,
  input: AgentRunInput,
  runtime: AgentRuntimeRef,
  messageId: string,
  assistantTurnIndex: number
): Extract<AgentRuntimeEvent, { type: "agent.tool_stream" }> {
  const content = streamEvent.partial.content[streamEvent.contentIndex];
  const toolCall = content?.type === "toolCall" ? content : undefined;
  const argumentsSnapshot = toolCallArgumentsSnapshot(streamEvent, toolCall);
  const phase =
    streamEvent.type === "toolcall_start"
      ? "start"
      : streamEvent.type === "toolcall_delta"
        ? "delta"
        : "end";
  return {
    type: "agent.tool_stream",
    runId: input.runId,
    sessionId: input.sessionId,
    payload: {
      streamId: `${messageId}:${assistantTurnIndex}:${streamEvent.contentIndex}`,
      ...(toolCall?.id ? { toolCallId: toolCall.id } : {}),
      ...(toolCall?.name ? { toolName: toolCall.name } : {}),
      phase,
      argumentsDelta:
        streamEvent.type === "toolcall_delta" ? streamEvent.delta : "",
      ...(argumentsSnapshot !== undefined ? { argumentsSnapshot } : {}),
      ...(streamEvent.type === "toolcall_end"
        ? { args: streamEvent.toolCall.arguments }
        : {}),
      runtime
    }
  };
}

export function serializedToolArguments(value: unknown): string | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  if (Object.keys(value).length === 0) {
    return undefined;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return undefined;
  }
}

/** @internal Exported for protocol regression tests. */
export function toolCallArgumentsSnapshot(
  streamEvent: ToolCallAssistantEvent,
  toolCall:
    | Extract<AssistantMessage["content"][number], { type: "toolCall" }>
    | undefined
): string | undefined {
  const providerToolCall = toolCall as
    | (typeof toolCall & { partialJson?: unknown; partialArgs?: unknown })
    | undefined;
  for (const candidate of [
    providerToolCall?.partialJson,
    providerToolCall?.partialArgs
  ]) {
    if (typeof candidate === "string" && candidate.length > 0) {
      return candidate;
    }
  }
  if (streamEvent.type === "toolcall_end") {
    return serializedToolArguments(streamEvent.toolCall.arguments);
  }
  if (streamEvent.type === "toolcall_start") {
    return serializedToolArguments(toolCall?.arguments);
  }
  return undefined;
}

/** @internal Exported for protocol regression tests. */
export function reconcileToolCallArguments(
  current: string,
  incomingDelta: string,
  snapshot?: string
): { delta: string; next: string } {
  let delta = incomingDelta;
  if (snapshot !== undefined) {
    if (snapshot.startsWith(current)) {
      delta = snapshot.slice(current.length);
    } else if (current.startsWith(snapshot)) {
      delta = "";
    } else if (!current) {
      delta = snapshot;
    }
  }
  return { delta, next: `${current}${delta}` };
}

/**
 * Converts one raw assistant terminal message into the internal accounting
 * event. This runs outside `toRuntimeEvents` because retryable failures are
 * intentionally withheld from the presentation event stream.
 *
 * @internal Exported for accounting protocol regression tests.
 */
export function toUsageObservedRuntimeEvent(
  message: AssistantMessage,
  input: AgentRunInput,
  runtime: AgentRuntimeRef,
  messageId: string,
  attempt: AgentTurnAttempt
): Extract<AgentRuntimeEvent, { type: "agent.usage_observed" }> | undefined {
  const usage = normalizeUsage(message.usage);
  if (!usage) return undefined;
  const status: AgentUsageObservationStatus =
    message.stopReason === "aborted"
      ? "aborted"
      : message.stopReason === "error" || message.errorMessage
        ? "error"
        : "completed";
  return {
    type: "agent.usage_observed",
    runId: input.runId,
    sessionId: input.sessionId,
    payload: {
      observationId: `${attempt.turnId}:attempt:${attempt.attempt}`,
      observedAt: new Date().toISOString(),
      messageId,
      turnId: attempt.turnId,
      attempt: attempt.attempt,
      status,
      hadToolCall: message.content.some((item) => item.type === "toolCall"),
      usage,
      runtime
    }
  };
}

/** @internal Exported for runtime event contract tests. */
export function toRuntimeEvents(
  event: AgentEvent,
  input: AgentRunInput,
  runtime: AgentRuntimeRef,
  messageId: string
): AgentRuntimeEvent[] {
  if (event.type === "tool_execution_update") {
    const details = (event.partialResult as { details?: unknown } | undefined)
      ?.details;
    if (isSubagentToolProgressDetails(details)) {
      return toSubagentRuntimeEvents(
        details.progress,
        input,
        runtime,
        messageId
      );
    }
    return [];
  }

  if (event.type === "tool_execution_start") {
    return [
      {
        type: "agent.tool_requested",
        runId: input.runId,
        sessionId: input.sessionId,
        payload: {
          toolCallId: event.toolCallId,
          toolName: event.toolName,
          args: event.args,
          runtime
        }
      }
    ];
  }

  if (event.type === "tool_execution_end") {
    const events: AgentRuntimeEvent[] = [
      {
        type: "agent.tool_completed",
        runId: input.runId,
        sessionId: input.sessionId,
        payload: {
          toolCallId: event.toolCallId,
          toolName: event.toolName,
          resultSummary: summarizeToolResult(event.result),
          isError: event.isError,
          runtime
        }
      }
    ];
    events.push(...toolResultEvents(event, input, runtime));
    return events;
  }

  if (event.type === "message_update" && isAssistantMessage(event.message)) {
    const streamEvent = event.assistantMessageEvent;
    if (streamEvent.type === "text_delta") {
      return [
        {
          type: "agent.delta",
          runId: input.runId,
          sessionId: input.sessionId,
          payload: { messageId, delta: streamEvent.delta, runtime }
        }
      ];
    }
    if (streamEvent.type === "thinking_delta") {
      return [
        {
          type: "agent.thinking_delta",
          runId: input.runId,
          sessionId: input.sessionId,
          payload: { messageId, delta: streamEvent.delta, runtime }
        }
      ];
    }
  }

  if (event.type === "message_end" && isAssistantMessage(event.message)) {
    if (
      event.message.stopReason === "error" ||
      event.message.stopReason === "aborted" ||
      event.message.errorMessage
    ) {
      return [
        {
          type: "agent.error",
          runId: input.runId,
          sessionId: input.sessionId,
          payload: {
            code:
              event.message.stopReason === "aborted"
                ? "pi_agent.aborted"
                : "pi_agent.provider_error",
            message:
              event.message.errorMessage ??
              (event.message.stopReason === "aborted"
                ? "智能体运行已中止。"
                : "模型返回错误终态。"),
            runtime
          }
        }
      ];
    }

    if (event.message.content.some((item) => item.type === "toolCall")) {
      return [];
    }

    const thinking = readAssistantThinking(event.message);
    const usage = normalizeUsage(event.message.usage);
    return [
      {
        type: "agent.completed",
        runId: input.runId,
        sessionId: input.sessionId,
        payload: {
          messageId,
          content: readAssistantText(event.message),
          ...(thinking ? { thinking } : {}),
          ...(event.message.stopReason
            ? { stopReason: event.message.stopReason }
            : {}),
          ...(usage ? { usage } : {}),
          runtime
        }
      }
    ];
  }

  return [];
}

export function isAssistantMessage(
  message: AgentMessage
): message is AssistantMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    message.role === "assistant"
  );
}

export function readAssistantText(message: AssistantMessage): string {
  return message.content
    .filter((item) => item.type === "text")
    .map((item) => item.text)
    .join("");
}

export function readAssistantThinking(message: AssistantMessage): string {
  return message.content
    .filter((item) => item.type === "thinking")
    .map((item) => item.thinking)
    .join("\n\n");
}

export function summarizeToolResult(result: unknown): string {
  if (typeof result === "object" && result !== null && "content" in result) {
    const content = (result as { content?: unknown }).content;
    if (Array.isArray(content)) {
      const text = content
        .filter(
          (item): item is { type: "text"; text: string } =>
            typeof item === "object" &&
            item !== null &&
            "type" in item &&
            item.type === "text" &&
            "text" in item &&
            typeof item.text === "string"
        )
        .map((item) => item.text)
        .join("\n");
      if (text) {
        return text.slice(0, 4_000);
      }
    }
  }
  if (result === undefined || result === null) {
    return "工具执行完成。";
  }
  try {
    const summary = JSON.stringify(result);
    return summary ? summary.slice(0, 4_000) : "工具执行完成。";
  } catch {
    return "工具已执行完成。";
  }
}

export function normalizeUsage(
  usage: Usage | undefined
): AgentUsage | undefined {
  if (!usage) return undefined;
  const values = [
    usage.input,
    usage.output,
    usage.cacheRead,
    usage.cacheWrite,
    usage.totalTokens
  ];
  if (values.some((value) => !Number.isSafeInteger(value) || value < 0)) {
    return undefined;
  }
  return {
    inputTokens: usage.input,
    outputTokens: usage.output,
    cacheReadTokens: usage.cacheRead,
    cacheWriteTokens: usage.cacheWrite,
    totalTokens: usage.totalTokens
  };
}
