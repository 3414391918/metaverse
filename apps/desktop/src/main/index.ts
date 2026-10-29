import { stopAssistant } from "./assistant-service";
import {
  createDefaultAppearanceSettings,
  createDefaultGeneralSettings,
  IPC_EVENT_CHANNEL,
  UPDATE_STATE_EVENT_CHANNEL,
  type AppearanceSettings,
  type GeneralSettings,
  type SystemEventEnvelope
} from "@deepwrite/contracts";
import {
  app,
  BrowserWindow,
  dialog,
  Menu,
  nativeTheme,
  session
} from "electron";
import { createDesktopReadyAnnouncer } from "./announce-desktop-ready";
import { AppAlertStore } from "./app-alert-store";
import {
  installAppearanceFontProtocolHandler,
  registerAppearanceFontScheme
} from "./appearance-font-protocol";
import { configureBootstrapEnvironment } from "./bootstrap-environment";
import { ContinuationImportPreviewRegistry } from "./continuation-import-preview-registry";
import { guardConversationWindowClose } from "./conversation-window-close";
import { createDesktopWindow } from "./create-desktop-window";
import { createDesktopServiceAccessors } from "./desktop-service-accessors";
import { createDesktopServices } from "./desktop-services";
import { createDesktopStartup } from "./desktop-startup";
import { electronRemoteFetch } from "./electron-remote-fetch";
import { readExternalLibraryEntries } from "./external-library-import";
import { createGracefulShutdown } from "./graceful-shutdown";
import { disposeConversationExports } from "./ipc/conversation-export-commands";
import { registerDesktopCommandIpc } from "./ipc/register-command-ipc";
import { registerUpdateAlertIpc } from "./ipc/update-alert-ipc";
import {
  chooseWorkspaceDirectory as chooseWorkspaceDirectoryWithServices,
  requireSelectedWorkspaceDirectory as requireSelectedWorkspaceDirectoryWithServices,
  workspaceGroupParent,
  workspaceResourceParent
} from "./ipc/workspace-paths";
import { importLegacyLibraryArchives } from "./legacy-library-import-batch";
import { LegacySyncPreviewRegistry } from "./legacy-sync-preview-registry";
import {
  installLongImageProtocolHandler,
  registerLongImageScheme
} from "./long-image-protocol";
import { exportLongManuscript } from "./long-manuscript-export";
import { createMainWindowStartupGate } from "./main-window-startup-gate";
import { createMenuBarTray } from "./menu-bar-tray";
import { applyNativeAppearanceChrome } from "./native-appearance-chrome";
import { createRendererStateFlushCoordinator } from "./renderer-state-flush";
import { UtilitySupervisor } from "./supervisor";
import { UpdateService } from "./update-service";
import { createUtilityEventHandlers } from "./utility-event-handlers";
registerAppearanceFontScheme();
registerLongImageScheme();
const desktopStartup = createDesktopStartup();
let desktopServices: ReturnType<typeof createDesktopServices> | undefined;
let mainWindow: BrowserWindow | undefined;
let cachedAppearanceSettings: AppearanceSettings =
  createDefaultAppearanceSettings();
let cachedGeneralSettings: GeneralSettings = createDefaultGeneralSettings();
let nativeAppearanceListenerBound = false;
let quitting = false;
let shutdownComplete = false;
const { destroyMenuBarTray, syncMenuBarTray } = createMenuBarTray({
  getSettings: () => cachedGeneralSettings,
  showMainWindow
});
let updateService: UpdateService | undefined;
let appAlertStore: AppAlertStore | undefined;
const rendererStateFlush = createRendererStateFlushCoordinator();
const continuationImportPreviews = new ContinuationImportPreviewRegistry();
const legacySyncPreviews = new LegacySyncPreviewRegistry();
const mainWindowStartupGate = createMainWindowStartupGate(() =>
  showMainWindow()
);
function broadcastEvent(event: SystemEventEnvelope): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(IPC_EVENT_CHANNEL, event);
    }
  }
}
const gracefulShutdown = createGracefulShutdown({
  flushRenderer: async () => {
    await rendererStateFlush.request(mainWindow);
    mainWindow?.close();
  },
  shutdownUtilities: async () => {
    await stopAssistant();
    await supervisor.shutdownAll();
  },
  complete(installUpdate) {
    shutdownComplete = true;
    destroyMenuBarTray();
    if (installUpdate && updateService) updateService.quitAndInstall();
    else app.quit();
  },
  cancel(error) {
    quitting = false;
    console.warn(
      "DeepWrite shutdown was canceled before conversations were saved:",
      error
    );
  }
});
function beginGracefulShutdown(
  options: {
    installUpdate?: boolean;
  } = {}
): void {
  if (shutdownComplete && options.installUpdate && updateService) {
    updateService.quitAndInstall();
    return;
  }
  quitting = true;
  gracefulShutdown.begin(options);
}
const { handleUtilityEvent, handleUnexpectedExit, handleWorkerRestarted } =
  createUtilityEventHandlers({
    broadcastEvent
  });
