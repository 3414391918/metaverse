import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_LONG_AGENT_TEAM_SETTINGS,
  type AgentTeamProfile
} from "@deepwrite/contracts";
import { AgentTeamConfigStore } from "./agent-team-config-store";

const roots: string[] = [];
async function setup() {
  const root = await mkdtemp(join(tmpdir(), "virtual-world-agent-teams-"));
  roots.push(root);
  return { root, store: new AgentTeamConfigStore(root) };
}
async function writeCatalog(root: string, catalog: unknown) {
  await mkdir(join(root, "config"), { recursive: true });
  await writeFile(
    join(root, "config", "agent-team-profiles.json"),
    JSON.stringify(catalog)
  );
}
function profile(id = "team_existing", name = "现有团队"): AgentTeamProfile {
  const settings = structuredClone(DEFAULT_LONG_AGENT_TEAM_SETTINGS);
  settings.teams[0]!.subagents.push({
    id: "reviewer",
    name: "审阅",
    description: "检查连续性",
    systemPrompt: "保留成员提示词。",
    enabled: true,
    modelMode: "custom",
    modelId: "model_test",
    thinkingLevel: "medium"
  });
  return { id, name, workspaceType: "long", settings };
}
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
  );
});

describe("AgentTeamConfigStore", () => {
  it("creates one blank disabled default team at disk version five", async () => {
    const { root, store } = await setup();
    const snapshot = await store.list();
    expect(snapshot.enabledTeamIds).toEqual({});
    expect(snapshot.teams).toHaveLength(1);
    expect(snapshot.teams[0]).toMatchObject({
      name: "默认虚拟世界创作团队",
      workspaceType: "long",
      settings: DEFAULT_LONG_AGENT_TEAM_SETTINGS
    });
    expect(
      JSON.parse(
        await readFile(join(root, "config", "agent-team-profiles.json"), "utf8")
      )
    ).toMatchObject({ version: 5, enabledTeamIds: {} });
  });
  it("reads the current version-five team without changing ids, members or activation", async () => {
    const { root, store } = await setup();
    const existing = profile();
    await writeCatalog(root, {
      version: 5,
      enabledTeamIds: { long: existing.id },
      teams: [existing]
    });
    const snapshot = await store.list();
    expect(snapshot.teams).toEqual([existing]);
    expect(snapshot.enabledTeamIds).toEqual({ long: existing.id });
    expect(await store.resolve("long", "long")).toEqual(
      existing.settings.teams[0]!.subagents
    );
  });
  it("creates by name and enables at most one team", async () => {
    const { store } = await setup();
    const created = await store.create({ name: "新团队" });
    const next = created.teams.find((team) => team.name === "新团队")!;
    expect(next.settings).toEqual(DEFAULT_LONG_AGENT_TEAM_SETTINGS);
    expect(created.enabledTeamIds).toEqual({});
    await store.setEnabled({ teamId: created.teams[0]!.id, enabled: true });
    expect(
      (await store.setEnabled({ teamId: next.id, enabled: true }))
        .enabledTeamIds
    ).toEqual({ long: next.id });
    expect(
      (await store.setEnabled({ teamId: next.id, enabled: false }))
        .enabledTeamIds
    ).toEqual({});
  });
  it("retains only existing long profiles when reading a mixed catalog", async () => {
    const { root, store } = await setup();
    const existing = profile();
    await writeCatalog(root, {
      version: 5,
      enabledTeamIds: {
        short: "team_short",
        script: "team_script",
        long: existing.id
      },
      teams: [
        {
          id: "team_short",
          name: "短篇旧团队",
          workspaceType: "short",
          settings: {
            workspaceType: "short",
            teams: [{ parentAgentId: "short", subagents: [] }]
          }
        },
        {
          id: "team_script",
          name: "剧本旧团队",
          workspaceType: "script",
          settings: {
            workspaceType: "script",
            teams: [{ parentAgentId: "script", subagents: [] }]
          }
        },
        existing
      ]
    });
    const snapshot = await store.list();
    expect(snapshot.teams).toEqual([existing]);
    expect(snapshot.enabledTeamIds).toEqual({ long: existing.id });
  });
  it("migrates the legacy long file and leaves discontinued files untouched", async () => {
    const { root, store } = await setup();
    await mkdir(join(root, "config"));
    await writeFile(
      join(root, "config", "long-agent-teams.json"),
      JSON.stringify({ version: 2, ...profile().settings })
    );
    await writeFile(
      join(root, "config", "agent-teams.json"),
      "old short payload"
    );
    const snapshot = await store.list();
    expect(snapshot.teams).toHaveLength(1);
    expect(snapshot.teams[0]!.settings).toEqual(profile().settings);
    expect(snapshot.enabledTeamIds).toEqual({ long: snapshot.teams[0]!.id });
    expect(
      await readFile(join(root, "config", "agent-teams.json"), "utf8")
    ).toBe("old short payload");
  });
  it("saves and round-trips custom members and resolves only enabled members", async () => {
    const { store } = await setup();
    const team = (await store.list()).teams[0]!;
    const settings = profile().settings;
    settings.teams[0]!.subagents.push({
      ...settings.teams[0]!.subagents[0]!,
      id: "disabled",
      name: "停用成员",
      enabled: false
    });
    await store.save({ teamId: team.id, settings });
    await store.setEnabled({ teamId: team.id, enabled: true });
    expect(await store.resolve("long", "long")).toEqual([
      settings.teams[0]!.subagents[0]
    ]);
    expect((await store.exportProfile({ teamId: team.id })).settings).toEqual(
      settings
    );
  });
  it("installs current long profiles with fresh ids and duplicate-safe names without enabling", async () => {
    const { store } = await setup();
    const source = profile();
    const first = await store.installProfile(source);
    const second = await store.installProfile(source);
    expect(first.team.id).not.toBe(source.id);
    expect(first.team.settings).toEqual(source.settings);
    expect(second.team.name).toBe("现有团队 (2)");
    expect(second.catalog.enabledTeamIds).toEqual({});
  });
  it("protects enabled and last teams and rejects duplicate names", async () => {
    const { store } = await setup();
    const original = (await store.list()).teams[0]!;
    await expect(store.delete({ teamId: original.id })).rejects.toThrow(
      "至少需要保留一个"
    );
    await expect(store.create({ name: original.name })).rejects.toThrow(
      "已存在"
    );
    await store.setEnabled({ teamId: original.id, enabled: true });
    await expect(store.delete({ teamId: original.id })).rejects.toThrow(
      "已启用"
    );
  });
  it("refuses invalid current data without replacing the stored file", async () => {
    const { root, store } = await setup();
    const raw = {
      version: 5,
      enabledTeamIds: { long: "missing" },
      teams: [profile()]
    };
    await writeCatalog(root, raw);
    await expect(store.list()).rejects.toThrow("配置");
    expect(
      JSON.parse(
        await readFile(join(root, "config", "agent-team-profiles.json"), "utf8")
      )
    ).toEqual(raw);
  });
});
