import { app, type BrowserWindow, type IpcMainInvokeEvent } from "electron";
import {
  createEnvelope,
  WINDOW_FRAME_COMMAND_CHANNEL,
  WINDOW_FRAME_EVENT_CHANNEL,
  WindowFrameCommandSchema,
  WindowFrameEventSchema,
  type WindowFrameState
} from "@deepwrite/contracts";
import { createId } from "@deepwrite/shared";

export function usesCustomWindowFrame(platform = process.platform): boolean {
  return platform === "linux" || platform === "win32";
}

/** Window-local handler: subframes and embedded webviews cannot control the host. */
export function installWindowFrame(window: BrowserWindow): void {
  const contents = window.webContents;
  const state = (): WindowFrameState => ({
    customTitlebar: usesCustomWindowFrame(),
    maximized: window.isMaximized(),
    fullscreen: window.isFullScreen()
  });
  const event = () =>
    WindowFrameEventSchema.parse(
      createEnvelope("windowFrame.state", state(), {
        id: createId("evt_window")
      })
    );
  const publish = () => {
    if (!window.isDestroyed() && !contents.isDestroyed()) {
      contents.send(WINDOW_FRAME_EVENT_CHANNEL, event());
    }
  };
  const handle = (sender: IpcMainInvokeEvent, raw: unknown) => {
    if (
      sender.sender !== contents ||
      sender.senderFrame !== contents.mainFrame ||
      window.isDestroyed()
    ) {
      throw new Error("Untrusted window command.");
    }
    const command = WindowFrameCommandSchema.parse(raw);
    const action = command.payload.action;
    switch (action) {
      case "minimize":
        window.minimize();
        break;
      case "toggleMaximize":
        if (!window.isFullScreen()) {
          if (window.isMaximized()) window.unmaximize();
          else window.maximize();
        }
        break;
      case "toggleFullscreen":
        window.setFullScreen(!window.isFullScreen());
        break;
    }
    const result = event();
    // Reply before lifecycle handlers potentially destroy the renderer. Never destroy directly.
    if (action === "close" || action === "quit") {
      setImmediate(() => {
        if (action === "quit") app.quit();
        else if (!window.isDestroyed()) window.close();
      });
    }
    return result;
  };
  contents.ipc.handle(WINDOW_FRAME_COMMAND_CHANNEL, handle);
  window.on("maximize", publish);
  window.on("unmaximize", publish);
  window.on("enter-full-screen", publish);
  window.on("leave-full-screen", publish);
  contents.on("did-finish-load", publish);
  window.once("closed", () => {
    if (!contents.isDestroyed())
      contents.ipc.removeHandler(WINDOW_FRAME_COMMAND_CHANNEL);
  });
}
