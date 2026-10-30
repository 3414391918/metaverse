import { isAssistantGuestUrl } from "./assistant-service";
import { installWindowFrame, usesCustomWindowFrame } from "./window-frame";
import { BrowserWindow, Menu, shell } from "electron";
import { join } from "node:path";
import type { AppearanceSettings } from "@deepwrite/contracts";
import {
  applyNativeAppearanceChrome,
  resolveNativeBackgroundColor
} from "./native-appearance-chrome";
import { loadWindowRenderer } from "./window-renderer";
import { installTextContextMenu } from "./text-context-menu";
import { guardWindowStartup } from "./window-startup";
import type { StartupLog } from "./startup-log";

function isSafeExternalUrl(rawUrl: string): boolean {
  try {
    return new URL(rawUrl).protocol === "https:";
  } catch {
    return false;
  }
}

const ZHUQUE_DETECTION_ORIGIN = "https://matrix.tencent.com";

function isAllowedZhuqueDetectionUrl(rawUrl: string): boolean {
  try {
    return new URL(rawUrl).origin === ZHUQUE_DETECTION_ORIGIN;
  } catch {
    return false;
  }
}

export function createDesktopWindow(
  appearance: AppearanceSettings,
  startup: { log: StartupLog; fail: (error: unknown) => void }
): BrowserWindow {
  const isDarwin = process.platform === "darwin";
  const window = new BrowserWindow({
    width: 1560,
    height: 940,
    minWidth: 1120,
    minHeight: 700,
    show: false,
    ...(usesCustomWindowFrame() ? { frame: false } : {}),
    backgroundColor: resolveNativeBackgroundColor(appearance),
    title: "元宇宙",
    icon: join(__dirname, "../renderer/app-icon.png"),
    ...(isDarwin
      ? {
          titleBarStyle: "hiddenInset" as const,
          trafficLightPosition: { x: 14, y: 10 }
        }
      : {}),
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      webviewTag: true
    }
  });
  const assistantGuests = new Set<number>();
  installTextContextMenu(window);
  installWindowFrame(window);
  window.webContents.session.setPermissionRequestHandler(
    (sender, permission, callback, details) => {
      if (sender !== window.webContents && !assistantGuests.has(sender.id)) {
        callback(false);
        return;
      }
      if (permission === "media") {
        callback(
          "mediaTypes" in details && details.mediaTypes.includes("audio")
        );
        return;
      }
      callback(
        permission === "clipboard-sanitized-write" ||
          permission === "clipboard-read"
      );
    }
  );

  applyNativeAppearanceChrome(appearance, [window]);

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });

  window.webContents.on(
    "will-attach-webview",
    (event, webPreferences, params) => {
      const assistant =
        typeof params.src === "string" && isAssistantGuestUrl(params.src, true);
      if (
        typeof params.src !== "string" ||
        (assistant && params.partition !== "persist:metaverse-assistant") ||
        (!assistant && !isAllowedZhuqueDetectionUrl(params.src))
      ) {
        event.preventDefault();
        return;
      }
      delete webPreferences.preload;
      webPreferences.nodeIntegration = false;
      webPreferences.contextIsolation = true;
      webPreferences.sandbox = true;
      webPreferences.webSecurity = true;
      if (assistant)
        webPreferences.preload = join(
          __dirname,
          "../preload/assistant-guest.js"
        );
    }
  );

  window.webContents.on("did-attach-webview", (_event, guestContents) => {
    guestContents.on("context-menu", (_event, params) => {
      if (
        !isAssistantGuestUrl(guestContents.getURL()) ||
        params.mediaType !== "image" ||
        guestContents.isDestroyed() ||
        window.isDestroyed()
      )
        return;
      Menu.buildFromTemplate([
        {
          label: "复制图片",
          click: () => {
            if (!guestContents.isDestroyed())
              guestContents.copyImageAt(params.x, params.y);
          }
        }
      ]).popup({ window });
    });
    guestContents.on("dom-ready", () => {
      if (!isAssistantGuestUrl(guestContents.getURL())) return;
      assistantGuests.add(guestContents.id);
      guestContents.session.setPermissionRequestHandler(
        (sender, permission, callback, details) => {
          const trusted =
            assistantGuests.has(sender.id) &&
            isAssistantGuestUrl(details.requestingUrl);
          callback(
            trusted &&
              (permission === "clipboard-read" ||
                permission === "clipboard-sanitized-write" ||
                (permission === "media" &&
                  "mediaTypes" in details &&
                  details.mediaTypes.includes("audio")))
          );
        }
      );
    });
    guestContents.once("destroyed", () =>
      assistantGuests.delete(guestContents.id)
    );
    guestContents.setWindowOpenHandler(({ url }) => {
      if (isSafeExternalUrl(url)) {
        void shell.openExternal(url);
      }
      return { action: "deny" };
    });
    guestContents.on("will-navigate", (event, url) => {
      if (isAllowedZhuqueDetectionUrl(url) || isAssistantGuestUrl(url)) return;
      event.preventDefault();
      if (isSafeExternalUrl(url)) {
        void shell.openExternal(url);
      }
    });
  });

  window.webContents.on("will-navigate", (event, url) => {
    if (url === window.webContents.getURL()) {
      return;
    }
    event.preventDefault();
    if (isSafeExternalUrl(url)) {
      void shell.openExternal(url);
    }
  });

  const loading = guardWindowStartup(window, {
    log: startup.log,
    onFailure: startup.fail,
    show: process.env.DEEPWRITE_SMOKE !== "1"
  });

  void loadWindowRenderer(
    window,
    join(__dirname, "../renderer/index.html"),
    process.env.ELECTRON_RENDERER_URL
  ).catch(loading.fail);

  return window;
}
