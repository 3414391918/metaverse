/** Explicit offline migration. Retains the old profile until runtime verification succeeds. */
import { createRequire } from "node:module";
import { readFileSync, mkdirSync, realpathSync, readdirSync, lstatSync, cpSync, existsSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
const require = createRequire(import.meta.url);
const ts = require("typescript");
const cache = new Map();
function loadTypeScript(file) {
  file = resolve(file);
  if (cache.has(file)) return cache.get(file);
  const exports = {};
  cache.set(file, exports);
  const compiled = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function("require", "exports", compiled)(
    id => id.startsWith(".") ? loadTypeScript(resolve(dirname(file), id + ".ts")) : require(id), exports
  );
  return exports;
}
function argument(name) { const index = process.argv.indexOf(name); return index < 0 ? undefined : process.argv[index + 1]; }
const root = realpathSync(argument("--root") ?? resolve(dirname(fileURLToPath(import.meta.url)), ".."));
const source = argument("--source");
if (!source) throw new Error("--source must be the verified, closed application's profile directory");
const storage = { root, configs: join(root, "configs"), outputs: join(root, "outputs"), userData: join(root, "outputs", "electron") };
mkdirSync(storage.configs, { recursive: true, mode: 0o700 });
mkdirSync(storage.outputs, { recursive: true, mode: 0o700 });
const { migrateApplicationStorage } = loadTypeScript(join(root, "apps/desktop/src/main/application-storage-migration.ts"));
console.log("Profile migration:", migrateApplicationStorage(source, storage));
const { prepareAssistantStorage } = loadTypeScript(join(root, "apps/desktop/src/main/assistant-storage.ts"));
const settings = JSON.parse(readFileSync(join(storage.configs, "workspace-directory.json"), "utf8"));
for (const workspace of new Set(settings.directories ?? [])) {
  if (!existsSync(workspace)) continue;
  const result = await prepareAssistantStorage(realpathSync(workspace), {
    METAVERSE_OUTPUTS_ROOT: storage.outputs, METAVERSE_CONFIGS_ROOT: storage.configs
  });
  console.log("Assistant storage prepared:", { workspace, home: result.home, configs: result.configs, sourcePreserved: true });
}
const oldRuntime = join(root, ".runtime");
if (existsSync(oldRuntime)) {
  const target = join(storage.outputs, "logs", "legacy-runtime");
  if (!existsSync(target)) cpSync(oldRuntime, target, { recursive: true, force: false, errorOnExist: true, dereference: false });
  const entries = [];
  const verify = (from, to) => {
    const info = lstatSync(from);
    if (info.isSymbolicLink()) throw new Error("Legacy runtime contains a symlink");
    if (info.isDirectory()) { for (const name of readdirSync(from)) verify(join(from, name), join(to, name)); return; }
    if (!info.isFile()) throw new Error("Legacy runtime contains a special file");
    const hash = path => createHash("sha256").update(readFileSync(path)).digest("hex");
    const sha256 = hash(from);
    if (hash(to) !== sha256) throw new Error("Legacy runtime content mismatch");
    entries.push({ source: from, target: to, sha256 });
  };
  verify(oldRuntime, target);
  writeFileSync(join(storage.outputs, "migrations", "legacy-runtime.json"), JSON.stringify({ version: 1, verified: true, sourcePreserved: true, files: entries }, null, 2), { flag: "wx", mode: 0o600 });
  console.log("Legacy runtime files verified:", entries.length);
}
console.log("All sources retained. Remove only after application and window verification.");
