import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import { join } from "node:path";
import type { CommandEnvelope } from "@deepwrite/contracts";
import { createCatalogCoreHandler } from "./catalog-core-command-handler";
import { FolderCatalogStore } from "./folder-catalog-store";
import { LongWorkspaceService } from "./long-workspace-service";

interface WorkspaceScope {
  root: string;
  discovered: Set<string>;
  folderStore: FolderCatalogStore;
  longWorkspaceService: LongWorkspaceService;
  handle: ReturnType<typeof createCatalogCoreHandler>;
}
export function createWorkspaceScopedCatalog(resolvedUserDataPath: string) {
  let activeScope: Promise<WorkspaceScope> | undefined;
  let activeRoot: string | undefined;

  async function selectedRoot(): Promise<string> {
    const config = JSON.parse(
      await readFile(
        join(resolvedUserDataPath, "config", "workspace-directory.json"),
        "utf8"
      )
    ) as { path?: unknown };
    if (typeof config.path !== "string" || !config.path) {
      throw new Error("请先选择工作目录。");
    }
    const root = await realpath(config.path);
    if (!(await lstat(root)).isDirectory()) throw new Error("工作目录不可用。");
    return root;
  }

  async function discoverProjects(scope: WorkspaceScope): Promise<void> {
    for (const [category, domain] of [
      ["books", "book"],
      ["materials", "material-library"],
      ["skills", "skill-library"],
      ["material-groups", "material-group"],
      ["skill-groups", "skill-group"]
    ] as const) {
      const parent = join(scope.root, category);
      const entries = await readdir(parent, { withFileTypes: true }).catch(
        (error: NodeJS.ErrnoException) => {
          if (error.code === "ENOENT") return [];
          throw error;
        }
      );
      for (const entry of entries) {
        if (
          !entry.isDirectory() ||
          entry.isSymbolicLink() ||
          entry.name.startsWith(".")
        )
          continue;
        const directory = join(parent, entry.name);
        if (scope.discovered.has(directory)) continue;
        let kind: unknown;
        try {
          kind = (
            JSON.parse(
              await readFile(join(directory, "deepwrite.json"), "utf8")
            ) as {
              kind?: unknown;
            }
          ).kind;
        } catch {
          continue;
        }
        try {
          if (kind === "deepwrite.long-book" && domain === "book") {
            await scope.longWorkspaceService.openAtPath(directory);
          } else {
            await scope.folderStore.openCatalogProject(directory, domain);
          }
          scope.discovered.add(directory);
        } catch (error) {
          console.warn(
            `Skipping invalid workspace project: ${directory}`,
            error
          );
        }
      }
    }
  }

  async function requireScope(): Promise<WorkspaceScope> {
    const root = await selectedRoot();
    if (root !== activeRoot || !activeScope) {
      activeRoot = root;
      const initialization = (async (): Promise<WorkspaceScope> => {
        const dataPath = join(root, ".metaverse");
        const folderStore = new FolderCatalogStore({
          userDataPath: dataPath,
          projectRoot: root
        });
        const longWorkspaceService = new LongWorkspaceService({
          userDataPath: dataPath
        });
        const scope: WorkspaceScope = {
          root,
          discovered: new Set(),
          folderStore,
          longWorkspaceService,
          handle: createCatalogCoreHandler({
            requireCatalogStore: async () => folderStore,
            longWorkspaceService,
            draftRecoveryStore: folderStore
          })
        };
        await discoverProjects(scope);
        return scope;
      })();
      activeScope = initialization.catch((error: unknown) => {
        if (activeRoot === root) {
          activeRoot = undefined;
          activeScope = undefined;
        }
        throw error;
      });
    }
    return activeScope;
  }

  return async (command: CommandEnvelope) => {
    const scope = await requireScope();
    if (
      ["long.list", "catalog.index", "catalog.snapshot"].includes(command.type)
    ) {
      await discoverProjects(scope);
    }
    return scope.handle(command);
  };
}
