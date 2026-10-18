import { cp, mkdir, readFile, realpath, rename, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, relative } from "node:path";

async function packageRoot(requireFrom, name) {
  let entry;
  for (const specifier of [`${name}/package.json`, `${name}/package`, name]) {
    try {
      entry = requireFrom.resolve(specifier);
      break;
    } catch (error) {
      if (
        error.code !== "MODULE_NOT_FOUND" &&
        error.code !== "ERR_PACKAGE_PATH_NOT_EXPORTED"
      )
        throw error;
    }
  }
  if (!entry)
    throw new Error(
      `Missing Sharp runtime package ${name}. Install optional dependencies for the packaging target before building.`
    );
  let directory = dirname(await realpath(entry));
  while (true) {
    try {
      const manifest = JSON.parse(
        await readFile(join(directory, "package.json"), "utf8")
      );
      if (manifest.name === name) return { directory, manifest };
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    const parent = dirname(directory);
    if (parent === directory)
      throw new Error(`Cannot find package root for ${name}.`);
    directory = parent;
  }
}

/** Copy only the runtime JavaScript and native packages for this build target. */
export async function vendorSharpRuntime(appDir, platform, arch) {
  const os = { darwin: "mac", win32: "win", linux: "linux" }[platform];
  if (!os || !["x64", "arm64"].includes(arch))
    throw new Error(`Unsupported Sharp packaging target: ${platform}-${arch}`);
  const runtime = join(appDir, "out", "runtime", `${os}-${arch}`);
  const destination = join(runtime, "node_modules");
  const staged = join(
    runtime,
    `node_modules-${process.pid}-${Date.now()}.next`
  );
  const seen = new Set();
  const appRequire = createRequire(join(appDir, "package.json"));
  const sharp = await packageRoot(appRequire, "sharp");
  const nativeName = `@img/sharp-${platform}-${arch}`;
  const nativePackages = [
    nativeName,
    ...(platform === "win32" ? [] : [`@img/sharp-libvips-${platform}-${arch}`])
  ];
  const visit = async (requireFrom, name) => {
    if (seen.has(name)) return;
    const source = await packageRoot(requireFrom, name);
    seen.add(name);
    const target = join(staged, name);
    await mkdir(dirname(target), { recursive: true });
    await cp(source.directory, target, {
      recursive: true,
      dereference: true,
      filter: (path) =>
        !relative(source.directory, path)
          .split(/[\\/]/u)
          .includes("node_modules")
    });
    const dependencyRequire = createRequire(
      join(source.directory, "package.json")
    );
    for (const dependency of Object.keys(source.manifest.dependencies ?? {}))
      await visit(dependencyRequire, dependency);
  };
  try {
    await visit(appRequire, "sharp");
    const sharpRequire = createRequire(join(sharp.directory, "package.json"));
    for (const name of nativePackages) await visit(sharpRequire, name);
    await rm(destination, { recursive: true, force: true });
    await rename(staged, destination);
  } finally {
    await rm(staged, { recursive: true, force: true });
  }
}
