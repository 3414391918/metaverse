import { app } from "electron";
import { AppImageUpdater, DebUpdater, MacUpdater, NsisUpdater, type AppUpdater } from "electron-updater";
import type { AppAdapter } from "electron-updater/out/AppAdapter";
import { join } from "node:path";
import { ensureStorageDirectory } from "../storage-paths";

/** electron-updater's default adapter uses ~/Library/Caches even after userData is changed. */
export function createApplicationUpdater(): AppUpdater {
  const outputs = process.env.METAVERSE_OUTPUTS_ROOT;
  if (!outputs) throw new Error("更新器运行目录未初始化。");
  const cache = ensureStorageDirectory(join(outputs, "cache", "updates"));
  const adapter: AppAdapter = {
    get version() { return app.getVersion(); },
    get name() { return app.getName(); },
    get isPackaged() { return app.isPackaged; },
    get appUpdateConfigPath() {
      return app.isPackaged
        ? join(process.resourcesPath, "app-update.yml")
        : join(app.getAppPath(), "dev-app-update.yml");
    },
    get userDataPath() { return app.getPath("userData"); },
    get baseCachePath() { return cache; },
    whenReady: () => app.whenReady(),
    relaunch: () => app.relaunch(),
    quit: () => app.quit(),
    onQuit: (handler) => { app.once("quit", (_event, code) => handler(code)); }
  };
  if (process.platform === "darwin") return new MacUpdater(undefined, adapter);
  if (process.platform === "win32") return new NsisUpdater(undefined, adapter);
  return process.env.APPIMAGE ? new AppImageUpdater(undefined, adapter) : new DebUpdater(undefined, adapter);
}
