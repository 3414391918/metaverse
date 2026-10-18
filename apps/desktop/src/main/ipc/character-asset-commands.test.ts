import { expect, it, vi } from "vitest";
import {
  CommandEnvelopeSchema,
  createEnvelope,
  type CommandEnvelope
} from "@deepwrite/contracts";
import type { IpcCommandContext } from "./command-types";
import { handleCharacterAssetCommands } from "./character-asset-commands";
import { isForbiddenRendererCommand } from "./forbidden-commands";
vi.mock("electron", () => ({
  app: { getPath: () => "/unused" },
  clipboard: { writeImage: vi.fn() },
  nativeImage: { createFromBuffer: vi.fn() }
}));
const identity = {
  bookId: "longbook_example",
  characterId: "character_example",
  appearanceId: "look_a"
};
it("forwards appearance deletion with the confirmed revision and image set to Core", async () => {
  const requestCommand = vi.fn(async () => ({
    status: "rejected",
    requestId: "cmd_delete",
    error: { code: "fixture", message: "fixture" }
  }));
  const ctx = {
    supervisor: { requestCommand }
  } as unknown as IpcCommandContext;
  const command = CommandEnvelopeSchema.parse(
    createEnvelope(
      "long.deleteCharacterAppearance",
      { ...identity, expectedRevision: "a".repeat(64), expectedAssetIds: [] },
      { id: "cmd_delete" }
    )
  );
  await handleCharacterAssetCommands(ctx, command);
  expect(requestCommand).toHaveBeenCalledWith("core", command, 60_000);
  expect(
    CommandEnvelopeSchema.safeParse(
      createEnvelope(
        "long.deleteCharacterAppearance",
        { ...command.payload, path: "/outside/image.png" },
        { id: "cmd_delete" }
      )
    ).success
  ).toBe(false);
});
it("does not accept arbitrary upload paths from the renderer", () => {
  expect(
    CommandEnvelopeSchema.safeParse(
      createEnvelope(
        "long.importCharacterAssets",
        {
          ...identity,
          sourcePaths: ["/outside/image.png"]
        },
        { id: "cmd_test" }
      )
    ).success
  ).toBe(false);
  expect(isForbiddenRendererCommand("long.importCharacterAssetsAtPaths")).toBe(
    true
  );
});
it("cancelling the image chooser does not write anything", async () => {
  const requestCommand = vi.fn();
  const ctx = {
    getMainWindow: () => ({}),
    dialog: { showOpenDialog: async () => ({ canceled: true, filePaths: [] }) },
    supervisor: { requestCommand }
  } as unknown as IpcCommandContext;
  const command = CommandEnvelopeSchema.parse(
    createEnvelope("long.importCharacterAssets", identity, { id: "cmd_test" })
  );
  expect(await handleCharacterAssetCommands(ctx, command)).toEqual({
    status: "accepted",
    requestId: command.id,
    payload: null
  });
  expect(requestCommand).not.toHaveBeenCalled();
});
it("forwards only native chooser paths and preserves the request identity", async () => {
  const requestCommand = vi.fn(
    async (_runtime: string, _command: CommandEnvelope, _timeout: number) => ({
      status: "rejected",
      requestId: "cmd_test",
      error: { code: "fixture", message: "fixture" }
    })
  );
  const ctx = {
    getMainWindow: () => ({}),
    dialog: {
      showOpenDialog: async () => ({
        canceled: false,
        filePaths: ["/tmp/selected.png"]
      })
    },
    supervisor: { requestCommand }
  } as unknown as IpcCommandContext;
  const command = CommandEnvelopeSchema.parse(
    createEnvelope("long.importCharacterAssets", identity, { id: "cmd_test" })
  );
  await handleCharacterAssetCommands(ctx, command);
  expect(requestCommand.mock.calls[0]?.[1]).toMatchObject({
    id: command.id,
    type: "long.importCharacterAssetsAtPaths",
    payload: { ...identity, sourcePaths: ["/tmp/selected.png"] }
  });
});
