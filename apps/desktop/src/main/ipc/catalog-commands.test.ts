import { describe, expect, it, vi } from "vitest";
import {
  BookSchema,
  CommandEnvelopeSchema,
  createEnvelope,
  type CommandEnvelope
} from "@deepwrite/contracts";
import { handleCatalogCommands } from "./catalog-commands";
import type { IpcCommandContext } from "./command-types";
vi.mock("electron", () => ({ utilityProcess: {} }));

function context(payload: unknown) {
  const requestCommand = vi.fn(
    async (_worker: string, command: CommandEnvelope) => ({
      status: "accepted",
      requestId: command.id,
      payload
    })
  );
  return {
    requestCommand,
    ctx: { supervisor: { requestCommand } } as unknown as IpcCommandContext
  };
}

describe("catalog Main response validation", () => {
  it("returns legacy book metadata from Core without treating it as a library group", async () => {
    const stamp = "2026-10-03T00:00:00.000Z";
    const book = BookSchema.parse({
      id: "book_existing",
      title: "更新后的书名",
      bookType: "short",
      genre: "悬疑",
      status: "editing",
      linkedMaterialIdsByKind: {
        character: [],
        gimmick: [],
        plot: [],
        draft: [],
        other: []
      },
      linkedSkillIdsByKind: { general: [], plot: [], style: [], other: [] },
      documents: [],
      createdAt: stamp,
      updatedAt: stamp
    });
    const { ctx, requestCommand } = context(book);
    const command = CommandEnvelopeSchema.parse(
      createEnvelope(
        "catalog.updateBook",
        { bookId: book.id, title: book.title },
        { id: "update_book" }
      )
    );
    expect(await handleCatalogCommands(ctx, command)).toEqual({
      status: "accepted",
      requestId: command.id,
      payload: book
    });
    expect(requestCommand).toHaveBeenCalledWith(
      "core",
      command,
      expect.any(Number)
    );
  });
  it("keeps library group metadata on its own response schema", async () => {
    const stamp = "2026-10-03T00:00:00.000Z";
    const group = {
      id: "group_existing",
      title: "素材分组",
      materialType: "long",
      members: {},
      createdAt: stamp,
      updatedAt: stamp
    };
    const { ctx } = context(group);
    const command = CommandEnvelopeSchema.parse(
      createEnvelope(
        "catalog.updateLibraryGroup",
        {
          domain: "material",
          groupId: group.id,
          title: group.title,
          members: {}
        },
        { id: "update_group" }
      )
    );
    expect(await handleCatalogCommands(ctx, command)).toMatchObject({
      status: "accepted",
      payload: { id: group.id, members: {} }
    });
  });
});
