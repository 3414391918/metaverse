import { createRequire } from "node:module";
import {
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  stat,
  symlink,
  unlink,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, it } from "vitest";

const appDirectory = resolve("apps/desktop");
const require = createRequire(join(appDirectory, "package.json"));
const {
  beforeBuild
} = require("../desktop/scripts/electron-builder-before-build.cjs");
const builderRequire = createRequire(require.resolve("electron-builder"));
const libRequire = createRequire(builderRequire.resolve("app-builder-lib"));
const { getFileMatchers } = libRequire("./fileMatcher.js");
const yaml = libRequire("js-yaml");

it("vendors Sharp with a real native codec into an isolated packaged runtime directory", async () => {
  const root = await realpath(
    await mkdtemp(join(tmpdir(), "deepwrite-sharp-package-"))
  );
  try {
    await writeFile(join(root, "package.json"), '{"name":"packaging-fixture"}');
    await symlink(
      join(appDirectory, "node_modules"),
      join(root, "node_modules")
    );
    const result = await beforeBuild({
      appDir: root,
      platform: { nodeName: process.platform },
      arch: process.arch
    });
    expect(result).toBe(false);
    await unlink(join(root, "node_modules"));
    const platform =
      process.platform === "darwin"
        ? "mac"
        : process.platform === "win32"
          ? "win"
          : "linux";
    const runtime = join(root, "out", "runtime", `${platform}-${process.arch}`);
    const config = yaml.load(
      await readFile(join(appDirectory, "electron-builder.yml"), "utf8")
    );
    const matchers = getFileMatchers(
      config,
      "asarUnpack",
      join(root, "Resources", "app"),
      {
        defaultSrc: root,
        globalOutDir: join(root, "release"),
        customBuildOptions: {},
        macroExpander: (value) =>
          value
            .replaceAll("${os}", platform)
            .replaceAll("${arch}", process.arch)
      }
    );
    const nativeDirectory = join(
      runtime,
      "node_modules",
      "@img",
      `sharp-${process.platform}-${process.arch}`,
      "lib"
    );
    const nativeName = (await readdir(nativeDirectory)).find((name) =>
      name.endsWith(".node")
    );
    const native = join(nativeDirectory, nativeName);
    expect(matchers[0].createFilter()(native, await stat(native))).toBe(true);
    const entry = join(runtime, "main", "utilities", "core-entry.cjs");
    const packageRequire = createRequire(entry);
    expect(packageRequire.resolve("sharp").startsWith(runtime)).toBe(true);
    const sharp = packageRequire("sharp");
    const bytes = await sharp({
      create: { width: 2, height: 2, channels: 4, background: "#123456" }
    })
      .png()
      .toBuffer();
    expect((await sharp(bytes).metadata()).format).toBe("png");
    expect(await readdir(join(runtime, "node_modules", "@img"))).toContain(
      `sharp-${process.platform}-${process.arch}`
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
