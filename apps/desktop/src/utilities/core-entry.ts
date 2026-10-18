import { existsSync } from "node:fs";
import { createCatalogCoreHandler } from "./catalog-core-command-handler";
import { CatalogStore } from "./catalog-store";
import { createCoreConversationRuntime } from "./core-conversation-runtime";
import { FolderCatalogStore } from "./folder-catalog-store";
import { legacyDataRootsFromEnvironment } from "./legacy-data-roots";
import { LongWorkspaceService } from "./long-workspace-service";
import { bootUtility } from "./runtime";
const userDataPath = process.env.DEEPWRITE_USER_DATA_PATH?.trim();
if (!userDataPath) {
  throw new Error("Core Utility requires DEEPWRITE_USER_DATA_PATH.");
}
const resolvedUserDataPath = userDataPath;
const legacyDataRoots = legacyDataRootsFromEnvironment();
const legacyCatalogStore = new CatalogStore({
  userDataPath: resolvedUserDataPath,
  ...(legacyDataRoots.length > 0 ? { legacyDataRoots } : {})
});

let catalogStoreInitialization: Promise<FolderCatalogStore> | undefined;
const draftRecoveryStore = new FolderCatalogStore({
  userDataPath: resolvedUserDataPath
});
const longWorkspaceService = new LongWorkspaceService({
  userDataPath: resolvedUserDataPath
});
const conversationRuntime = createCoreConversationRuntime(
  resolvedUserDataPath,
  import.meta.url
);
async function requireCatalogStore(): Promise<FolderCatalogStore> {
  if (!catalogStoreInitialization) {
    const initialization = (async () => {
      const existingFolderStore = new FolderCatalogStore({
        userDataPath: resolvedUserDataPath
      });
      if (existsSync(existingFolderStore.registryPath)) {
        await existingFolderStore.indexSnapshot();
        return existingFolderStore;
      }
      const legacySnapshot = await legacyCatalogStore.snapshot();
      const folderStore = new FolderCatalogStore({
        userDataPath: resolvedUserDataPath,
        initialSnapshot: legacySnapshot
      });
      await folderStore.indexSnapshot();
      return folderStore;
    })();
    catalogStoreInitialization = initialization.catch((error: unknown) => {
      catalogStoreInitialization = undefined;
      throw error;
    });
  }
  return await catalogStoreInitialization;
}
const handleCatalogCommand = createCatalogCoreHandler({
  requireCatalogStore,
  longWorkspaceService,
  draftRecoveryStore
});
bootUtility("core", {
  mode: "catalog-store",
  onShutdown: conversationRuntime.close,
  commandHandler: conversationRuntime.wrap(handleCatalogCommand)
});
