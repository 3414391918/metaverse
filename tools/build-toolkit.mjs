import { cp, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = resolve(root, "apps/desktop/out/toolkit");
await mkdir(out, { recursive: true });
await cp(resolve(root, "toolkit/defaults"), out, { recursive: true });
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
    outDir: resolve(out, "workspace/runtime"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        engine: resolve(root, "toolkit/src/workspace-engine.ts"),
        "context-engine": resolve(root, "toolkit/src/context-engine.ts")
      },
      output: { entryFileNames: "[name].mjs", chunkFileNames: "[name].mjs" }
    }
  }
});
console.log("Editable toolkit runtime built.");
