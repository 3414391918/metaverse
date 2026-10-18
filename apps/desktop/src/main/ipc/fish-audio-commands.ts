import {
  FishAudioRecordSchema,
  createEnvelope,
  fishAudioPageUrl,
  type CommandEnvelope,
  type CommandResult,
  type FishAudioProgressPayload
} from "@deepwrite/contracts";
import { randomUUID } from "node:crypto";
import { shell } from "electron";
import type { IpcCommandContext } from "./command-types";

export async function handleFishAudioCommands(
  ctx: IpcCommandContext,
  command: CommandEnvelope
): Promise<CommandResult | undefined> {
  if (command.type !== "fishAudio.execute") return undefined;
  const operationId =
    command.payload.action === "voice.create"
      ? command.payload.operationId
      : undefined;
  let activeStage: FishAudioProgressPayload["stage"] | undefined;
  const report = (progress: Omit<FishAudioProgressPayload, "operationId">) => {
    if (!operationId) return;
    if (progress.status === "running") activeStage = progress.stage;
    if (progress.status === "completed") activeStage = undefined;
    ctx.broadcastEvent(
      createEnvelope(
        "fishAudio.progress",
        { operationId, ...progress },
        { id: randomUUID(), correlationId: command.id }
      )
    );
  };
  try {
    const service = ctx.requireFishAudioService();
    const requester = ctx.fishAudioFetch ?? ctx.remoteFetch ?? fetch;
    const payload = operationId
      ? await service.execute(command.payload, requester, report)
      : await service.execute(command.payload, requester);
    if (command.payload.action === "voice.create") {
      const record = FishAudioRecordSchema.parse(payload);
      // Browser startup is independent of the already completed platform write.
      try {
        void shell
          .openExternal(fishAudioPageUrl(record))
          .catch(() => undefined);
      } catch {
        // Some desktop environments throw before returning a Promise.
      }
    }
    return { status: "accepted", requestId: command.id, payload };
  } catch (error) {
    if (activeStage)
      report({
        stage: activeStage,
        status: "error",
        detail: error instanceof Error ? error.message : "FishAudio 操作失败。"
      });
    return {
      status: "rejected",
      requestId: command.id,
      error: {
        code: "fish_audio.failed",
        message: error instanceof Error ? error.message : "FishAudio 操作失败。"
      }
    };
  }
}
