import { mkdtemp, realpath, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { expect, it } from "vitest";
import {
  createEnvelope,
  createEmptyLongMarkdownFileReference,
  longCharacterCoreProfileFileId,
  longCharacterRelationshipsFileId,
  longCharacterFilePath,
  CommandEnvelopeSchema
} from "@deepwrite/contracts";
import { LongWorkspaceService } from "./long-workspace-service";
import { handleLongCoreCommand } from "./long-core-commands";

it("validates and routes character profile read and save through a registered real project", async () => {
  const root = await realpath(
    await mkdtemp(join(tmpdir(), "deepwrite-profile-core-"))
  );
  try {
    const now = "2026-10-01T00:00:00.000Z";
    const service = new LongWorkspaceService({
      userDataPath: join(root, "user"),
      now: () => now
    });
    const created = await service.create(root, {
      title: "临时作品",
      genre: "悬疑"
    });
    const input = {
      bookId: created.book.id,
      characterId: "character_core_api"
    };
    await service.applyOperations({
      bookId: created.book.id,
      batch: {
        updatedAt: now,
        operations: [
          {
            type: "character.create",
            character: {
              id: input.characterId,
              name: "林岚",
              group: "protagonist",
              order: 1,
              aliases: []
            },
            files: {
              characterId: input.characterId,
              coreProfile: createEmptyLongMarkdownFileReference(
                longCharacterCoreProfileFileId(input.characterId),
                longCharacterFilePath(input.characterId, "core-profile.md"),
                now
              ),
              relationships: createEmptyLongMarkdownFileReference(
                longCharacterRelationshipsFileId(input.characterId),
                longCharacterFilePath(input.characterId, "relationships.md"),
                now
              )
            }
          }
        ],
        documentWrites: []
      }
    });
    const read = await handleLongCoreCommand(
      service,
      CommandEnvelopeSchema.parse(
        createEnvelope("long.readCharacterProfile", input, {
          id: "read-profile"
        })
      )
    );
    expect(read).toMatchObject({
      status: "accepted",
      payload: { characterId: input.characterId, profile: { name: "林岚" } }
    });
    const snapshot = await service.readCharacterProfile(input);
    const save = await handleLongCoreCommand(
      service,
      CommandEnvelopeSchema.parse(
        createEnvelope(
          "long.saveCharacterProfile",
          {
            ...input,
            profile: { ...snapshot.profile, settingDescription: "新设定" },
            expectedRevision: snapshot.revision
          },
          { id: "save-profile" }
        )
      )
    );
    expect(save).toMatchObject({
      status: "accepted",
      payload: { profile: { settingDescription: "新设定" } }
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