const supervisor = new UtilitySupervisor({
  onUtilityEvent: handleUtilityEvent,
  onUnexpectedExit: handleUnexpectedExit,
  onWorkerRestarted: handleWorkerRestarted
});
const announceReady = createDesktopReadyAnnouncer({
  supervisor,
  quit: () => app.quit()
});
function createMainWindow(): BrowserWindow {
  const window = createDesktopWindow(cachedAppearanceSettings, {
    log: desktopStartup.log,
    fail: (error) => desktopStartup.fail(error, "window")
  });
  const windowWebContentsId = window.webContents.id;
  window.webContents.once("did-finish-load", () => {
    void announceReady(window).catch((error: unknown) => {
      desktopStartup.log.write("utilities.health.failed", { error });
    });
  });
  window.on("close", (event) => {
    if (cachedGeneralSettings.showInMenuBar && !quitting && !shutdownComplete) {
      event.preventDefault();
      window.hide();
    }
  });
  guardConversationWindowClose(window, {
    skip: () =>
      quitting || shutdownComplete || cachedGeneralSettings.showInMenuBar,
    flush: () => rendererStateFlush.request(window),
    onError: (error) =>
      console.warn("DeepWrite window close was canceled:", error)
  });
  window.webContents.on("did-start-loading", () =>
    rendererStateFlush.reset(windowWebContentsId)
  );
  window.on("closed", () => {
    rendererStateFlush.reset(windowWebContentsId);
    void disposeConversationExports({
      supervisor,
      dialog,
      getMainWindow: requireMainWindow,
      senderWebContentsId: windowWebContentsId
    });
    continuationImportPreviews.clearForWebContents(windowWebContentsId);
    legacySyncPreviews.clearForWebContents(windowWebContentsId);
    if (mainWindow === window) {
      mainWindow = undefined;
    }
  });
  return window;
}
function showMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    mainWindow = createMainWindow();
    return;
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.show();
  mainWindow.focus();
}
function syncGeneralSettings(settings: GeneralSettings): void {
  cachedGeneralSettings = settings;
  syncMenuBarTray();
}
const {
  requireChatAssistantProjectConfigStore,
  requireAgentTeamConfigStore,
  requireLibraryAgentConfigStore,
  requireLongAgentConfigStore,
  requirePromptTemplateStore,
  requireToolLibraryStore,
  requireWorkspaceDirectoryStore,
  requireAppearanceService,
  requireGeneralSettingsStore,
  requireFishAudioService
} = createDesktopServiceAccessors(() => desktopServices ?? {});
function requireMainWindow(): BrowserWindow {
  if (!mainWindow || mainWindow.isDestroyed()) {
    throw new Error("元宇宙主窗口尚未初始化。");
  }
  return mainWindow;
}
function syncNativeAppearanceChrome(settings: AppearanceSettings): void {
  cachedAppearanceSettings = settings;
  applyNativeAppearanceChrome(settings);
  if (!nativeAppearanceListenerBound) {
    nativeAppearanceListenerBound = true;
    nativeTheme.on("updated", () => {
      if (cachedAppearanceSettings.mode === "system") {
        applyNativeAppearanceChrome(cachedAppearanceSettings);
      }
    });
  }
}
async function loadAndSyncNativeAppearanceChrome(): Promise<void> {
  try {
    const snapshot = await requireAppearanceService().list();
    syncNativeAppearanceChrome(snapshot.settings);
  } catch (error) {
    desktopStartup.log.write("appearance.fallback", { error });
    syncNativeAppearanceChrome(createDefaultAppearanceSettings());
  }
}
const chooseWorkspaceDirectory = () =>
  chooseWorkspaceDirectoryWithServices({
    requireWorkspaceDirectoryStore,
    getDocumentsPath: () => app.getPath("documents"),
    dialog
  });
