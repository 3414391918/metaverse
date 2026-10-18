import {
  CommandEnvelopeSchema,
  createEnvelope,
  LongGetCharacterAppearanceReferencesInputSchema,
  LongGetCharacterAppearanceReferencesResultSchema,
  LongPrepareCharacterAppearanceDirectoryInputSchema,
  LongPrepareCharacterAppearanceDirectoryResultSchema,
  type LongPrepareCharacterAppearanceDirectoryInput,
  LongDeleteCharacterAppearanceInputSchema,
  LongDeleteCharacterAppearanceResultSchema,
  type LongDeleteCharacterAppearanceInput,
  type LongGetCharacterAppearanceReferencesInput
} from "@deepwrite/contracts";
import { browserId, invokeCommand } from "./invoke";

export async function prepareCharacterAppearanceDirectory(
  raw: LongPrepareCharacterAppearanceDirectoryInput
) {
  const input = LongPrepareCharacterAppearanceDirectoryInputSchema.parse(raw);
  const id = browserId("cmd_appearance_directory");
  return LongPrepareCharacterAppearanceDirectoryResultSchema.parse(
    await invokeCommand<unknown>(
      CommandEnvelopeSchema.parse(
        createEnvelope("long.prepareCharacterAppearanceDirectory", input, {
          id,
          correlationId: id,
          context: { resourceId: input.bookId }
        })
      )
    )
  );
}

export async function getCharacterAppearanceReferences(
  raw: LongGetCharacterAppearanceReferencesInput
) {
  const input = LongGetCharacterAppearanceReferencesInputSchema.parse(raw);
  const id = browserId("cmd_character_reference");
  return LongGetCharacterAppearanceReferencesResultSchema.parse(
    await invokeCommand<unknown>(
      CommandEnvelopeSchema.parse(
        createEnvelope("long.getCharacterAppearanceReferences", input, {
          id,
          correlationId: id,
          context: { resourceId: input.bookId }
        })
      )
    )
  );
}

export async function deleteCharacterAppearance(
  raw: LongDeleteCharacterAppearanceInput
) {
  const input = LongDeleteCharacterAppearanceInputSchema.parse(raw);
  const id = browserId("cmd_character_appearance_delete");
  return LongDeleteCharacterAppearanceResultSchema.parse(
    await invokeCommand<unknown>(
      CommandEnvelopeSchema.parse(
        createEnvelope("long.deleteCharacterAppearance", input, {
          id,
          correlationId: id,
          context: { resourceId: input.bookId }
        })
      )
    )
  );
}
