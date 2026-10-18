import {
  APP_ALERT_ACKNOWLEDGE_DESKTOP_CHANNEL,
  APP_ALERT_GET_CHANNEL,
  AppAlertDesktopRevisionSchema,
  AppAlertSnapshotSchema,
  UPDATE_CHECK_CHANNEL,
  UPDATE_DOWNLOAD_CHANNEL,
  UPDATE_GET_STATE_CHANNEL,
  UPDATE_INSTALL_CHANNEL,
  UpdateStateSchema,
  type AppAlertSnapshot,
  type UpdateState
} from "@deepwrite/contracts";
import { ipcRenderer } from "electron";
export async function getUpdateState(): Promise<UpdateState> {
  return UpdateStateSchema.parse(
    await ipcRenderer.invoke(UPDATE_GET_STATE_CHANNEL)
  );
}

export async function checkForUpdates(): Promise<UpdateState> {
  return UpdateStateSchema.parse(
    await ipcRenderer.invoke(UPDATE_CHECK_CHANNEL)
  );
}

export async function downloadUpdate(): Promise<UpdateState> {
  return UpdateStateSchema.parse(
    await ipcRenderer.invoke(UPDATE_DOWNLOAD_CHANNEL)
  );
}

export async function installUpdate(): Promise<void> {
  await ipcRenderer.invoke(UPDATE_INSTALL_CHANNEL);
}

export async function getAppAlerts(): Promise<AppAlertSnapshot> {
  return AppAlertSnapshotSchema.parse(
    await ipcRenderer.invoke(APP_ALERT_GET_CHANNEL)
  );
}

export async function acknowledgeDesktopAlert(
  rawRevision: string
): Promise<void> {
  const revision = AppAlertDesktopRevisionSchema.parse(rawRevision);
  await ipcRenderer.invoke(APP_ALERT_ACKNOWLEDGE_DESKTOP_CHANNEL, revision);
}
