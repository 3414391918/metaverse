import { createCoreConversationRuntime } from "./core-conversation-runtime";
import { bootUtility } from "./runtime";
import { createWorkspaceScopedCatalog } from "./workspace-scoped-catalog";

const userDataPath = process.env.DEEPWRITE_USER_DATA_PATH?.trim();
if (!userDataPath)
  throw new Error("Core Utility requires DEEPWRITE_USER_DATA_PATH.");

const conversationRuntime = createCoreConversationRuntime(
  userDataPath,
  import.meta.url
);
bootUtility("core", {
  mode: "catalog-store",
  onShutdown: conversationRuntime.close,
  commandHandler: conversationRuntime.wrap(
    createWorkspaceScopedCatalog(userDataPath)
  )
});