const requireSelectedWorkspaceDirectory = () =>
  requireSelectedWorkspaceDirectoryWithServices({
    requireWorkspaceDirectoryStore,
    chooseWorkspaceDirectory
  });
function registerIpc(): void {
  registerUpdateAlertIpc({
    getMainWindow: () => mainWindow,
    getUpdateService: () => updateService,
    getAppAlertStore: () => appAlertStore
  });
  registerDesktopCommandIpc({
    getMainWindow: () => mainWindow,
    getContext: (senderWebContentsId) => ({
      getMainWindow: requireMainWindow,
      supervisor,
      broadcastEvent,
      dialog,
      continuationImportPreviews,
      legacySyncPreviews,
      requireChatAssistantProjectConfigStore,
      requireAgentTeamConfigStore,
      requireLibraryAgentConfigStore,
      requireLongAgentConfigStore,
      requirePromptTemplateStore,
      requireToolLibraryStore,
      requireWorkspaceDirectoryStore,
      requireAppearanceService,
      requireGeneralSettingsStore,
      requireFishAudioService,
      exportLongManuscript,
      remoteFetch: electronRemoteFetch,
      fishAudioFetch: electronRemoteFetch,
      rendererStateFlush,
      readExternalLibraryEntries,
      importLegacyLibraryArchives,
      cachedAppearanceSettings: () => cachedAppearanceSettings,
      syncNativeAppearanceChrome,
      syncGeneralSettings,
      requireSelectedWorkspaceDirectory,
      workspaceResourceParent,
      workspaceGroupParent,
      chooseWorkspaceDirectory,
      senderWebContentsId,
      getDocumentsPath: () => app.getPath("documents"),
      getAppVersion: () => app.getVersion()
    })
  });
}
const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  shutdownComplete = true;
  app.quit();
} else {
  app.on("second-instance", () => {
    mainWindowStartupGate.requestShow();
  });
  void desktopStartup.run(async () => {
    await app.whenReady();
    await session.defaultSession.setProxy({ mode: "system" });
    Menu.setApplicationMenu(null);
    const userDataPath = configureBootstrapEnvironment(
      app,
      import.meta.env.MAIN_VITE_DEEPWRITE_APP_MODE
    );
    const services = await desktopStartup.step("services", () =>
      createDesktopServices({
        userDataPath,
        toolDefaultsDirectory: `${app.getAppPath()}/out/toolkit`,
        appVersion: app.getVersion(),
        installUpdate: () => beginGracefulShutdown({ installUpdate: true })
      })
    );
    desktopServices = services;
    ({ updateService, appAlertStore } = services);
    installAppearanceFontProtocolHandler(services.appearanceService);
    installAppearanceFontProtocolHandler(
      services.appearanceService,
      session.fromPartition("persist:metaverse-assistant").protocol
    );
    installLongImageProtocolHandler(userDataPath);
    await desktopStartup.step("workspace", () =>
      services.workspaceDirectoryStore.initializeDefault(
        app.getPath("documents")
      )
    );
    await desktopStartup.step("prompt-templates", async () => {
      try {
        await services.promptTemplateStore.list();
      } catch (error) {
        desktopStartup.log.write("prompt-templates.migration_failed", {
          error
        });
      }
    });
    await desktopStartup.step("appearance", loadAndSyncNativeAppearanceChrome);
    await desktopStartup.step("settings", async () => {
      syncGeneralSettings(
        (await services.generalSettingsStore.list()).settings
      );
    });
    updateService.subscribe((state) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(UPDATE_STATE_EVENT_CHANNEL, state);
      }
    });
    await desktopStartup.step("utilities", () => {
      registerIpc();
      supervisor.startAll();
    });
    await desktopStartup.step("window", () => {
      mainWindow = createMainWindow();
    });
    mainWindowStartupGate.markReady();
    app.on("activate", showMainWindow);
  });
}
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
app.on("before-quit", (event) => {
  if (shutdownComplete) {
    return;
  }
  event.preventDefault();
  beginGracefulShutdown();
});
