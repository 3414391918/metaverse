import { mkdir, readFile, readdir } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import {
  ContextToolRequestSchema,
  ToolkitDirectorySchema,
  ToolkitDirectoriesSchema,
  describeContextToolSchema,
  CreateLibraryInputSchema,
  SaveLibraryEntryInputSchema,
  CreateLibraryEntryInputSchema,
  RemoveLibraryEntryInputSchema,
  UpdateLibraryInputSchema
} from "@deepwrite/contracts";
import { FolderCatalogStore } from "../../apps/desktop/src/utilities/folder-catalog-store";
import { runWorkspaceAction } from "./workspace-engine";
import { markForDesktopDiscovery } from "./discovery";

function absolute(raw: unknown): string {
  const path = ToolkitDirectorySchema.parse(raw);
  if (!isAbsolute(path)) throw new Error("请提供目录绝对路径。");
  return path;
}

export async function runContextAction(
  workDirectory: string,
  raw: unknown
): Promise<unknown> {
  const root = absolute(workDirectory);
  const { action, input } = ContextToolRequestSchema.parse(raw);
  if (action === "schema") {
    return describeContextToolSchema(input.name);
  }
  if (action === "bookContext") {
    const path = absolute(input.bookDirectory);
    const index = (await runWorkspaceAction(path, { action: "index" })) as {
      summary: unknown;
      workspaceIndex: unknown;
    };
    return {
      summary: index.summary,
      agentsMd: await runWorkspaceAction(path, { action: "agents.read" }),
      libraries: await runContextAction(root, { action: "list" })
    };
  }
  if (action === "list") {
    const directories = new Set<string>();
    for (const category of ["skills", "materials"]) {
      for (const entry of await readdir(join(root, category), {
        withFileTypes: true
      }).catch(() => [])) {
        if (entry.isDirectory() && !entry.isSymbolicLink())
          directories.add(join(root, category, entry.name));
      }
    }
    try {
      const saved = JSON.parse(
        await readFile(
          join(root, "tools/creation-context/libraries.json"),
          "utf8"
        )
      ) as { libraryDirectories?: unknown };
      for (const path of ToolkitDirectoriesSchema.parse(
        saved.libraryDirectories ?? []
      ))
        directories.add(absolute(path));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    const libraries: unknown[] = [];
    const warnings: string[] = [];
    for (const directory of directories) {
      try {
        const manifest = JSON.parse(
          await readFile(join(directory, "deepwrite.json"), "utf8")
        ) as {
          kind: string;
          id: string;
          title: string;
          entries?: Array<{ id: string; title: string; path: string }>;
          revision: number;
        };
        if (
          !["deepwrite.skill-library", "deepwrite.material-library"].includes(
            manifest.kind
          )
        )
          continue;
        libraries.push({
          directory,
          id: manifest.id,
          title: manifest.title,
          kind: manifest.kind,
          revision: manifest.revision,
          entries:
            manifest.entries?.map(({ id, title, path }) => ({
              id,
              title,
              path
            })) ?? []
        });
      } catch (error) {
        warnings.push(
          `${directory}：${error instanceof Error ? error.message : "无法读取"}`
        );
      }
    }
    return { libraries, warnings };
  }
  const stateDirectory = join(root, "tools/creation-context/.state");
  await mkdir(stateDirectory, { recursive: true });
  const store = new FolderCatalogStore({ userDataPath: stateDirectory });
  if (action === "createLibrary") {
    const parsed = CreateLibraryInputSchema.parse(input);
    const parentDirectory = join(
      root,
      parsed.domain === "skill" ? "skills" : "materials"
    );
    await mkdir(parentDirectory, { recursive: true });
    const created = await store.createLibrary({ ...parsed, parentDirectory });
    await markForDesktopDiscovery(created.projectDirectory);
    return created;
  }
  const { libraryDirectory, ...fields } = input;
  const directory = absolute(libraryDirectory);
  const manifest = JSON.parse(
    await readFile(join(directory, "deepwrite.json"), "utf8")
  ) as { kind: string };
  const domain =
    manifest.kind === "deepwrite.skill-library"
      ? "skill"
      : manifest.kind === "deepwrite.material-library"
        ? "material"
        : null;
  if (!domain) throw new Error("指定目录不是技能库或素材库。");
  const opened =
    domain === "skill"
      ? await store.openSkillProject(directory)
      : await store.openMaterialProject(directory);
  const libraryId = opened.resource.id;
  const request = { ...fields, domain, libraryId };
  switch (action) {
    case "read": {
      const id = typeof fields.entryId === "string" ? fields.entryId : null;
      if (!id)
        return {
          ...(await store.readDocument({
            projectId: libraryId,
            target: "overview"
          })),
          directory,
          projectRevision: opened.revision,
          overview: opened.resource.overview,
          title: opened.resource.title,
          entries: opened.resource.entries.map(({ id, title }) => ({
            id,
            title
          }))
        };
      const entry = opened.resource.entries.find((item) => item.id === id);
      if (!entry) throw new Error("条目不存在。");
      const document = await store.readDocument({
        projectId: libraryId,
        target: "document",
        documentId: id
      });
      return {
        directory,
        projectRevision: opened.revision,
        entry: {
          ...entry,
          content: document.content,
          revision: document.revision
        }
      };
    }
    case "createEntry":
      return store.createLibraryEntry(
        CreateLibraryEntryInputSchema.parse(request)
      );
    case "saveEntry":
      return store.saveLibraryEntry(SaveLibraryEntryInputSchema.parse(request));
    case "deleteEntry":
      return store.removeLibraryEntry(
        RemoveLibraryEntryInputSchema.parse(request)
      );
    case "updateLibrary":
      return store.updateLibrary(UpdateLibraryInputSchema.parse(request));
  }
}
