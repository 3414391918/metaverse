import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, realpath, rm, writeFile, readFile, lstat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prepareAssistantStorage, assistantStoragePaths } from "./assistant-storage";
import { assistantOverlay } from "./assistant-runtime";
const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });
async function fixture() {
  const base = await realpath(await mkdtemp(join(tmpdir(), "assistant-storage-")));
  roots.push(base);
  const workspace = join(base, "external-workspace");
  const configs = join(base, "app", "configs");
  const outputs = join(base, "app", "outputs");
  await Promise.all([mkdir(workspace), mkdir(configs, { recursive: true }), mkdir(outputs, { recursive: true })]);
  const environment = { METAVERSE_CONFIGS_ROOT: configs, METAVERSE_OUTPUTS_ROOT: outputs };
  return { workspace, configs, outputs, environment };
}
describe("assistant storage split", () => {
  it("keeps an external workspace allowed, stores config in configs and sessions/runtime in outputs", async () => {
    const f = await fixture();
    const legacy = join(f.workspace, "assistant");
    await mkdir(join(legacy, "profiles", "web"), { recursive: true });
    await mkdir(join(legacy, "sessions"));
    await writeFile(join(legacy, "profiles", "web", "cordis.patch.yml"), "saved model preference");
    await writeFile(join(legacy, "sessions", "session.txt"), "saved conversation");
    await writeFile(join(legacy, ".credentials.yaml"), "fixture credentials");
    const paths = await prepareAssistantStorage(f.workspace, f.environment);
    expect(paths.home).toContain(f.outputs);
    expect(paths.configs).toContain(f.configs);
    expect(await readFile(join(paths.home, "sessions", "session.txt"), "utf8")).toBe("saved conversation");
    expect(await readFile(join(paths.configs, "profiles", "web", "cordis.patch.yml"), "utf8")).toBe("saved model preference");
    expect(await readFile(join(paths.configs, ".credentials.yaml"), "utf8")).toBe("fixture credentials");
    expect(await realpath(join(paths.home, "profiles"))).toBe(join(paths.configs, "profiles"));
    expect((await lstat(join(legacy, "profiles"))).isDirectory()).toBe(true);
    expect(await prepareAssistantStorage(f.workspace, f.environment)).toEqual(paths);
    const overlay = assistantOverlay("/plugin", f.workspace, paths.configs);
    expect(overlay).toContainEqual({ id: "credentials", config: { path: join(paths.configs, ".credentials.yaml") } });
  });
  it("uses separate stable assistant homes for different user directories", async () => {
    const f = await fixture();
    const first = assistantStoragePaths(f.workspace, f.environment);
    const second = assistantStoragePaths(join(f.workspace, "another"), f.environment);
    expect(first.home).not.toBe(second.home);
    expect(assistantStoragePaths(f.workspace, f.environment)).toEqual(first);
  });
  it("does not overwrite an existing profile during a legacy migration conflict", async () => {
    const f = await fixture();
    const legacy = join(f.workspace, "assistant");
    await mkdir(join(legacy, "profiles"), { recursive: true });
    const paths = assistantStoragePaths(f.workspace, f.environment);
    await mkdir(join(paths.configs, "profiles"), { recursive: true });
    await writeFile(join(paths.configs, "profiles", "kept.txt"), "existing configuration");
    await expect(prepareAssistantStorage(f.workspace, f.environment)).rejects.toThrow("不会覆盖");
    expect(await readFile(join(paths.configs, "profiles", "kept.txt"), "utf8")).toBe("existing configuration");
    expect((await lstat(join(legacy, "profiles"))).isDirectory()).toBe(true);
  });
});
