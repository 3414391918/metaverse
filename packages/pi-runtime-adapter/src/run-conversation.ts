import {
  Agent,
  type AgentMessage,
  type AgentTool,
  type StreamFn,
  type ThinkingLevel as PiThinkingLevel
} from "@earendil-works/pi-agent-core";
import type {
  Api,
  AssistantMessage,
  Model,
  UserMessage,
  Usage
} from "@earendil-works/pi-ai";
import type { AgentRunInput } from "./runtime-types";
import type { AgentToolExecutionHooks } from "./subagent-runtime";
import { cacheConversationAgent } from "./conversation-agent-rebuild";
const EMPTY_RESTORED_MESSAGE_USAGE: Usage = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 0,
  cost: {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    total: 0
  }
};

function restoredConversationMessages(
  input: AgentRunInput,
  model: Model<Api>
): AgentMessage[] {
  return (input.conversationHistory ?? []).map((message) => {
    const timestamp = Date.parse(message.createdAt);
    if (message.role === "user") {
      return {
        role: "user",
        content: message.content,
        timestamp
      } satisfies UserMessage;
    }
    return {
      role: "assistant",
      content: [{ type: "text", text: message.content }],
      api: model.api,
      provider: model.provider,
      model: model.id,
      usage: EMPTY_RESTORED_MESSAGE_USAGE,
      stopReason: "stop",
      timestamp
    } satisfies AssistantMessage;
  });
}

export function prepareConversationAgent(
  input: AgentRunInput,
  agents: Map<string, Agent>,
  agentKey: string,
  reusableConversationAgent: Agent | undefined,
  model: Model<Api>,
  tools: AgentTool[],
  systemPrompt: string,
  effectiveThinkingLevel: PiThinkingLevel,
  interceptedStreamFn: StreamFn,
  toolExecutionHooks: AgentToolExecutionHooks
) {
  let agent = reusableConversationAgent;
  const createdAgent = agent === undefined;
  if (agent) {
    if (agent.state.isStreaming) {
      throw new Error("The selected conversation agent is already running.");
    }
    agent.state.systemPrompt = systemPrompt;
    agent.state.model = model;
    agent.state.thinkingLevel = effectiveThinkingLevel;
    agent.state.tools = tools;
    agent.streamFunction = interceptedStreamFn;
    if (toolExecutionHooks.beforeToolCall) {
      agent.beforeToolCall = toolExecutionHooks.beforeToolCall;
    } else {
      delete agent.beforeToolCall;
    }
    if (toolExecutionHooks.afterToolCall) {
      agent.afterToolCall = toolExecutionHooks.afterToolCall;
    } else {
      delete agent.afterToolCall;
    }
    agent.sessionId = input.sessionId;
    agent.toolExecution = "sequential";
    cacheConversationAgent(agents, agentKey, agent);
  } else {
    const restoredMessages = restoredConversationMessages(input, model);
    agent = new Agent({
      initialState: {
        systemPrompt,
        model,
        thinkingLevel: effectiveThinkingLevel,
        ...(restoredMessages.length ? { messages: restoredMessages } : {}),
        tools
      },
      streamFn: interceptedStreamFn,
      ...toolExecutionHooks,
      sessionId: input.sessionId,
      toolExecution: "sequential"
    });
    cacheConversationAgent(agents, agentKey, agent);
    trimConversationAgents(agents);
  }
  return { agent, createdAgent };
}

function trimConversationAgents(agents: Map<string, Agent>, limit = 100): void {
  if (agents.size <= limit) return;
  for (const [key, agent] of agents) {
    if (agents.size <= limit) return;
    if (!agent.state.isStreaming) agents.delete(key);
  }
}
