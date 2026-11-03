import { existsSync, lstatSync, mkdirSync, realpathSync, accessSync, constants } from "node:fs";
import { dirname, join, resolve, basename } from "node:path";
import { migrateApplicationStorage } from "./main/application-storage-migration";

export interface ApplicationStoragePaths {
  root: string;
  configs: string;
  outputs: string;
  userData: string;
}

/** Explicit test profiles remain isolated; only the configured production profile is redirected. */
export function configurationDirectory(userDataPath: string, environment: NodeJS.ProcessEnv = process.env): string {
  if (environment.METAVERSE_CONFIGS_ROOT && environment.METAVERSE_USER_DATA_PATH &&
      resolve(userDataPath) === resolve(environment.METAVERSE_USER_DATA_PATH)) {
    return resolve(environment.METAVERSE_CONFIGS_ROOT);
  }
  return join(userDataPath, "config");
}

export function resolveApplicationRoot(appPath: string, executable: string, packaged: boolean): string {
  if (packaged) {
    let directory = dirname(executable);
    while (dirname(directory) !== directory) {
      if (basename(directory).endsWith(".app")) return dirname(directory);
      directory = dirname(directory);
    }
    return dirname(executable);
  }
  let directory = resolve(appPath);
  while (true) {
    if (existsSync(join(directory, "pnpm-workspace.yaml")) &&
        existsSync(join(directory, "apps", "desktop", "package.json"))) return realpathSync(directory);
    const parent = dirname(directory);
    if (parent === directory) throw new Error("无法定位元宇宙应用根目录；不会回退到用户目录。");
    directory = parent;
  }
}

/** Do not follow a redirected configs/outputs tree into an unrelated directory. */
export function ensureStorageDirectory(directory: string): string {
  let current = resolve(directory);
  while (true) {
    if (existsSync(current) && lstatSync(current).isSymbolicLink()) throw new Error(`应用存储目录不能通过符号链接重定向：${current}`);
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  if (!lstatSync(directory).isDirectory() || realpathSync(directory) !== resolve(directory)) {
    throw new Error(`应用存储目录不能通过符号链接重定向：${directory}`);
  }
  accessSync(directory, constants.W_OK);
  return directory;
}

interface StorageApplication {
  isPackaged: boolean;
  getAppPath(): string;
  getPath(name: "userData" | "exe"): string;
  setPath(name: "userData" | "sessionData" | "appData" | "temp" | "logs" | "crashDumps", path: string): void;
  setAppLogsPath(path: string): void;
  commandLine: { appendSwitch(name: string, value?: string): void };
}

/** Called before startup diagnostics, instance locks and session creation. */
export function configureApplicationStorage(application: StorageApplication, environment: NodeJS.ProcessEnv = process.env): ApplicationStoragePaths {
  // A --user-data-dir supplied by smoke scripts is an explicit isolated profile.
  const oldProfile = application.getPath("userData");
  const isolatedSmoke = environment.DEEPWRITE_SMOKE === "1";
  const root = realpathSync(environment.METAVERSE_APP_ROOT ??
    (isolatedSmoke ? dirname(oldProfile) : resolveApplicationRoot(application.getAppPath(), application.getPath("exe"), application.isPackaged)));
  const configs = ensureStorageDirectory(join(root, "configs"));
  const outputs = ensureStorageDirectory(join(root, "outputs"));
  const userData = ensureStorageDirectory(join(outputs, "electron"));
  const temp = ensureStorageDirectory(join(outputs, "temp"));
  const logs = ensureStorageDirectory(join(outputs, "logs"));
  // Keep Chromium's profile layout intact, including existing Local Storage and Partitions.
  const sessions = userData;
  ensureStorageDirectory(join(outputs, "exports"));
  const crashes = ensureStorageDirectory(join(outputs, "crashes"));
  const cache = ensureStorageDirectory(join(outputs, "cache"));
  if (!isolatedSmoke) {
    // Before the app name loads, Electron reports the generic "Chromium" profile, which may
    // belong to another application. Only this application's own legacy profile is migratable.
    const genericProfiles = new Set(["Chromium", "Electron"]);
    const legacyCandidates = [oldProfile, join(dirname(oldProfile), "@deepwrite/desktop")]
      .filter((path, index, all) => all.indexOf(path) === index && !genericProfiles.has(basename(path)));
    for (const legacyProfile of legacyCandidates) migrateApplicationStorage(legacyProfile, { root, configs, outputs, userData });
  }
  if (!isolatedSmoke) {
    // Chromium creates its default user-data directory before the main script runs, so a
    // redirected path must also be supplied as a command-line switch to prevent that.
    application.commandLine.appendSwitch("user-data-dir", userData);
  }
  application.setPath("appData", ensureStorageDirectory(join(outputs, "app-data")));
  application.setPath("userData", userData);
  application.setPath("sessionData", sessions);
  application.setPath("temp", temp);
  application.setPath("logs", logs);
  application.setAppLogsPath(logs);
  application.setPath("crashDumps", crashes);
  application.commandLine.appendSwitch("disk-cache-dir", cache);
  environment.METAVERSE_APP_ROOT = root;
  environment.METAVERSE_CONFIGS_ROOT = configs;
  environment.METAVERSE_OUTPUTS_ROOT = outputs;
  environment.METAVERSE_USER_DATA_PATH = userData;
  environment.DEEPWRITE_USER_DATA_PATH = userData;
  environment.TMPDIR = temp;
  environment.TMP = temp;
  environment.TEMP = temp;
  // The old path is diagnostic metadata for explicit migration, not a read fallback.
  environment.METAVERSE_PREVIOUS_USER_DATA_PATH = oldProfile;
  return { root, configs, outputs, userData };
}
