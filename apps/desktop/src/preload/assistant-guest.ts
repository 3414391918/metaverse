import { contextBridge, ipcRenderer } from "electron";
/** The guest never receives the application preload or its filesystem IPC. */
contextBridge.exposeInMainWorld("metaverseAssistant", {
  subscribe(listener: (value: unknown) => void) {
    const receive = (_event: Electron.IpcRendererEvent, value: unknown) =>
      listener(value);
    ipcRenderer.on("metaverse-assistant:config", receive);
    return () =>
      ipcRenderer.removeListener("metaverse-assistant:config", receive);
  },
  notify(value: unknown) {
    ipcRenderer.sendToHost("metaverse-assistant:event", value);
  }
});
