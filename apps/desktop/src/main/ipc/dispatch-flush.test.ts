import { describe, expect, it, vi } from "vitest";
import { createEnvelope } from "@deepwrite/contracts";
import { createRendererStateFlushCoordinator } from "../renderer-state-flush";
import type { IpcCommandContext } from "./command-types";

vi.mock("electron", () => ({ app: {}, clipboard: {}, nativeImage: {} }));
import { dispatchCommand } from "./dispatch-command";

describe("renderer flush IPC routing", () => {
  it("registers readiness and completes the matching save through the dispatcher", async () => {
    const rendererStateFlush = createRendererStateFlushCoordinator();
    const ctx = {
      senderWebContentsId: 7,
      rendererStateFlush
    } as IpcCommandContext;
    const window = {
      isDestroyed: () => false,
      webContents: { id: 7, send: vi.fn() }
    };
    const ready = await dispatchCommand(
      ctx,
      createEnvelope(
        "rendererState.flushReady",
        { enabled: true },
        { id: "ready" }
      )
    );
    expect(ready).toMatchObject({ status: "accepted", payload: { ok: true } });
    const pending = rendererStateFlush.request(window);
    expect(window.webContents.send).toHaveBeenCalledOnce();
    const request = window.webContents.send.mock.calls[0]![1] as { id: string };
    const completed = await dispatchCommand(
      ctx,
      createEnvelope(
        "rendererState.flushCompleted",
        { requestId: request.id, ok: true },
        { id: "done" }
      )
    );
    expect(completed).toMatchObject({
      status: "accepted",
      payload: { ok: true }
    });
    await expect(pending).resolves.toBeUndefined();
  });
});
