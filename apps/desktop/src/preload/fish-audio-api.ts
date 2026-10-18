import {
  FishAudioCommandPayloadSchema,
  FishAudioCatalogItemSchema,
  FishAudioCancelResultSchema,
  FishAudioDeleteResultSchema,
  FishAudioRecordSchema,
  FishAudioSettingsStatusSchema,
  FishAudioVoiceDetailSchema,
  createEnvelope,
  type DeepWriteApi
} from "@deepwrite/contracts";
import { browserId, invokeCommand } from "./invoke";

export const fishAudio: DeepWriteApi["fishAudio"] = {
  async execute(rawPayload) {
    const payload = FishAudioCommandPayloadSchema.parse(rawPayload);
    const id = browserId("cmd_fish_audio");
    const result = await invokeCommand(
      createEnvelope("fishAudio.execute", payload, {
        id,
        correlationId: id
      })
    );
    switch (payload.action) {
      case "settings.get":
      case "settings.save":
      case "settings.clear":
        return FishAudioSettingsStatusSchema.parse(result);
      case "catalog.list":
        return FishAudioCatalogItemSchema.array().parse(result);
      case "operation.cancel":
        return FishAudioCancelResultSchema.parse(result);
      case "voice.create":
        return FishAudioRecordSchema.parse(result);
      case "voice.detail":
        return FishAudioVoiceDetailSchema.parse(result);
      case "record.delete":
        return FishAudioDeleteResultSchema.parse(result);
    }
  }
};
