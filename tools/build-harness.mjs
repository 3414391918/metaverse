/** Stage the pinned production runtime, independent of the upstream checkout. */
import {
  cp,
  mkdir,
  readFile,
  access,
  rm,
  readdir,
  realpath,
  writeFile
} from "node:fs/promises";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { resolve, join, isAbsolute, dirname, relative, sep } from "node:path";
import { readlink, symlink } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import { configureVeniceDefaults } from "./harness-venice-defaults.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
const out = resolve(root, "apps/desktop/out/harness");

function pnpm(args) {
  return new Promise((accept, reject) => {
    const child = spawn(
      process.execPath,
      [
        resolve(root, "apps/harness/node_modules/pnpm/bin/pnpm.cjs"),
        "--pm-on-fail=ignore",
        ...args
      ],
      {
        cwd: root,
        stdio: "inherit",
        env: { ...process.env, CI: "true" },
        shell: false
      }
    );
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0
        ? accept()
        : reject(new Error(`Harness dependency command failed: ${code}`))
    );
  });
}
function supports(values, target) {
  values = typeof values === "string" ? [values] : values;
  if (!values?.length || values.includes("any")) return true;
  const positive = values.filter((value) => !value.startsWith("!"));
  return (
    !values.includes(`!${target}`) &&
    (!positive.length || positive.includes(target))
  );
}
/** Cross packaging installs all optional packages, then retains only the target's variants. */
async function pruneForeignPackages(runtime, platform, arch) {
  const store = join(runtime, "node_modules/.pnpm");
  for (const folder of await readdir(store, { withFileTypes: true })) {
    if (!folder.isDirectory() || folder.name === "node_modules") continue;
    const modules = join(store, folder.name, "node_modules");
    const inspect = async (directory) => {
      for (const item of await readdir(directory, { withFileTypes: true })) {
        if (!item.isDirectory()) continue;
        const path = join(directory, item.name);
        if (item.name.startsWith("@")) {
          await inspect(path);
          continue;
        }
        try {
          const manifest = JSON.parse(
            await readFile(join(path, "package.json"), "utf8")
          );
          if (!supports(manifest.os, platform) || !supports(manifest.cpu, arch))
            await rm(path, { recursive: true, force: true });
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
        }
      }
    };
    await inspect(modules);
  }
  const removeDanglingLinks = async (directory) => {
    for (const item of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, item.name);
      if (item.isSymbolicLink()) {
        try {
          await realpath(path);
        } catch (error) {
          if (error.code === "ENOENT") await rm(path);
          else throw error;
        }
      } else if (item.isDirectory()) await removeDanglingLinks(path);
    }
  };
  await removeDanglingLinks(join(runtime, "node_modules"));
}
async function makeLinksPortable(directory, boundary) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, item.name);
    if (item.isDirectory()) await makeLinksPortable(path, boundary);
    else if (item.isSymbolicLink()) {
      let target;
      try {
        target = await realpath(path);
      } catch (error) {
        if (error.code === "ENOENT") {
          await rm(path);
          continue;
        }
        throw error;
      }
      const inside = relative(boundary, target);
      if (
        isAbsolute(inside) ||
        inside === ".." ||
        inside.startsWith(`..${sep}`)
      ) {
        // Legacy deploy also hoists aliases for unrelated source workspaces.
        await rm(path);
        continue;
      }
      if (isAbsolute(await readlink(path))) {
        await rm(path);
        await symlink(relative(dirname(path), target), path, "file");
      }
    }
  }
}
/** Keep the embedded command menu flat and limited to the controls used here. */
async function customizeMetaverseCommandMenu(runtime) {
  const store = join(runtime, "node_modules/.pnpm");
  const packages = (await readdir(store)).filter((name) =>
    name.startsWith("@deepseek-ai+dsh-client-ui-commands@0.2.1-rc.2_")
  );
  if (packages.length !== 1)
    throw new Error("Expected the pinned Harness command UI package.");
  const file = join(
    store,
    packages[0],
    "node_modules/@deepseek-ai/dsh-client-ui-commands/lib/client.js"
  );
  const source = await readFile(file, "utf8");
  if (source.includes("metaverse-flat-command-menu")) return;
  const start = source.indexOf("function sectionRows(rows, t) {");
  const end = source.indexOf("\n\t\t//#endregion", start);
  const visible =
    'const visible = rows.filter((c) => req.position === "leading" || c.hint === void 0);';
  if (start < 0 || end < 0 || !source.includes(visible))
    throw new Error("Pinned Harness command menu implementation changed.");
  const menu = `function sectionRows(rows, _t) {
            // metaverse-flat-command-menu: one list, without Add/Commands headings.
            const order = ["file", "tool", "goal", "plan", "compact", "export"];
            const excluded = new Set(["feedback", "model", "permission"]);
            const byName = new Map(rows.map((row) => [row.name, row]));
            return [...order.flatMap((name) => byName.has(name) ? [byName.get(name)] : []),
                ...rows.filter((row) => !order.includes(row.name) && !excluded.has(row.name))];
        }`;
  let patched = source.slice(0, start) + menu + source.slice(end);
  patched = patched.replace(
    visible,
    'const visible = rows.filter((c) => !["feedback", "model", "permission"].includes(c.name) && (req.position === "leading" || c.hint === void 0));'
  );
  await writeFile(file, patched);
}
async function customizeVeniceModelDefaults(runtime) {
  const store = join(runtime, "node_modules/.pnpm");
  const packages = (await readdir(store)).filter((name) =>
    name.startsWith("@deepseek-ai+dsh-base@0.2.1-rc.2_")
  );
  if (packages.length !== 1)
    throw new Error("Expected the pinned Harness base package.");
  const file = join(
    store,
    packages[0],
    "node_modules/@deepseek-ai/dsh-base/cordis.patch.yml"
  );
  const source = await readFile(file, "utf8");
  const configured = configureVeniceDefaults(source);
  if (configured !== source) await writeFile(file, configured);
}
export async function stageHarness({
  platform = process.platform,
  arch = process.arch
} = {}) {
  if (
    !["darwin", "linux", "win32"].includes(platform) ||
    !["x64", "arm64"].includes(arch)
  )
    throw new Error(`Unsupported Harness target: ${platform}-${arch}`);
  await mkdir(out, { recursive: true });
  await cp(
    resolve(root, "integrations/harness/plugin"),
    resolve(out, "plugin"),
    { recursive: true }
  );
  await build({
    configFile: false,
    publicDir: false,
    logLevel: "error",
    build: {
      outDir: resolve(out, "plugin"),
      emptyOutDir: false,
      minify: false,
      lib: {
        entry: resolve(root, "integrations/harness/plugin/client.js"),
        name: "MetaverseHarnessIntegration",
        formats: ["iife"],
        fileName: () => "client.js"
      }
    }
  });
  const runtime = resolve(out, "runtime");
  const stamp = createHash("sha256")
    .update(await readFile(resolve(root, "pnpm-lock.yaml")))
    .update(platform)
    .update(arch)
    .update("target-platform-only-v2")
    .digest("hex");
  let current;
  try {
    current = await readFile(resolve(runtime, ".metaverse-stamp"), "utf8");
    await access(resolve(runtime, "node_modules/@deepseek-ai/dsh/lib/bin.js"));
    await access(resolve(runtime, "node_modules/pnpm/bin/pnpm.cjs"));
  } catch {
    current = undefined;
  }
  if (current !== stamp) {
    await rm(runtime, { recursive: true, force: true });
    const cross = platform !== process.platform || arch !== process.arch;
    try {
      await pnpm([
        "--filter",
        "@metaverse/harness-runtime",
        "deploy",
        "--prod",
        "--legacy",
        ...(cross ? ["--force"] : []),
        runtime
      ]);
      if (cross) await pruneForeignPackages(runtime, platform, arch);
      await writeFile(resolve(runtime, ".metaverse-stamp"), stamp);
    } finally {
      // Legacy deploy records production install preferences in the source workspace.
      await pnpm(["install", "--prod=false", "--frozen-lockfile"]);
    }
  }
  await customizeMetaverseCommandMenu(runtime);
  await customizeVeniceModelDefaults(runtime);
  const nodePackage =
    platform === "darwin" && arch === "arm64"
      ? "node-bin-darwin-arm64"
      : `node-${platform === "win32" ? "win" : platform}-${arch}`;
  const nodeRoot = await realpath(join(runtime, "node_modules", nodePackage));
  const nodeVersion = JSON.parse(
    await readFile(join(nodeRoot, "package.json"), "utf8")
  ).version;
  const target = JSON.stringify({ platform, arch, nodeVersion });
  const nodeDirectory = join(out, "node");
  const nodeBinary = join(
    nodeDirectory,
    platform === "win32" ? "node.exe" : "node"
  );
  let staged;
  try {
    staged = await readFile(join(nodeDirectory, "target.json"), "utf8");
    await access(nodeBinary);
  } catch {
    staged = undefined;
  }
  if (staged !== target) {
    await mkdir(nodeDirectory, { recursive: true });
    await cp(
      join(nodeRoot, platform === "win32" ? "bin/node.exe" : "bin/node"),
      nodeBinary
    );
    await cp(join(nodeRoot, "LICENSE"), join(nodeDirectory, "LICENSE"));
    await writeFile(join(nodeDirectory, "target.json"), target);
  }
  // Keep one physical executable outside the dependency symlinks for ASAR packaging.
  for (const entry of ["bin", "include", "share"])
    await rm(join(nodeRoot, entry), { recursive: true, force: true });
  await makeLinksPortable(join(runtime, "node_modules"), runtime);
  await cp(
    resolve(root, "apps/harness/launch.mjs"),
    resolve(runtime, "launch.mjs")
  );
  await writeFile(
    resolve(runtime, ".metaverse-target.json"),
    JSON.stringify({ platform, arch })
  );
  console.log(`Harness production runtime staged (${platform}-${arch}).`);
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await stageHarness();
