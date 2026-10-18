import {
  createEnvelope,
  IPC_EVENT_CHANNEL,
  SystemHealthPayloadSchema,
  SystemReadyEventEnvelopeSchema,
  type SystemEventEnvelope
} from "@deepwrite/contracts";
import { createId } from "@deepwrite/shared";
import type { BrowserWindow } from "electron";
import type { UtilitySupervisor } from "./supervisor";
import { runApplicationSmoke } from "./smoke";
export function createDesktopReadyAnnouncer(options: {
  supervisor: UtilitySupervisor;
  setSmokeEventTap: (
    tap: ((event: SystemEventEnvelope) => void) | undefined
  ) => void;
  quit: () => void;
}) {
  async function announceReady(window: BrowserWindow): Promise<void> {
    const health = SystemHealthPayloadSchema.parse(
      await options.supervisor.collectHealth()
    );
    const event = SystemReadyEventEnvelopeSchema.parse(
      createEnvelope("system.ready", health, { id: createId("evt_ready") })
    ) as SystemEventEnvelope;
    if (!window.isDestroyed()) {
      window.webContents.send(IPC_EVENT_CHANNEL, event);
    }
    if (process.env.DEEPWRITE_SMOKE === "1") {
      try {
        await runApplicationSmoke(
          health,
          options.supervisor,
          window,
          options.setSmokeEventTap
        );
      } catch (error: unknown) {
        console.error(
          `DEEPWRITE_SMOKE_FAIL ${error instanceof Error ? error.message : "unknown"}`
        );
      } finally {
        options.quit();
      }
    }
  }
  return announceReady;
}
