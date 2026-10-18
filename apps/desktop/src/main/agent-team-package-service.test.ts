import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BrowserWindow, Dialog } from "electron";
import { DEFAULT_LONG_AGENT_TEAM_SETTINGS } from "@deepwrite/contracts";
import { AgentTeamConfigStore } from "./agent-team-config-store";
import { createAgentTeamPackage } from "./agent-team-package-archive";
import {
  downloadAgentTeamPackage,
  installAgentTeamPackage
} from "./agent-team-package-service";

const roots = new Set<string>();

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "deepwrite-agent-team-package-"));
  roots.add(root);
  return root;
}

afterEach(async () => {
  await Promise.all(
    [...roots].map((root) => rm(root, { recursive: true, force: true }))
  );
  roots.clear();
});

describe("agent team package service", () => {
  it("downloads a selected team and installs the uploaded archive", async () => {
    const root = await temporaryRoot();
    const store = new AgentTeamConfigStore(root);
    const source = (await store.list()).teams[0]!;
    const archivePath = join(root, "团队.deepwrite-team.zip");
    const dialog = {
      showSaveDialog: vi.fn().mockResolvedValue({
        canceled: false,
        filePath: archivePath
      }),
      showOpenDialog: vi.fn().mockResolvedValue({
        canceled: false,
        filePaths: [archivePath]
      })
    } as unknown as Pick<Dialog, "showOpenDialog" | "showSaveDialog">;
    const window = {} as BrowserWindow;

    await expect(
      downloadAgentTeamPackage(
        window,
        dialog,
        store,
        { teamId: source.id },
        root
      )
    ).resolves.toEqual({ status: "saved", filePath: archivePath });
    const installed = await installAgentTeamPackage(
      window,
      dialog,
      store,
      root
    );

    expect(installed).toMatchObject({
      status: "installed",
      teamName: `${source.name} (2)`
    });
    if (installed.status === "installed") {
      expect(installed.catalog.teams).toHaveLength(2);
    }
  });

  it("installs long archives alongside migrated current long settings", async () => {
    const root = await temporaryRoot();
    const config = join(root, "config");
    await mkdir(config);
    await writeFile(
      join(config, "long-agent-teams.json"),
      JSON.stringify({ version: 2, ...DEFAULT_LONG_AGENT_TEAM_SETTINGS })
    );
    const archivePath = join(root, "待安装.deepwrite-team.zip");
    await writeFile(
      archivePath,
      createAgentTeamPackage({
        id: "team_package_source",
        name: "安装测试团队",
        workspaceType: "long",
        settings: DEFAULT_LONG_AGENT_TEAM_SETTINGS
      })
    );
    const dialog = {
      showOpenDialog: vi
        .fn()
        .mockResolvedValue({ canceled: false, filePaths: [archivePath] })
    } as unknown as Pick<Dialog, "showOpenDialog" | "showSaveDialog">;
    const installed = await installAgentTeamPackage(
      {} as BrowserWindow,
      dialog,
      new AgentTeamConfigStore(root),
      root
    );
    expect(installed).toMatchObject({
      status: "installed",
      teamName: "安装测试团队"
    });
    if (installed.status === "installed")
      expect(installed.catalog.teams).toHaveLength(2);
    expect(
      JSON.parse(
        await readFile(join(config, "agent-team-profiles.json"), "utf8")
      )
    ).toMatchObject({ version: 5 });
  });
});
