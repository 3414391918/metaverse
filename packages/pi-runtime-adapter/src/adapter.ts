import { Agent } from "@earendil-works/pi-agent-core";
import type {
  AgentProviderRuntimeConfig,
  AgentRuntimeRef,
  ModelConnectionTestResult,
  SessionUserInputResponseAcceptedPayload,
  SessionUserInputResponsePayload
} from "@deepwrite/contracts";
import type { AgentTurnRetryPolicyOptions } from "./agent-turn-retry";
import { DEEPWRITE_FAUX_RUNTIME } from "./faux-local";
import { buildDeepWriteSystemPrompt } from "./prompts";
import { resolveProviderModelCapacity } from "./provider-runtime";
import type {
  AgentRunInput,
  AgentRuntime,
  AgentRuntimeEvent,
  PiRuntimeAdapterOptions
} from "./runtime-types";
import { AgentUserInputBroker } from "./user-input-broker";
import type { AgentToolExecutionHooks } from "./subagent-runtime";
import { RuntimeRun } from "./runtime-run";
import { testModelConnection } from "./model-connection-test";
export class PiAgentRuntimeAdapter implements AgentRuntime {
  private readonly idleTimeoutMs: number;
  private readonly subagentTimeoutMs: number | undefined;
  private readonly tokensPerSecond: number;
  private readonly systemPrompt: string;
  private readonly evaluationMode: boolean;
  private readonly retryPolicy: AgentTurnRetryPolicyOptions | undefined;
  private readonly toolExecutionHooks: AgentToolExecutionHooks;
  private readonly conversationAgents = new Map<string, Agent>();
  private readonly userInputBroker = new AgentUserInputBroker();

  constructor(options: PiRuntimeAdapterOptions = {}) {
    this.idleTimeoutMs = options.idleTimeoutMs ?? 5 * 60_000;
    this.subagentTimeoutMs = options.subagentTimeoutMs;
    this.tokensPerSecond = options.tokensPerSecond ?? 90;
    this.systemPrompt = options.systemPrompt ?? buildDeepWriteSystemPrompt();
    this.evaluationMode = options.evaluationMode === true;
    this.retryPolicy = options.retryPolicy;
    this.toolExecutionHooks = {
      ...(options.beforeToolCall
        ? { beforeToolCall: options.beforeToolCall }
        : {}),
      ...(options.afterToolCall ? { afterToolCall: options.afterToolCall } : {})
    };
  }

  describe(config?: AgentProviderRuntimeConfig): AgentRuntimeRef {
    if (config) {
      return {
        provider: config.provider,
        model: config.modelId,
        mode: "provider",
        configId: config.id
      };
    }
    return { ...DEEPWRITE_FAUX_RUNTIME };
  }

  resolveUserInput(
    response: SessionUserInputResponsePayload
  ): SessionUserInputResponseAcceptedPayload {
    return this.userInputBroker.resolve(response);
  }

  resolveModelCapacity(config: AgentProviderRuntimeConfig): {
    modelId: string;
    contextWindow: number;
    maxTokens: number;
  } {
    return {
      modelId: config.id,
      ...resolveProviderModelCapacity(config)
    };
  }

  testConnection(
    config: AgentProviderRuntimeConfig
  ): Promise<ModelConnectionTestResult> {
    return testModelConnection(config);
  }
  start(input: AgentRunInput): AsyncIterable<AgentRuntimeEvent> {
    return new RuntimeRun({
      idleTimeoutMs: this.idleTimeoutMs,
      subagentTimeoutMs: this.subagentTimeoutMs,
      tokensPerSecond: this.tokensPerSecond,
      systemPrompt: this.systemPrompt,
      evaluationMode: this.evaluationMode,
      retryPolicy: this.retryPolicy,
      toolExecutionHooks: this.toolExecutionHooks,
      conversationAgents: this.conversationAgents,
      userInputBroker: this.userInputBroker,
      runtime: this.describe(input.runtimeConfig)
    }).start(input);
  }
}
