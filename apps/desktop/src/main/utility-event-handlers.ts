import {
  createEnvelope,
  SystemEventEnvelopeSchema,
  type SystemEventEnvelope,
  type UtilityWorkerName
} from "@deepwrite/contracts";
import { createId, nowIso } from "@deepwrite/shared";
import type { ActiveRun } from "./ipc/command-types";
import type { ModelUsageStore } from "./model-usage-store";
import {
  recordUsageObservation as persistUsageObservation,
  type UsageRunContext
} from "./usage-observation";
export function createUtilityEventHandlers(options: {
  activeRuns: Map<string, ActiveRun>;
  terminalRuns: Set<string>;
  pendingUsageContexts: Map<string, UsageRunContext>;
  getModelUsageStore: () => ModelUsageStore | undefined;
  getSmokeEventTap: () => ((event: SystemEventEnvelope) => void) | undefined;
  broadcastEvent: (event: SystemEventEnvelope) => void;
}) {
  const { activeRuns, terminalRuns, pendingUsageContexts, broadcastEvent } =
    options;
  type AgentEventEnvelope = Extract<
    SystemEventEnvelope,
    {
      type:
        | "agent.evaluation_snapshot"
        | "agent.turn_started"
        | "agent.retry_scheduled"
        | "agent.message_delta"
        | "agent.thinking_delta"
        | "agent.message_completed"
        | "agent.usage_observed"
        | "agent.error"
        | "agent.user_input_requested"
        | "tool.call_stream"
        | "tool.call_requested"
        | "tool.execution_completed"
        | "subagent_authoring.draft_updated"
        | "library.editor_mutation"
        | "long.mutation_proposal"
        | "long.chapter_write_proposal"
        | "long.ledger_commit_proposal"
        | "subagent.started"
        | "subagent.activity"
        | "subagent.completed";
    }
  >;
  function isAgentEvent(
    event: SystemEventEnvelope
  ): event is AgentEventEnvelope {
    return (
      event.type === "agent.evaluation_snapshot" ||
      event.type === "agent.turn_started" ||
      event.type === "agent.retry_scheduled" ||
      event.type === "agent.message_delta" ||
      event.type === "agent.thinking_delta" ||
      event.type === "agent.message_completed" ||
      event.type === "agent.usage_observed" ||
      event.type === "agent.error" ||
      event.type === "agent.user_input_requested" ||
      event.type === "tool.call_stream" ||
      event.type === "tool.call_requested" ||
      event.type === "tool.execution_completed" ||
      event.type === "subagent_authoring.draft_updated" ||
      event.type === "library.editor_mutation" ||
      event.type === "long.mutation_proposal" ||
      event.type === "long.chapter_write_proposal" ||
      event.type === "long.ledger_commit_proposal" ||
      event.type === "subagent.started" ||
      event.type === "subagent.activity" ||
      event.type === "subagent.completed"
    );
  }
  function rememberTerminalRun(runId: string): void {
    terminalRuns.add(runId);
    while (terminalRuns.size > 2000) {
      const oldest = terminalRuns.values().next().value as string | undefined;
      if (!oldest) {
        return;
      }
      terminalRuns.delete(oldest);
    }
  }
  function recordUsageObservation(
    event: Extract<SystemEventEnvelope, { type: "agent.usage_observed" }>
  ): void {
    persistUsageObservation(
      event,
      options.getModelUsageStore(),
      activeRuns,
      pendingUsageContexts
    );
  }
  function handleUtilityEvent(
    event: SystemEventEnvelope,
    worker: UtilityWorkerName
  ): void {
    if (isAgentEvent(event) && worker !== "agent") {
      return;
    }
    const validated = SystemEventEnvelopeSchema.parse(
      event
    ) as SystemEventEnvelope;
    if (validated.type === "agent.usage_observed") {
      recordUsageObservation(validated);
      return;
    }
    if (isAgentEvent(validated)) {
      const runId = validated.payload.runId;
      if (
        validated.type === "agent.message_completed" ||
        validated.type === "agent.error"
      ) {
        const activeRun = activeRuns.get(runId);
        rememberTerminalRun(runId);
        activeRuns.delete(runId);
        pendingUsageContexts.delete(
          activeRun?.correlationId ?? validated.context.correlationId
        );
      } else if (!terminalRuns.has(runId) && !activeRuns.has(runId)) {
        const usageContext = pendingUsageContexts.get(
          validated.context.correlationId
        );
        activeRuns.set(runId, {
          sessionId: validated.payload.sessionId,
          correlationId: validated.context.correlationId,
          runtime: validated.payload.runtime,
          accepted: false,
          ...(usageContext ? { usageContext } : {})
        });
      }
    }
    options.getSmokeEventTap()?.(validated);
    broadcastEvent(validated);
  }
  function handleUnexpectedExit(
    worker: UtilityWorkerName,
    reason: string
  ): void {
    if (worker === "agent") {
      for (const [runId, run] of activeRuns) {
        const event = SystemEventEnvelopeSchema.parse(
          createEnvelope(
            "agent.error",
            {
              sessionId: run.sessionId,
              runId,
              code: "agent.utility_exited",
              message: "Agent Utility 意外退出，本轮对话已终止。",
              details: { reason },
              runtime: run.runtime
            },
            {
              id: createId("evt"),
              context: {
                correlationId: run.correlationId,
                sessionId: run.sessionId,
                runId
              }
            }
          )
        ) as SystemEventEnvelope;
        rememberTerminalRun(runId);
        options.getSmokeEventTap()?.(event);
        broadcastEvent(event);
      }
      activeRuns.clear();
      pendingUsageContexts.clear();
    }
    broadcastEvent(
      SystemEventEnvelopeSchema.parse(
        createEnvelope(
          "system.worker_restarting",
          { worker, reason, detectedAt: nowIso() },
          { id: createId("evt_restarting") }
        )
      ) as SystemEventEnvelope
    );
  }
  function handleWorkerRestarted(
    worker: UtilityWorkerName,
    reason: string
  ): void {
    broadcastEvent(
      SystemEventEnvelopeSchema.parse(
        createEnvelope(
          "system.worker_restarted",
          { worker, reason, restartedAt: nowIso() },
          { id: createId("evt_restarted") }
        )
      ) as SystemEventEnvelope
    );
  }

  return {
    handleUtilityEvent,
    handleUnexpectedExit,
    handleWorkerRestarted,
    recordUsageObservation
  };
}
