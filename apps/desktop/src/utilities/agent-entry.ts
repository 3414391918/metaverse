import { toEventEnvelope } from "./agent-event-envelope";
import {
  ModelCapacityResultSchema,
  ModelConnectionTestResultSchema,
  SessionAbortAcceptedPayloadSchema,
  SessionUserInputResponseAcceptedPayloadSchema,
  SessionPromptAcceptedPayloadSchema,
  createEnvelope,
  type CommandResult,
  type SystemEventEnvelope
} from "@deepwrite/contracts";
import {
  PiAgentRuntimeAdapter,
  UserInputResolutionError
} from "@deepwrite/pi-runtime-adapter";
import { createId, nowIso } from "@deepwrite/shared";
import { createAgentRunInput } from "./agent-run-input";
import { bootUtility } from "./runtime";

const runtime = new PiAgentRuntimeAdapter({
  evaluationMode: process.env.DEEPWRITE_APP_MODE === "evaluation"
});
const activeStreams = new Set<Promise<void>>();
const terminalRuns = new Set<string>();
const activeSessionRuns = new Map<string, string>();
const abortControllers = new Map<string, AbortController>();
const MAX_ACTIVE_RUNS = 4;

function streamPrompt(
  input: Parameters<PiAgentRuntimeAdapter["start"]>[0],
  correlationId: string,
  emitEvent: (event: SystemEventEnvelope) => void,
  _controller: AbortController
): void {
  const stream = (async () => {
    try {
      for await (const event of runtime.start(input)) {
        if (terminalRuns.has(input.runId)) {
          continue;
        }
        emitEvent(toEventEnvelope(event, correlationId));
        if (event.type === "agent.completed" || event.type === "agent.error") {
          terminalRuns.add(input.runId);
        }
      }
    } catch (error: unknown) {
      if (!terminalRuns.has(input.runId)) {
        terminalRuns.add(input.runId);
        emitEvent(
          createEnvelope(
            "agent.error",
            {
              sessionId: input.sessionId,
              runId: input.runId,
              code: "agent.stream_failed",
              message:
                error instanceof Error ? error.message : "Agent stream failed.",
              details: {
                kind: error instanceof Error ? error.name : "unknown"
              },
              runtime: runtime.describe(input.runtimeConfig)
            },
            {
              id: createId("evt"),
              context: {
                correlationId,
                sessionId: input.sessionId,
                runId: input.runId
              }
            }
          )
        );
      }
    } finally {
      terminalRuns.delete(input.runId);
      abortControllers.delete(input.runId);
      if (activeSessionRuns.get(input.sessionId) === input.runId) {
        activeSessionRuns.delete(input.sessionId);
      }
    }
  })();

  activeStreams.add(stream);
  void stream.then(
    () => activeStreams.delete(stream),
    () => activeStreams.delete(stream)
  );
}

bootUtility("agent", {
  mode: "pi-agent-provider",
  async commandHandler(command, emitEvent, context): Promise<CommandResult> {
    if (command.type === "agent.model_test") {
      const result = ModelConnectionTestResultSchema.parse(
        await runtime.testConnection(command.payload.runtimeConfig)
      );
      return {
        status: "accepted",
        requestId: command.id,
        payload: result
      };
    }

    if (command.type === "agent.model_capacity") {
      return {
        status: "accepted",
        requestId: command.id,
        payload: ModelCapacityResultSchema.parse(
          runtime.resolveModelCapacity(command.payload.runtimeConfig)
        )
      };
    }

    if (command.type === "agent.abort") {
      const activeRunId = activeSessionRuns.get(command.payload.sessionId);
      const controller = abortControllers.get(command.payload.runId);
      if (activeRunId !== command.payload.runId || !controller) {
        return {
          status: "rejected",
          requestId: command.id,
          error: {
            code: "agent.run_not_active",
            message: "要停止的智能体运行已结束或不存在。"
          }
        };
      }
      controller.abort();
      return {
        status: "accepted",
        requestId: command.id,
        payload: SessionAbortAcceptedPayloadSchema.parse({
          sessionId: command.payload.sessionId,
          runId: command.payload.runId,
          abortedAt: nowIso()
        })
      };
    }

    if (command.type === "agent.user_input_response") {
      const activeRunId = activeSessionRuns.get(command.payload.sessionId);
      if (activeRunId !== command.payload.runId) {
        return {
          status: "rejected",
          requestId: command.id,
          error: {
            code: "agent.run_not_active",
            message: "要回答的智能体运行已结束或不存在。"
          }
        };
      }
      try {
        return {
          status: "accepted",
          requestId: command.id,
          payload: SessionUserInputResponseAcceptedPayloadSchema.parse(
            runtime.resolveUserInput(command.payload)
          )
        };
      } catch (error: unknown) {
        return {
          status: "rejected",
          requestId: command.id,
          error: {
            code:
              error instanceof UserInputResolutionError
                ? error.code
                : "agent.user_input_response_failed",
            message:
              error instanceof Error ? error.message : "提交用户回答失败。"
          }
        };
      }
    }

    if (command.type !== "agent.prompt") {
      return {
        status: "rejected",
        requestId: command.id,
        error: {
          code: "agent.unsupported_command",
          message: `Agent utility does not support ${command.type}.`
        }
      };
    }

    const activeRunId = activeSessionRuns.get(command.payload.sessionId);
    if (activeRunId) {
      return {
        status: "rejected",
        requestId: command.id,
        error: {
          code: "agent.session_busy",
          message: "当前会话已有一轮智能体运行尚未结束。",
          details: { activeRunId }
        }
      };
    }
    if (activeStreams.size >= MAX_ACTIVE_RUNS) {
      return {
        status: "rejected",
        requestId: command.id,
        error: {
          code: "agent.capacity_reached",
          message: "本地智能体并发运行数量已达到上限。"
        }
      };
    }

    const runId = createId("run");
    const correlationId = command.context.correlationId;
    const runtimeRef = runtime.describe(command.payload.runtimeConfig);
    const accepted = SessionPromptAcceptedPayloadSchema.parse({
      sessionId: command.payload.sessionId,
      runId,
      acceptedAt: nowIso(),
      runtime: runtimeRef
    });
    const controller = new AbortController();
    activeSessionRuns.set(command.payload.sessionId, runId);
    abortControllers.set(runId, controller);

    streamPrompt(
      createAgentRunInput(command.payload, runId, controller.signal, context),
      correlationId,
      emitEvent,
      controller
    );

    return {
      status: "accepted",
      requestId: command.id,
      payload: accepted
    };
  },
  async onShutdown(): Promise<void> {
    for (const controller of abortControllers.values()) {
      controller.abort();
    }
    if (activeStreams.size === 0) {
      return;
    }
    await Promise.race([
      Promise.allSettled([...activeStreams]),
      new Promise<void>((resolve) => setTimeout(resolve, 1_000))
    ]);
  }
});
