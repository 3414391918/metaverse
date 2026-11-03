import { describe, expect, it, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync, readFileSync, existsSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { configureApplicationStorage, configurationDirectory, resolveApplicationRoot } from "../storage-paths";
import { WorkspaceDirectoryStore } from "./workspace-directory-store";

const roots: string[] = [];
afterEach(() => { roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })); });
function fixture() {
  const base = realpathSync(mkdtempSync(join(tmpdir(), "metaverse-storage-")));
  roots.push(base);
  const root = join(base, "application");
  const old = join(base, "old-profile");
  mkdirSync(join(root, "apps", "desktop"), { recursive: true });
  mkdirSync(old);
  writeFileSync(join(root, "pnpm-workspace.yaml"), "packages: []");
  writeFileSync(join(root, "apps", "desktop", "package.json"), "{}");
  const paths: Record<string, string> = { userData: old, exe: join(root, "node_modules", "Electron") };
  const events: string[] = [];
  const application = {
    isPackaged: false,
    getAppPath: () => join(root, "apps", "desktop"),
    getPath: (name: "userData" | "exe") => paths[name]!,
    setPath: (name: string, path: string) => { paths[name] = path; events.push(name); },
    setAppLogsPath: (path: string) => { paths.logs = path; },
    commandLine: { appendSwitch: (name: string, value?: string) => { paths[name] = value!; } }
  };
  return { base, root, old, paths, events, application };
}
describe("application-owned storage paths", () => {
  it("resolves the development root from the application, never the current shell directory", () => {
    const f = fixture();
    expect(resolveApplicationRoot(f.application.getAppPath(), "/irrelevant", false)).toBe(f.root);
    expect(() => resolveApplicationRoot(f.old, "/irrelevant", false)).toThrow("无法定位");
  });
  it("keeps packaged storage outside the signed app bundle", () => {
    expect(resolveApplicationRoot("/Applications/Metaverse.app/Contents/Resources/app.asar", "/Applications/Metaverse.app/Contents/MacOS/Metaverse", true)).toBe("/Applications");
  });
  it("redirects config, Chromium, diagnostics, caches and temp before the caller starts services", async () => {
    const f = fixture();
    mkdirSync(join(f.old, "config"));
    writeFileSync(join(f.old, "config", "workspace-directory.json"), JSON.stringify({ version: 3, path: null, directories: [] }));
    writeFileSync(join(f.old, "Preferences"), "saved browser state");
    const environment: NodeJS.ProcessEnv = {};
    const storage = configureApplicationStorage(f.application, environment);
    expect(storage.configs).toBe(join(f.root, "configs"));
    expect(f.paths.userData).toBe(join(f.root, "outputs", "electron"));
    expect(f.paths.sessionData).toBe(f.paths.userData);
    for (const name of ["temp", "logs", "crashDumps", "disk-cache-dir"]) expect(f.paths[name]).toContain(join(f.root, "outputs"));
    expect(environment.TMPDIR).toBe(f.paths.temp);
    expect(readFileSync(join(storage.userData, "Preferences"), "utf8")).toBe("saved browser state");
    expect(existsSync(join(f.old, "Preferences"))).toBe(true);
    expect(configurationDirectory(storage.userData, environment)).toBe(storage.configs);
    const isolated = join(f.base, "test-profile");
    expect(configurationDirectory(isolated, environment)).toBe(join(isolated, "config"));
    // The production store and Utility use this same resolver; direct userData tests stay isolated.
    expect(new WorkspaceDirectoryStore(isolated).settingsPath).toBe(join(isolated, "config", "workspace-directory.json"));
  });
  it("never treats the generic Chromium profile as this application's legacy data", () => {
    const f = fixture();
    const generic = join(f.base, "Chromium");
    mkdirSync(generic, { recursive: true });
    writeFileSync(join(generic, "Preferences"), "another application's state");
    f.paths.userData = generic;
    const storage = configureApplicationStorage(f.application, {});
    expect(f.paths.userData).toBe(join(f.root, "outputs", "electron"));
    expect(existsSync(join(storage.userData, "Preferences"))).toBe(false);
    expect(readFileSync(join(generic, "Preferences"), "utf8")).toBe("another application's state");
  });
  it("fails rather than falling back when outputs is a file or a redirected directory", () => {
    const f = fixture();
    writeFileSync(join(f.root, "outputs"), "not a directory");
    expect(() => configureApplicationStorage(f.application, {})).toThrow();
    expect(f.paths.userData).toBe(f.old);
    rmSync(join(f.root, "outputs"));
    symlinkSync(f.old, join(f.root, "outputs"), "dir");
    expect(() => configureApplicationStorage(f.application, {})).toThrow("符号链接");
  });
});
