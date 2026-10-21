import { beforeEach, expect, it, vi } from "vitest";
import { clipboard } from "electron";
import { CommandEnvelopeSchema, createEnvelope } from "@deepwrite/contracts";
import type { IpcCommandContext } from "./command-types";
import { handleChapterVideoCommands } from "./chapter-video-commands";

vi.mock("electron", () => ({
  clipboard: { writeBuffer: vi.fn(), writeText: vi.fn() }
}));
beforeEach(() => vi.clearAllMocks());

it("copies only a Core-verified video's absolute path as plain text", async () => {
  const target = {
    bookId: "longbook_example",
    chapterCardId: "chapter_example",
    filename: "001.mp4"
  };
  const path = "/books/example/long/chapters/chapter_example/videos/001.mp4";
  const requestCommand = vi.fn(async () => ({
    status: "accepted" as const,
    requestId: "cmd_video",
    payload: { path, revision: "a".repeat(64) }
  }));
  const ctx = {
    supervisor: { requestCommand }
  } as unknown as IpcCommandContext;
  const result = await handleChapterVideoCommands(
    ctx,
    CommandEnvelopeSchema.parse(
      createEnvelope("long.copyChapterVideoPath", target, { id: "cmd_video" })
    )
  );
  expect(requestCommand).toHaveBeenCalledWith(
    "core",
    expect.objectContaining({
      type: "long.copyChapterVideoPath",
      payload: target
    }),
    120_000
  );
  expect(clipboard.writeText).toHaveBeenCalledWith(path);
  expect(clipboard.writeBuffer).not.toHaveBeenCalled();
  expect(result).toMatchObject({
    status: "accepted",
    payload: { copied: true }
  });
});
it("rejects a nonabsolute video path without changing the clipboard", async () => {
  const requestCommand = vi.fn(async () => ({
    status: "accepted" as const,
    requestId: "cmd_video",
    payload: { path: "videos/001.mp4", revision: "a".repeat(64) }
  }));
  const ctx = {
    supervisor: { requestCommand }
  } as unknown as IpcCommandContext;
  const result = await handleChapterVideoCommands(
    ctx,
    CommandEnvelopeSchema.parse(
      createEnvelope(
        "long.copyChapterVideoPath",
        {
          bookId: "longbook_example",
          chapterCardId: "chapter_example",
          filename: "001.mp4"
        },
        { id: "cmd_video" }
      )
    )
  );
  expect(result?.status).toBe("rejected");
  expect(clipboard.writeText).not.toHaveBeenCalled();
});
