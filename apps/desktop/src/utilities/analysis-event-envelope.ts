import { createEnvelope, type SystemEventEnvelope } from "@deepwrite/contracts";
import type { AgentRuntimeEvent } from "@deepwrite/pi-runtime-adapter";
import { createId } from "@deepwrite/shared";
type AnalysisEvent = Extract<
  AgentRuntimeEvent,
  {
    type: "revision_analysis.result_updated";
  }
>;
export function analysisEventEnvelope(
  event: AnalysisEvent,
  correlationId: string
): SystemEventEnvelope {
  const context = {
    correlationId,
    sessionId: event.sessionId,
    runId: event.runId
  };
  if (event.type === "revision_analysis.result_updated")
    return createEnvelope(
      event.type,
      { sessionId: event.sessionId, runId: event.runId, ...event.payload },
      { id: createId("evt"), context }
    );
  throw new Error("未知修改分析事件。");
}
