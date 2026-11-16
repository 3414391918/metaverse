import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, realpath, rm, writeFile, readFile, lstat, symlink } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prepareAssistantStorage, assistantStoragePaths } from "./assistant-storage";
const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });
async function fixture() {
  const base = await realpath(await mkdtemp(join(tmpdir(), "assistant-storage-")));
  roots.push(base);
  const workspace = join(base, "workspace");
  const environment = { METAVERSE_CONFIGS_ROOT: join(base, "configs"), METAVERSE_OUTPUTS_ROOT: join(base, "outputs") };
  const key = createHash("sha256").update(workspace).digest("hex").slice(0, 24);
  const oldHome = join(environment.METAVERSE_OUTPUTS_ROOT, "assistant", key);
  const oldConfigs = join(environment.METAVERSE_CONFIGS_ROOT, "assistant", key);
  await mkdir(workspace);
  return { workspace, environment, oldHome, oldConfigs };
}
describe("workspace assistant storage", () => {
  it("moves sessions, attachments, credentials and plugins into one real directory", async () => {
    const f = await fixture();
    await mkdir(join(f.oldHome, "sessions"), { recursive: true });
    await mkdir(f.oldConfigs, { recursive: true });
    const plugins = join(f.workspace, "plugins", "profiles");
    await mkdir(join(plugins, "web", "node_modules"), { recursive: true });
    await symlink(plugins, join(f.oldHome, "profiles"), "dir");
    await writeFile(join(f.oldHome, "sessions", "history"), "history");
    await writeFile(join(f.oldConfigs, ".credentials.yaml"), "secret fixture");
    await writeFile(join(plugins, "web", "cordis.patch.yml"), "settings");
    await writeFile(join(f.oldHome, "metaverse.patch.json"), "old generated");
    await writeFile(join(f.oldConfigs, "metaverse.patch.json"), "new generated");
    const paths = await prepareAssistantStorage(f.workspace, f.environment);
    expect(paths.home).toBe(join(f.workspace, "assistant"));
    expect(paths.configs).toBe(paths.home);
    expect(await readFile(join(paths.home, "sessions", "history"), "utf8")).toBe("history");
    expect(await readFile(join(paths.home, ".credentials.yaml"), "utf8")).toBe("secret fixture");
    expect(await readFile(join(paths.home, "profiles", "web", "cordis.patch.yml"), "utf8")).toBe("settings");
    expect((await lstat(join(paths.home, "profiles"))).isSymbolicLink()).toBe(false);
    for (const old of [f.oldHome, f.oldConfigs, plugins]) await expect(lstat(old)).rejects.toMatchObject({ code: "ENOENT" });
    expect(await prepareAssistantStorage(f.workspace, f.environment)).toEqual(paths);
  });
  it("refuses to overwrite an existing assistant directory", async () => {
    const f = await fixture();
    await mkdir(join(f.workspace, "assistant"));
    await mkdir(f.oldHome, { recursive: true });
    await writeFile(join(f.oldHome, "keep"), "old");
    await expect(prepareAssistantStorage(f.workspace, f.environment)).rejects.toThrow("不会覆盖");
    expect(await readFile(join(f.oldHome, "keep"), "utf8")).toBe("old");
  });
  it("uses workspace storage even without environment settings", async () => {
    const f = await fixture();
    const paths = await prepareAssistantStorage(f.workspace, {});
    expect(paths.home).toBe(join(f.workspace, "assistant"));
    expect(assistantStoragePaths(f.workspace, f.environment)).toEqual(paths);
  });
  it("rejects redirected plugin sources", async () => {
    const f = await fixture();
    await mkdir(f.oldHome, { recursive: true });
    await symlink(f.workspace, join(f.oldHome, "profiles"), "dir");
    await expect(prepareAssistantStorage(f.workspace, f.environment)).rejects.toThrow("链接");
  });
});
