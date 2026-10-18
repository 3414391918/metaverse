import type { AgentRuntimeEvent } from "./runtime-types";
import { reconcileToolCallArguments } from "./event-mapping";
const TOOL_STREAM_DELTA_FLUSH_MS = 100;
export function createRunToolStream(emit: (event: AgentRuntimeEvent) => void) {
  const pendingToolDeltas = new Map<
    string,
    Extract<AgentRuntimeEvent, { type: "agent.tool_stream" }>
  >();
  const streamedToolArguments = new Map<string, string>();
  let toolDeltaTimer: NodeJS.Timeout | undefined;

  const flushToolDeltas = (): void => {
    if (toolDeltaTimer) {
      clearTimeout(toolDeltaTimer);
      toolDeltaTimer = undefined;
    }
    for (const event of pendingToolDeltas.values()) emit(event);
    pendingToolDeltas.clear();
  };

  const discardAttemptToolDeltas = (): void => {
    if (toolDeltaTimer) {
      clearTimeout(toolDeltaTimer);
      toolDeltaTimer = undefined;
    }
    pendingToolDeltas.clear();
    streamedToolArguments.clear();
  };

  const emitStreamedToolEvent = (
    event: Extract<AgentRuntimeEvent, { type: "agent.tool_stream" }>
  ): void => {
    const currentArguments =
      streamedToolArguments.get(event.payload.streamId) ?? "";
    const normalized = reconcileToolCallArguments(
      currentArguments,
      event.payload.argumentsDelta,
      event.payload.argumentsSnapshot
    );
    event.payload.argumentsDelta = normalized.delta;
    delete event.payload.argumentsSnapshot;
    streamedToolArguments.set(event.payload.streamId, normalized.next);
    if (event.payload.phase !== "delta") {
      flushToolDeltas();
      emit(event);
      return;
    }
    const existing = pendingToolDeltas.get(event.payload.streamId);
    if (existing) {
      existing.payload.argumentsDelta += event.payload.argumentsDelta;
      if (event.payload.toolCallId)
        existing.payload.toolCallId = event.payload.toolCallId;
      if (event.payload.toolName)
        existing.payload.toolName = event.payload.toolName;
    } else {
      pendingToolDeltas.set(event.payload.streamId, event);
    }
    if (!toolDeltaTimer) {
      toolDeltaTimer = setTimeout(flushToolDeltas, TOOL_STREAM_DELTA_FLUSH_MS);
      toolDeltaTimer.unref();
    }
  };

  return {
    emitStreamedToolEvent,
    discardAttemptToolDeltas,
    dispose: discardAttemptToolDeltas
  };
}
