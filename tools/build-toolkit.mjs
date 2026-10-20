import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = resolve(root, "apps/desktop/out/toolkit");
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await cp(resolve(root, "toolkit/defaults"), out, { recursive: true });
for (const [name, source] of [
  ["engine", "workspace-engine.ts"],
  ["context-engine", "context-engine.ts"]
]) {
  await build({
    configFile: false,
    logLevel: "warn",
    resolve: {
      alias: {
        "@deepwrite/contracts": resolve(root, "packages/contracts/src/index.ts"),
        "@deepwrite/shared": resolve(root, "packages/shared/src/index.ts")
      }
    },
    ssr: { noExternal: true },
    build: {
      ssr: true,
      target: "node24",
      minify: false,
      outDir: resolve(out, "creation/runtime"),
      emptyOutDir: name === "engine",
      rollupOptions: {
        input: resolve(root, "toolkit/src", source),
        output: {
          entryFileNames: `${name}.mjs`,
          codeSplitting: false
        }
      }
    }
  });
}
console.log("Editable toolkit runtime built.");
