import { createRunUserInputRequester } from "./run-user-input";
import { Agent } from "@earendil-works/pi-agent-core";
import type { UserMessage } from "@earendil-works/pi-ai";
import { isRetryableAssistantError } from "@earendil-works/pi-ai";
import type { AgentRuntimeRef } from "@deepwrite/contracts";
import { AsyncEventQueue } from "./async-event-queue";
import { prepareRunModel } from "./run-model";
import { prepareConversationAgent } from "./run-conversation";
import { createRunToolStream } from "./run-tool-stream";
import { createRunEvaluationEmitter } from "./run-evaluation";
import { buildRunTools } from "./run-tools";
import { libraryManagementParentPrompt } from "./library-management-runtime";
import {
  isAssistantMessage,
  toRuntimeEvents,
  toToolStreamRuntimeEvent,
  toUsageObservedRuntimeEvent
} from "./event-mapping";
import {
  selectConversationAgentForRun,
  conversationAgentKey
} from "./conversation-agent-rebuild";
import {
  buildEffectiveSystemPrompt,
  buildRunUserMessageContent
} from "./prompts";
import { resolvePortableToolSchemaProfile } from "./portable-tool-schema";
import { RunLifecycle } from "./run-lifecycle";
import { AgentUserInputBroker } from "./user-input-broker";
import {
  runAgentWithTurnRetries,
  type AgentTurnRetryPolicyOptions
} from "./agent-turn-retry";
import {
  interceptToolCallStream,
  type ToolCallAssistantEvent
} from "./tool-stream";
import type { AgentToolExecutionHooks } from "./subagent-runtime";
import type { AgentRunInput, AgentRuntimeEvent } from "./runtime-types";
export interface RuntimeRunOptions {
  idleTimeoutMs: number;
  subagentTimeoutMs: number | undefined;
  tokensPerSecond: number;
  systemPrompt: string;
  evaluationMode: boolean;
  retryPolicy: AgentTurnRetryPolicyOptions | undefined;
  toolExecutionHooks: AgentToolExecutionHooks;
  conversationAgents: Map<string, Agent>;
  userInputBroker: AgentUserInputBroker;
  runtime: AgentRuntimeRef;
}
export class RuntimeRun {
  constructor(private readonly options: RuntimeRunOptions) {}
  async *start(input: AgentRunInput): AsyncIterable<AgentRuntimeEvent> {
    const queue = new AsyncEventQueue<AgentRuntimeEvent>();
    const runtime = this.options.runtime;
    const messageId = `${input.runId}_assistant`;
    const agentKey = conversationAgentKey(input);
    const reusableConversationAgent = selectConversationAgentForRun(
      this.options.conversationAgents,
      agentKey,
      input.conversationHistoryMode
    );
    const portableToolSchemaProfile = resolvePortableToolSchemaProfile(
      input.workspaceContext
    );
    const lifecycle = new RunLifecycle();
    const requestUserInput = createRunUserInputRequester(
      input,
      runtime,
      this.options.userInputBroker,
      (event) => emit(event),
      (delta) => {
        userInputWaiting = Math.max(0, userInputWaiting + delta);
        if (delta > 0) lifecycle.clearIdleTimer();
        else if (userInputWaiting === 0) scheduleIdleTimeout();
      }
    );
    const { model, streamFn, spawnStreamFn, effectiveThinkingLevel } =
      prepareRunModel(
        input,
        runtime,
        portableToolSchemaProfile,
        this.options.tokensPerSecond
      );
    const systemPrompt = [
      buildEffectiveSystemPrompt(this.options.systemPrompt, input),
      libraryManagementParentPrompt(input)
    ]
      .filter(Boolean)
      .join("\n\n");
    let agent = reusableConversationAgent;
    const tools = buildRunTools(input, {
      model,
      thinkingLevel: effectiveThinkingLevel,
      streamFn: spawnStreamFn,
      parentRuntime: runtime,
      parentSignal: lifecycle.signal,
      requestUserInput,
      portableToolSchemaProfile,
      toolExecutionHooks: this.options.toolExecutionHooks,
      ...(this.options.retryPolicy
        ? { retryPolicy: this.options.retryPolicy }
        : {}),
      ...(this.options.subagentTimeoutMs === undefined
        ? {}
        : { subagentTimeoutMs: this.options.subagentTimeoutMs }),
      getParentMessages: () => agent?.state.messages ?? []
    });
    let emitToolCallEvent: (
      event: ToolCallAssistantEvent,
      assistantTurnIndex: number
    ) => void = () => {};
    const interceptedStreamFn = interceptToolCallStream(
      streamFn,
      (event, assistantTurnIndex) =>
        emitToolCallEvent(event, assistantTurnIndex)
    );
    const prepared = prepareConversationAgent(
      input,
      this.options.conversationAgents,
      agentKey,
      agent,
      model,
      tools,
      systemPrompt,
      effectiveThinkingLevel,
      interceptedStreamFn,
      this.options.toolExecutionHooks
    );
    agent = prepared.agent;
    const createdAgent = prepared.createdAgent;

    let settled = false;
    let terminalEmitted = false;
    let evaluationSnapshotEmitter: (() => void) | undefined;
    let modelRequestInFlight = false;
    let retryWaiting = false;
    let userInputWaiting = 0;
    let idleModelRequestTimedOut = false;
    let currentTurnAttempt = 0;
    let currentTurnMaxAttempts = 1;
    let scheduleIdleTimeout = (): void => {};
    const retryWaitController = new AbortController();
    const emit = (event: AgentRuntimeEvent): void => {
      const terminal =
        event.type === "agent.completed" || event.type === "agent.error";
      if (terminalEmitted && event.type !== "agent.evaluation_snapshot") {
        return;
      }
      for (const childTerminal of lifecycle.observe(event)) {
        queue.push(childTerminal);
      }
      if (terminal) terminalEmitted = true;
      queue.push(event);
      if (!terminal && !terminalEmitted) {
        scheduleIdleTimeout();
      }
    };

    const toolStream = createRunToolStream(emit);
    emitToolCallEvent = (event, assistantTurnIndex) => {
      toolStream.emitStreamedToolEvent(
        toToolStreamRuntimeEvent(
          event,
          input,
          runtime,
          messageId,
          assistantTurnIndex
        )
      );
    };

    const cleanup = (): void => {
      if (settled) {
        return;
      }
      settled = true;
      lifecycle.clearIdleTimer();
      toolStream.dispose();
      lifecycle.dispose();
      this.options.userInputBroker.cancelRun(input.runId);
      retryWaitController.abort();
      queue.close();
    };

    lifecycle.bindAbort(input.signal, () => {
      idleModelRequestTimedOut = false;
      retryWaitController.abort();
      agent.abort();
      emit({
        type: "agent.error",
        runId: input.runId,
        sessionId: input.sessionId,
        payload: {
          code: "pi_agent.aborted",
          message: "智能体运行已中止。",
          runtime
        }
      });
      cleanup();
    });

    scheduleIdleTimeout = (): void => {
      if (
        settled ||
        terminalEmitted ||
        retryWaiting ||
        userInputWaiting > 0 ||
        this.options.idleTimeoutMs <= 0
      ) {
        return;
      }
      lifecycle.scheduleIdleTimeout(this.options.idleTimeoutMs, () => {
        if (
          input.runtimeConfig &&
          modelRequestInFlight &&
          currentTurnAttempt < currentTurnMaxAttempts
        ) {
          // Aborting only the current Agent invocation yields an assistant
          // failure that the turn retry coordinator can resume. Tool execution
          // timeouts remain terminal so completed side effects are never replayed.
          idleModelRequestTimedOut = true;
          agent.abort();
          return;
        }
        agent.abort();
        emit({
          type: "agent.error",
          runId: input.runId,
          sessionId: input.sessionId,
          payload: {
            code: "pi_agent.idle_timeout",
            message: "智能体超过 5 分钟没有返回新事件，运行已中止。",
            runtime
          }
        });
        cleanup();
      });
    };

    if (!settled) {
      scheduleIdleTimeout();
      const persistInitialRuntimeContext =
        createdAgent || agent.state.messages.length === 0;
      const runtimeUserContent = buildRunUserMessageContent(
        input,
        persistInitialRuntimeContext
      );
      const runtimeUserMessage: UserMessage = {
        role: "user",
        content: runtimeUserContent,
        timestamp: Date.now()
      };
      if (this.options.evaluationMode) {
        evaluationSnapshotEmitter = createRunEvaluationEmitter(
          input,
          runtime,
          messageId,
          systemPrompt,
          runtimeUserContent,
          persistInitialRuntimeContext,
          tools,
          portableToolSchemaProfile,
          agent,
          emit
        );
        evaluationSnapshotEmitter();
      }
      void runAgentWithTurnRetries({
        agent,
        initialPrompt: runtimeUserMessage,
        runId: input.runId,
        signal: retryWaitController.signal,
        ...(this.options.retryPolicy
          ? { retryPolicy: this.options.retryPolicy }
          : {}),
        classifyFailure: (message) => {
          if (idleModelRequestTimedOut && message.stopReason === "aborted") {
            return "模型请求长时间没有返回新事件。";
          }
          return isRetryableAssistantError(message)
            ? message.errorMessage || "模型连接暂时不可用。"
            : undefined;
        },
        onTurnStarted: (attempt) => {
          retryWaiting = false;
          modelRequestInFlight = true;
          idleModelRequestTimedOut = false;
          currentTurnAttempt = attempt.attempt;
          currentTurnMaxAttempts = attempt.maxAttempts;
          emit({
            type: "agent.turn_started",
            runId: input.runId,
            sessionId: input.sessionId,
            payload: {
              messageId,
              turnId: attempt.turnId,
              attempt: attempt.attempt,
              maxAttempts: attempt.maxAttempts,
              runtime
            }
          });
        },
        onRetryRollback: () => {
          modelRequestInFlight = false;
          idleModelRequestTimedOut = false;
          lifecycle.clearIdleTimer();
          toolStream.discardAttemptToolDeltas();
        },
        onRetryScheduled: (schedule) => {
          retryWaiting = true;
          lifecycle.clearIdleTimer();
          emit({
            type: "agent.retry_scheduled",
            runId: input.runId,
            sessionId: input.sessionId,
            payload: {
              messageId,
              ...schedule,
              runtime
            }
          });
        },
        onAssistantMessageEnded: (message, attempt) => {
          const usageEvent = toUsageObservedRuntimeEvent(
            message,
            input,
            runtime,
            messageId,
            attempt
          );
          if (usageEvent) emit(usageEvent);
        },
        onEvent: (event) => {
          if (
            event.type === "message_end" &&
            isAssistantMessage(event.message)
          ) {
            modelRequestInFlight = false;
          } else if (event.type === "tool_execution_start") {
            modelRequestInFlight = false;
          }
          for (const runtimeEvent of toRuntimeEvents(
            event,
            input,
            runtime,
            messageId
          )) {
            emit(runtimeEvent);
          }
        }
      })
        .catch((error: unknown) => {
          if (settled || retryWaitController.signal.aborted) return;
          emit({
            type: "agent.error",
            runId: input.runId,
            sessionId: input.sessionId,
            payload: {
              code: "pi_agent.prompt_failed",
              message:
                error instanceof Error ? error.message : "本地智能体请求失败。",
              details: {
                kind: error instanceof Error ? error.name : "unknown"
              },
              runtime
            }
          });
        })
        .finally(() => {
          if (!terminalEmitted) {
            emit({
              type: "agent.error",
              runId: input.runId,
              sessionId: input.sessionId,
              payload: {
                code: "pi_agent.missing_terminal_event",
                message: "智能体运行结束，但没有收到完成事件。",
                runtime
              }
            });
          }
          evaluationSnapshotEmitter?.();
          cleanup();
        });
    }

    try {
      for await (const event of queue) {
        yield event;
      }
    } finally {
      if (!settled) {
        agent.abort();
        cleanup();
      }
    }
  }
}
