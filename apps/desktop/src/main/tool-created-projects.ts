import { lstat, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import {
  CommandEnvelopeSchema,
  createEnvelope,
  type CommandEnvelope
} from "@deepwrite/contracts";
import type { IpcCommandContext } from "./ipc/command-types";

const pending = new Map<string, Promise<void>>();
export async function discoverToolCreatedProjects(
  ctx: Pick<IpcCommandContext, "requireWorkspaceDirectoryStore" | "supervisor">,
  command: CommandEnvelope
): Promise<void> {
  if (
    !["long.list", "catalog.index", "catalog.snapshot"].includes(
      command.type
    ) ||
    !ctx.requireWorkspaceDirectoryStore
  )
    return;
  const { path: root } = await ctx.requireWorkspaceDirectoryStore().list();
  if (!root) return;
  const existing = pending.get(root);
  if (existing) return existing;
  const scan = async () => {
    for (const category of ["books", "skills", "materials"] as const) {
      const parent = join(root, category);
      const parentInfo = await lstat(parent).catch(() => null);
      if (!parentInfo?.isDirectory() || parentInfo.isSymbolicLink()) continue;
      for (const entry of await readdir(parent, { withFileTypes: true }).catch(
        () => []
      )) {
        if (
          !entry.isDirectory() ||
          entry.isSymbolicLink() ||
          entry.name.startsWith(".")
        )
          continue;
        const directory = join(parent, entry.name);
        const marker = join(directory, ".virtual-world-created.json");
        const info = await lstat(marker).catch(() => null);
        if (!info?.isFile() || info.isSymbolicLink()) continue;
        const internal = CommandEnvelopeSchema.parse(
          category === "books"
            ? createEnvelope(
                "long.openAtPath",
                { projectDirectory: directory },
                {
                  id: `${command.id}_discover_${entry.name}`,
                  context: command.context
                }
              )
            : createEnvelope(
                "catalog.openProjectAtPath",
                {
                  projectDirectory: directory,
                  domain: category === "skills" ? "skill" : "material"
                },
                {
                  id: `${command.id}_discover_${entry.name}`,
                  context: command.context
                }
              )
        );
        const result = await ctx.supervisor
          .requestCommand("core", internal, 60000)
          .catch(() => undefined);
        if (result?.status === "accepted") await rm(marker, { force: true });
      }
    }
  };
  const task = scan();
  pending.set(root, task);
  try {
    await task;
  } finally {
    if (pending.get(root) === task) pending.delete(root);
  }
}
