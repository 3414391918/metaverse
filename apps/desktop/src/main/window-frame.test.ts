import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { app, type BrowserWindow, type IpcMainInvokeEvent } from "electron";
import { createEnvelope, WindowFrameCommandSchema } from "@deepwrite/contracts";
import { installWindowFrame } from "./window-frame";
import { guardConversationWindowClose } from "./conversation-window-close";

vi.mock("electron", () => ({ app: { quit: vi.fn() } }));
function fixture() {
  let handler: (sender: IpcMainInvokeEvent, raw: unknown) => unknown;
  const contents = Object.assign(new EventEmitter(), {
    mainFrame: {},
    isDestroyed: () => false,
    send: vi.fn(),
    ipc: {
      handle: vi.fn((_channel, callback) => {
        handler = callback;
      }),
      removeHandler: vi.fn()
    }
  });
  let maximized = false;
  let fullscreen = false;
  let destroyed = false;
  const window = Object.assign(new EventEmitter(), {
    webContents: contents,
    isDestroyed: () => destroyed,
    isMaximized: () => maximized,
    isFullScreen: () => fullscreen,
    maximize: vi.fn(() => {
      maximized = true;
      window.emit("maximize");
    }),
    unmaximize: vi.fn(() => {
      maximized = false;
      window.emit("unmaximize");
    }),
    setFullScreen: vi.fn((value: boolean) => {
      fullscreen = value;
    }),
    minimize: vi.fn(),
    close: vi.fn(() => {
      let prevented = false;
      window.emit("close", {
        preventDefault: () => {
          prevented = true;
        }
      });
      if (!prevented) destroyed = true;
    })
  });
  installWindowFrame(window as unknown as BrowserWindow);
  const sender = {
    sender: contents,
    senderFrame: contents.mainFrame
  } as unknown as IpcMainInvokeEvent;
  const command = (action: string, source = sender) =>
    handler(
      source,
      createEnvelope("windowFrame.command", { action }, { id: "cmd_test" })
    );
  return { window, contents, command, sender };
}
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
beforeEach(() => vi.clearAllMocks());
describe("window frame boundary and lifecycle", () => {
  it("rejects unknown actions, malformed envelopes and guest/subframe senders", () => {
    const f = fixture();
    expect(() => f.command("destroy")).toThrow();
    expect(
      WindowFrameCommandSchema.safeParse({ payload: { action: "close" } })
        .success
    ).toBe(false);
    expect(() =>
      f.command("close", { ...f.sender, senderFrame: {} } as IpcMainInvokeEvent)
    ).toThrow("Untrusted");
    expect(() =>
      f.command("close", { ...f.sender, sender: {} } as IpcMainInvokeEvent)
    ).toThrow("Untrusted");
    expect(f.window.close).not.toHaveBeenCalled();
  });
  it("uses native minimize/maximize/fullscreen and publishes native changes", () => {
    const f = fixture();
    f.command("minimize");
    expect(f.window.minimize).toHaveBeenCalledOnce();
    f.command("toggleMaximize");
    expect(f.window.isMaximized()).toBe(true);
    expect(f.contents.send.mock.lastCall?.[1].payload.maximized).toBe(true);
    f.command("toggleMaximize");
    expect(f.window.isMaximized()).toBe(false);
    f.command("toggleFullscreen");
    f.command("toggleMaximize");
    expect(f.window.isFullScreen()).toBe(true);
    expect(f.window.isMaximized()).toBe(false);
  });
  it("waits for the existing close guard to save and does not bypass cancellation", async () => {
    const f = fixture();
    let resolveSave!: () => void;
    const flush = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        })
    );
    guardConversationWindowClose(f.window, {
      skip: () => false,
      flush,
      onError: vi.fn()
    });
    f.command("close");
    await tick();
    expect(flush).toHaveBeenCalledOnce();
    expect(f.window.isDestroyed()).toBe(false);
    resolveSave();
    await tick();
    expect(f.window.isDestroyed()).toBe(true);
  });
  it("keeps the window open when saving fails and routes quit through app.quit", async () => {
    const f = fixture();
    const onError = vi.fn();
    guardConversationWindowClose(f.window, {
      skip: () => false,
      flush: async () => {
        throw new Error("save failed");
      },
      onError
    });
    f.command("close");
    await tick();
    expect(onError).toHaveBeenCalledOnce();
    expect(f.window.isDestroyed()).toBe(false);
    f.command("quit");
    await tick();
    expect(app.quit).toHaveBeenCalledOnce();
  });
});
