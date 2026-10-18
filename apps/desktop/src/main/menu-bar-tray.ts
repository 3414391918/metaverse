import { app, Menu, nativeImage, Tray } from "electron";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { GeneralSettings } from "@deepwrite/contracts";
export function createMenuBarTray(options: {
  getSettings: () => GeneralSettings;
  showMainWindow: () => void;
}) {
  let menuBarTray: Tray | undefined;
  function destroyMenuBarTray(): void {
    menuBarTray?.destroy();
    menuBarTray = undefined;
  }
  function syncMenuBarTray(): void {
    if (!options.getSettings().showInMenuBar) {
      destroyMenuBarTray();
      return;
    }
    if (menuBarTray && !menuBarTray.isDestroyed()) {
      return;
    }
    const rendererIconPath = join(__dirname, "../renderer/app-icon.png");
    const buildIconPath = join(__dirname, "../../build/icon.png");
    const sourceIcon = existsSync(rendererIconPath)
      ? rendererIconPath
      : buildIconPath;
    let trayIcon = nativeImage.createFromPath(sourceIcon);
    if (process.platform === "darwin" && !trayIcon.isEmpty()) {
      trayIcon = trayIcon.resize({ width: 18, height: 18 });
      trayIcon.setTemplateImage(true);
    }
    menuBarTray = new Tray(trayIcon);
    menuBarTray.setToolTip("元宇宙");
    menuBarTray.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: "显示 元宇宙",
          click: options.showMainWindow
        },
        { type: "separator" },
        {
          label: "退出",
          click: () => app.quit()
        }
      ])
    );
    menuBarTray.on("click", options.showMainWindow);
  }
  return { destroyMenuBarTray, syncMenuBarTray };
}
