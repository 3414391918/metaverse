import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, realpathSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrateApplicationStorage } from "./application-storage-migration";
const roots: string[] = [];
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));
function fixture() {
  const base = realpathSync(mkdtempSync(join(tmpdir(), "metaverse-profile-migration-")));
  roots.push(base);
  const source = join(base, "old-profile");
  const root = join(base, "application");
  const storage = { root, configs: join(root, "configs"), outputs: join(root, "outputs"), userData: join(root, "outputs", "electron") };
  mkdirSync(join(source, "config"), { recursive: true });
  mkdirSync(storage.configs, { recursive: true });
  return { source, storage };
}
describe("application profile migration", () => {
  it("refuses migration while the legacy profile is locked by a live process", () => {
    const f = fixture();
    symlinkSync(`localhost-${process.ppid}`, join(f.source, "SingletonLock"));
    expect(() => migrateApplicationStorage(f.source, f.storage)).toThrow("旧元宇宙实例仍在运行");
    expect(existsSync(join(f.storage.outputs, "migrations", "application-profile.json"))).toBe(false);
  });
  it("copies and verifies config and browser state, retains the source and does not reimport old config", () => {
    const f = fixture();
    writeFileSync(join(f.source, "config", "models.json"), "fixture-models");
    mkdirSync(join(f.source, "Local Storage"));
    writeFileSync(join(f.source, "Local Storage", "fixture.txt"), "saved session");
    expect(migrateApplicationStorage(f.source, f.storage).copied).toBe(2);
    expect(readFileSync(join(f.storage.configs, "models.json"), "utf8")).toBe("fixture-models");
    expect(readFileSync(join(f.storage.userData, "Local Storage", "fixture.txt"), "utf8")).toBe("saved session");
    expect(existsSync(join(f.source, "config", "models.json"))).toBe(true);
    writeFileSync(join(f.storage.configs, "models.json"), "new preference");
    expect(migrateApplicationStorage(f.source, f.storage).copied).toBe(0);
    expect(readFileSync(join(f.storage.configs, "models.json"), "utf8")).toBe("new preference");
  });
  it("preflights conflicts without copying anything or altering either configuration", () => {
    const f = fixture();
    writeFileSync(join(f.source, "config", "a.json"), "source-a");
    writeFileSync(join(f.source, "config", "b.json"), "source-b");
    writeFileSync(join(f.storage.configs, "b.json"), "target-b");
    expect(() => migrateApplicationStorage(f.source, f.storage)).toThrow("不会覆盖");
    expect(existsSync(join(f.storage.configs, "a.json"))).toBe(false);
    expect(readFileSync(join(f.storage.configs, "b.json"), "utf8")).toBe("target-b");
    expect(readFileSync(join(f.source, "config", "b.json"), "utf8")).toBe("source-b");
  });
  it("rejects source symlinks and overlapping roots", () => {
    const f = fixture();
    writeFileSync(join(f.source, "config", "real.json"), "fixture");
    symlinkSync(join(f.source, "config", "real.json"), join(f.source, "config", "linked.json"));
    expect(() => migrateApplicationStorage(f.source, f.storage)).toThrow("符号链接");
    expect(() => migrateApplicationStorage(f.storage.root, f.storage)).toThrow("互相包含");
  });
});
