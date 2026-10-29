import {
  createEnvelope,
  SystemEventEnvelopeSchema,
  type SystemEventEnvelope,
  type UtilityWorkerName
} from "@deepwrite/contracts";
import { createId, nowIso } from "@deepwrite/shared";

export function createUtilityEventHandlers(options: {
  broadcastEvent: (event: SystemEventEnvelope) => void;
}) {
  function broadcastWorkerEvent(
    type: "system.worker_restarting" | "system.worker_restarted",
    worker: UtilityWorkerName,
    reason: string,
    atField: "detectedAt" | "restartedAt"
  ): void {
    options.broadcastEvent(
      SystemEventEnvelopeSchema.parse(
        createEnvelope(
          type,
          { worker, reason, [atField]: nowIso() },
          { id: createId("evt_worker") }
        )
      ) as SystemEventEnvelope
    );
  }

  function handleUtilityEvent(
    event: SystemEventEnvelope,
    _worker: UtilityWorkerName
  ): void {
    const validated = SystemEventEnvelopeSchema.parse(
      event
    ) as SystemEventEnvelope;
    options.broadcastEvent(validated);
  }

  function handleUnexpectedExit(
    worker: UtilityWorkerName,
    reason: string
  ): void {
    broadcastWorkerEvent(
      "system.worker_restarting",
      worker,
      reason,
      "detectedAt"
    );
  }

  function handleWorkerRestarted(
    worker: UtilityWorkerName,
    reason: string
  ): void {
    broadcastWorkerEvent(
      "system.worker_restarted",
      worker,
      reason,
      "restartedAt"
    );
  }

  return { handleUtilityEvent, handleUnexpectedExit, handleWorkerRestarted };
}
