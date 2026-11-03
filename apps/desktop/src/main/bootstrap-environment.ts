import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createId } from "@deepwrite/shared";
import { resolveDeepWriteAppMode } from "./app-run-mode";

interface ApplicationPaths {
  getPath(name: "userData" | "home"): string;
  getAppPath(): string;
}
interface BootstrapEnvironmentOptions {
  environment?: NodeJS.ProcessEnv;
  cwd?: () => string;
  exists?: (path: string) => boolean;
  createInstanceId?: () => string;
}

/** One coordinator belongs to one Main process. Workers inherit its nonce,
 * including after Core/Agent/storage-worker restarts; an inherited nonce from
 * a previous Main process is deliberately replaced. */
export function createBootstrapEnvironment(
  options: BootstrapEnvironmentOptions = {}
) {
  const environment = options.environment ?? process.env;
  const exists = options.exists ?? existsSync;

  const instanceId = options.createInstanceId?.() ?? createId("main_instance");
  return (
    application: ApplicationPaths,
    configuredMode: string | undefined
  ): string => {
    const userDataPath = application.getPath("userData");
    environment.DEEPWRITE_USER_DATA_PATH = userDataPath;
    environment.DEEPWRITE_APP_MODE = resolveDeepWriteAppMode(configuredMode);

    // External legacy data is read only when the user explicitly selects an import root.
    // Never discover another application's home/profile automatically.
    const configuredProjectRoot = environment.DEEPWRITE_LEGACY_PROJECT_DATA_ROOT?.trim();
    const legacyDataRoots = configuredProjectRoot && exists(resolve(configuredProjectRoot))
      ? [resolve(configuredProjectRoot)]
      : [];
    if (legacyDataRoots.length > 0) {
      environment.DEEPWRITE_LEGACY_DATA_ROOT = legacyDataRoots[0];
      environment.DEEPWRITE_LEGACY_DATA_ROOTS = JSON.stringify(legacyDataRoots);
    } else {
      delete environment.DEEPWRITE_LEGACY_DATA_ROOT;
      delete environment.DEEPWRITE_LEGACY_DATA_ROOTS;
    }
    environment.DEEPWRITE_MAIN_INSTANCE_ID = instanceId;
    return userDataPath;
  };
}

export const configureBootstrapEnvironment = createBootstrapEnvironment();
