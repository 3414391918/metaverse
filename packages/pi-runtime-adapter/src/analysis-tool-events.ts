import { isRevisionAnalysisToolDetails } from "./revision-analysis";
import type { AgentRunInput, AgentRuntimeEvent } from "./runtime-types";
import type { AgentRuntimeRef } from "@deepwrite/contracts";
export function analysisToolEvents(
  details: unknown,
  toolCallId: string,
  input: AgentRunInput,
  runtime: AgentRuntimeRef
): AgentRuntimeEvent[] | null {
  if (isRevisionAnalysisToolDetails(details)) {
    return [
      {
        type: "revision_analysis.result_updated",
        sessionId: input.sessionId,
        runId: input.runId,
        payload: {
          toolCallId,
          jobId: details.jobId,
          result: details.result,
          runtime
        }
      }
    ];
  }
  return null;
}
