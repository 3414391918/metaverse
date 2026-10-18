import type { Agent, AgentTool } from "@earendil-works/pi-agent-core";
import type { AgentRuntimeRef } from "@deepwrite/contracts";
import type { UserMessage } from "@earendil-works/pi-ai";
import type { AgentRunInput, AgentRuntimeEvent } from "./runtime-types";
import type { PortableToolSchemaProfile } from "./portable-tool-schema";
import { applyProviderToolSchemaCompatibility } from "./portable-tool-schema";
import { enforceProviderToolSchemaCompatibility } from "./provider-tool-schema-compat";
import {
  buildAgentEvaluationSnapshot,
  evaluationConversationHistory
} from "./evaluation";
export function createRunEvaluationEmitter(
  input: AgentRunInput,
  runtime: AgentRuntimeRef,
  messageId: string,
  systemPrompt: string,
  runtimeUserContent: UserMessage["content"],
  persistInitialRuntimeContext: boolean,
  tools: AgentTool[],
  portableToolSchemaProfile: PortableToolSchemaProfile,
  agent: Agent,
  emit: (event: AgentRuntimeEvent) => void
): () => void {
  const providerVisibleTools =
    applyProviderToolSchemaCompatibility(
      enforceProviderToolSchemaCompatibility({
        systemPrompt,
        messages: [],
        tools
      }),
      runtime.provider,
      input.runtimeConfig?.toolSchemaProfile,
      portableToolSchemaProfile
    ).tools ?? tools;
  const evaluationTools = providerVisibleTools.map((providerTool) => {
    const executableTool = tools.find(
      (candidate) => candidate.name === providerTool.name
    );
    return {
      name: providerTool.name,
      description: providerTool.description,
      parameters: providerTool.parameters,
      ...(executableTool?.label ? { label: executableTool.label } : {}),
      ...(executableTool?.executionMode
        ? { executionMode: executableTool.executionMode }
        : {})
    };
  });
  const emitEvaluationSnapshot = (): void => {
    emit({
      type: "agent.evaluation_snapshot",
      runId: input.runId,
      sessionId: input.sessionId,
      payload: {
        messageId,
        snapshot: buildAgentEvaluationSnapshot(
          systemPrompt,
          runtimeUserContent,
          persistInitialRuntimeContext,
          evaluationTools,
          new Date().toISOString(),
          evaluationConversationHistory(agent.state.messages)
        ),
        runtime
      }
    });
  };
  return emitEvaluationSnapshot;
}
