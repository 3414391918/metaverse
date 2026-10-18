import {
  CommandEnvelopeSchema,
  createEnvelope,
  LongReadCharacterProfileInputSchema,
  LongSaveCharacterProfileInputSchema,
  LongImportCharacterAssetsInputSchema,
  LongRenameCharacterAssetInputSchema,
  LongDeleteCharacterAssetInputSchema,
  LongCopyCharacterAssetInputSchema,
  LongCharacterProfileSnapshotSchema,
  LongImportCharacterAssetsResultSchema,
  LongCopyCharacterAssetResultSchema,
  type LongReadCharacterProfileInput,
  type LongSaveCharacterProfileInput,
  type LongImportCharacterAssetsInput,
  type LongRenameCharacterAssetInput,
  type LongDeleteCharacterAssetInput,
  type LongCopyCharacterAssetInput
} from "@deepwrite/contracts";
import { browserId, invokeCommand } from "./invoke";
async function invoke(type: string, input: { bookId: string }) {
  const id = browserId("cmd_character");
  return await invokeCommand<unknown>(
    CommandEnvelopeSchema.parse(
      createEnvelope(type, input, {
        id,
        correlationId: id,
        context: { resourceId: input.bookId }
      })
    )
  );
}
export async function readCharacterProfile(raw: LongReadCharacterProfileInput) {
  return LongCharacterProfileSnapshotSchema.parse(
    await invoke(
      "long.readCharacterProfile",
      LongReadCharacterProfileInputSchema.parse(raw)
    )
  );
}
export async function saveCharacterProfile(raw: LongSaveCharacterProfileInput) {
  return LongCharacterProfileSnapshotSchema.parse(
    await invoke(
      "long.saveCharacterProfile",
      LongSaveCharacterProfileInputSchema.parse(raw)
    )
  );
}
export async function importCharacterAssets(
  raw: LongImportCharacterAssetsInput
) {
  return LongImportCharacterAssetsResultSchema.parse(
    await invoke(
      "long.importCharacterAssets",
      LongImportCharacterAssetsInputSchema.parse(raw)
    )
  );
}
export async function renameCharacterAsset(raw: LongRenameCharacterAssetInput) {
  return LongCharacterProfileSnapshotSchema.parse(
    await invoke(
      "long.renameCharacterAsset",
      LongRenameCharacterAssetInputSchema.parse(raw)
    )
  );
}
export async function deleteCharacterAsset(raw: LongDeleteCharacterAssetInput) {
  return LongCharacterProfileSnapshotSchema.parse(
    await invoke(
      "long.deleteCharacterAsset",
      LongDeleteCharacterAssetInputSchema.parse(raw)
    )
  );
}
export async function copyCharacterAsset(raw: LongCopyCharacterAssetInput) {
  return LongCopyCharacterAssetResultSchema.parse(
    await invoke(
      "long.copyCharacterAsset",
      LongCopyCharacterAssetInputSchema.parse(raw)
    )
  );
}
