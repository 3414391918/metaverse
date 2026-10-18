import { beforeEach, expect, it, vi } from "vitest";
import { clipboard, nativeImage } from "electron";
import { CommandEnvelopeSchema, createEnvelope } from "@deepwrite/contracts";
import type { IpcCommandContext } from "./command-types";
import { handleChapterImageCommands } from "./chapter-image-commands";
vi.mock("electron", () => ({
  clipboard: { readImage: vi.fn(), writeImage: vi.fn() },
  nativeImage: { createFromBuffer: vi.fn() }
}));
const target = {
  bookId: "longbook_example",
  chapterCardId: "chapter_example",
  filename: "001.png"
};
const pngDataUrl = "data:image/png;base64,iVBORw0KGgo=";
const image = {
  isEmpty: () => false,
  getSize: () => ({ width: 2, height: 3 }),
  toPNG: () => Buffer.from("89504e470d0a1a0a", "hex")
};
beforeEach(() => vi.clearAllMocks());
function context(payload: unknown) {
  const requestCommand = vi.fn(async () => ({
    status: "accepted",
    requestId: "cmd_image",
    payload
  }));
  return {
    ctx: { supervisor: { requestCommand } } as unknown as IpcCommandContext,
    requestCommand
  };
}
it("copies only a Core-authorized image into the real system clipboard", async () => {
  const { ctx, requestCommand } = context({
    pngDataUrl,
    revision: "a".repeat(64)
  });
  vi.mocked(nativeImage.createFromBuffer).mockReturnValue(image as never);
  const result = await handleChapterImageCommands(
    ctx,
    CommandEnvelopeSchema.parse(
      createEnvelope("long.copyChapterImage", target, { id: "cmd_image" })
    )
  );
  expect(requestCommand.mock.calls[0]).toMatchObject([
    "core",
    { type: "long.readChapterImage", payload: target },
    60_000
  ]);
  expect(clipboard.writeImage).toHaveBeenCalledWith(image);
  expect(result).toMatchObject({
    status: "accepted",
    payload: { copied: true }
  });
});
it("returns null for an empty clipboard without invoking Core or writing files", async () => {
  const { ctx, requestCommand } = context(null);
  vi.mocked(clipboard.readImage).mockReturnValue({
    isEmpty: () => true
  } as never);
  const result = await handleChapterImageCommands(
    ctx,
    CommandEnvelopeSchema.parse(
      createEnvelope("long.readClipboardImage", {}, { id: "cmd_image" })
    )
  );
  expect(result).toMatchObject({ status: "accepted", payload: null });
  expect(requestCommand).not.toHaveBeenCalled();
});
it("rejects oversized clipboard pixels before encoding", async () => {
  const { ctx } = context(null);
  const toPNG = vi.fn();
  vi.mocked(clipboard.readImage).mockReturnValue({
    ...image,
    getSize: () => ({ width: 10000, height: 10000 }),
    toPNG
  } as never);
  const result = await handleChapterImageCommands(
    ctx,
    CommandEnvelopeSchema.parse(
      createEnvelope("long.readClipboardImage", {}, { id: "cmd_image" })
    )
  );
  expect(result?.status).toBe("rejected");
  expect(toPNG).not.toHaveBeenCalled();
});
it("explains a stale replacement without showing internal hashes", async () => {
  const ctx = {
    supervisor: {
      requestCommand: vi.fn(async () => ({
        status: "rejected",
        requestId: "cmd_image",
        error: {
          code: "project.conflict",
          message:
            "项目文件已在其他位置更新：images/001.png（期望hash，实际hash）",
          details: { kind: "ProjectTransactionConflictError" }
        }
      }))
    }
  } as unknown as IpcCommandContext;
  const result = await handleChapterImageCommands(
    ctx,
    CommandEnvelopeSchema.parse(
      createEnvelope(
        "long.replaceChapterImage",
        { ...target, pngDataUrl, expectedRevision: "a".repeat(64) },
        { id: "cmd_image" }
      )
    )
  );
  expect(result).toMatchObject({
    status: "rejected",
    error: { message: "这张图片或所在章节已被修改，请关闭窗口后重新打开替换。" }
  });
});
