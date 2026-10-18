import {
  mkdtemp,
  mkdir,
  rm,
  writeFile,
  access,
  symlink
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { CommandEnvelopeSchema, createEnvelope } from "@deepwrite/contracts";
import type { IpcCommandContext } from "./ipc/command-types";
import { discoverToolCreatedProjects } from "./tool-created-projects";
describe("external tool project discovery", () => {
  it("registers only marked projects and leaves failed markers for retry without blocking lists", async () => {
    const root = await mkdtemp(join(tmpdir(), "virtual-world-discovery-"));
    try {
      for (const name of [
        "books/new",
        "books/old",
        "skills/new",
        "materials/broken"
      ]) {
        await mkdir(join(root, name), { recursive: true });
      }
      for (const name of ["books/new", "skills/new", "materials/broken"])
        await writeFile(join(root, name, ".virtual-world-created.json"), "{}");
      await symlink(join(root, "books/new"), join(root, "books/link"));
      const requestCommand = vi.fn(
        async (_process: unknown, cmd: { type: string; payload: unknown }) => {
          if (JSON.stringify(cmd.payload).includes("broken"))
            throw new Error("invalid project");
          return { status: "accepted" };
        }
      );
      const ctx = {
        requireWorkspaceDirectoryStore: () => ({
          list: async () => ({ path: root })
        }),
        supervisor: { requestCommand }
      } as unknown as Pick<
        IpcCommandContext,
        "requireWorkspaceDirectoryStore" | "supervisor"
      >;
      const command = CommandEnvelopeSchema.parse(
        createEnvelope("long.list", {}, { id: "discover-test" })
      );
      await discoverToolCreatedProjects(ctx, command);
      expect(requestCommand).toHaveBeenCalledTimes(3);
      expect(requestCommand.mock.calls.map(([, cmd]) => cmd.type)).toEqual([
        "long.openAtPath",
        "catalog.openProjectAtPath",
        "catalog.openProjectAtPath"
      ]);
      await expect(
        access(join(root, "books/new/.virtual-world-created.json"))
      ).rejects.toThrow();
      await expect(
        access(join(root, "skills/new/.virtual-world-created.json"))
      ).rejects.toThrow();
      await access(join(root, "materials/broken/.virtual-world-created.json"));
      await discoverToolCreatedProjects(ctx, command);
      expect(requestCommand).toHaveBeenCalledTimes(4);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
