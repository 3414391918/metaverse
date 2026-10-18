import type { AgentRuntimeRef } from "@deepwrite/contracts";
import type {
  AgentRunInput,
  AgentRuntimeEvent,
  AgentUserInputRequester
} from "./runtime-types";
import type { AgentUserInputBroker } from "./user-input-broker";

export function createRunUserInputRequester(
  input: AgentRunInput,
  runtime: AgentRuntimeRef,
  broker: AgentUserInputBroker,
  emit: (event: AgentRuntimeEvent) => void,
  onWaitingChange: (delta: 1 | -1) => void
): AgentUserInputRequester {
  let sequence = 0;
  return async (request, signal) => {
    const requestId = `${input.runId}:user-input:${++sequence}`;
    const response = broker.wait(
      {
        sessionId: input.sessionId,
        runId: input.runId,
        requestId,
        questions: request.questions
      },
      signal
    );
    onWaitingChange(1);
    emit({
      type: "agent.user_input_requested",
      runId: input.runId,
      sessionId: input.sessionId,
      payload: {
        requestId,
        toolCallId: request.toolCallId,
        source: request.source,
        questions: request.questions,
        runtime
      }
    });
    try {
      return await response;
    } finally {
      onWaitingChange(-1);
    }
  };
}
