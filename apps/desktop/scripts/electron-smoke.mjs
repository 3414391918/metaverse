import { prepareSmokeWorkspace } from "./smoke-workspace.mjs";
import { access, mkdtemp, rm } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "vite";
import vue from "@vitejs/plugin-vue";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(scriptDir, "..");
const workspaceRoot = resolve(appDir, "../..");
const electronDist = resolve(workspaceRoot, "node_modules/electron/dist");
const electronBinary =
  process.platform === "darwin"
    ? resolve(electronDist, "Electron.app/Contents/MacOS/Electron")
    : process.platform === "win32"
      ? resolve(electronDist, "electron.exe")
      : resolve(electronDist, "electron");

try {
  await access(resolve(appDir, "out/main/index.js"));
  await access(
    resolve(appDir, "out/main/utilities/conversation-storage/worker-entry.js")
  );
  await access(electronBinary);
} catch {
  console.error(
    "Desktop build or Electron binary is missing. Run `pnpm build` first."
  );
  process.exit(1);
}

const hasDisplay = Boolean(process.env.DISPLAY || process.env.WAYLAND_DISPLAY);
const hasXvfb =
  spawnSync("sh", ["-c", "command -v xvfb-run"], { encoding: "utf8" })
    .status === 0;
const smokeUserData = await mkdtemp(
  join(tmpdir(), "deepwrite-electron-smoke-")
);
await prepareSmokeWorkspace(smokeUserData);
const smokeAssets = await mkdtemp(
  join(appDir, "out/renderer/.chapter-image-smoke-")
);
try {
  await build({
    configFile: false,
    root: join(appDir, "src/renderer"),
    plugins: [vue()],
    logLevel: "warn",
    define: { "process.env.NODE_ENV": JSON.stringify("production") },
    resolve: {
      alias: {
        "@deepwrite/contracts/renderer": join(
          workspaceRoot,
          "packages/contracts/src/renderer.ts"
        ),
        "@deepwrite/contracts": join(
          workspaceRoot,
          "packages/contracts/src/renderer.ts"
        )
      }
    },
    build: {
      outDir: smokeAssets,
      emptyOutDir: true,
      lib: {
        entry: join(
          appDir,
          "src/renderer/src/features/chapter-images/chapter-image.smoke.ts"
        ),
        formats: ["es"],
        fileName: () => "chapter-image.smoke.js",
        cssFileName: "chapter-image.smoke"
      }
    }
  });
} catch (error) {
  await Promise.all([
    rm(smokeUserData, { recursive: true, force: true }),
    rm(smokeAssets, { recursive: true, force: true })
  ]);
  throw error;
}
const command = !hasDisplay && hasXvfb ? "xvfb-run" : electronBinary;
const args =
  !hasDisplay && hasXvfb
    ? ["-a", electronBinary, ".", `--user-data-dir=${smokeUserData}`]
    : [".", `--user-data-dir=${smokeUserData}`];

const child = spawn(command, args, {
  cwd: appDir,
  env: {
    ...process.env,
    DEEPWRITE_SMOKE: "1",
    DEEPWRITE_SMOKE_CHAPTER_IMAGE_MODULE: pathToFileURL(
      join(smokeAssets, "chapter-image.smoke.js")
    ).href,
    ELECTRON_DISABLE_SECURITY_WARNINGS: "true"
  },
  stdio: ["ignore", "pipe", "pipe"]
});

let output = "";
child.stdout.on("data", (chunk) => {
  output += chunk.toString();
});
child.stderr.on("data", (chunk) => {
  output += chunk.toString();
});

const timeout = setTimeout(() => {
  child.kill("SIGKILL");
}, 40_000);

child.on("close", async (code) => {
  clearTimeout(timeout);
  await rm(smokeUserData, { recursive: true, force: true });
  await rm(smokeAssets, { recursive: true, force: true });
  const marker = output
    .split(/\r?\n/)
    .find((line) => line.startsWith("DEEPWRITE_SMOKE_OK "));

  if (code !== 0 || !marker) {
    console.error(output.trim());
    console.error(`Electron smoke failed with exit code ${String(code)}.`);
    process.exit(1);
  }

  const summary = JSON.parse(marker.slice("DEEPWRITE_SMOKE_OK ".length));
  if (
    summary.health?.status !== "ok" ||
    summary.health?.workers?.length !== 1
  ) {
    console.error(
      `Electron smoke returned unhealthy utilities: ${JSON.stringify(summary)}`
    );
    process.exit(1);
  }

  if (
    summary.unifiedCreation?.status !== "ok" ||
    summary.characterAppearances?.status !== "ok" ||
    summary.characterAppearances?.created !== true ||
    summary.characterAppearances?.copied !== true ||
    summary.characterAppearances?.cancelled !== true ||
    summary.characterAppearances?.referenceIsolated !== true ||
    summary.characterAppearances?.persisted !== true ||
    summary.characterAppearances?.refreshed !== true ||
    summary.characterAppearances?.rendered !== true ||
    summary.characterAppearances?.deleted !== true ||
    summary.characterAppearances?.deleteCancelled !== true ||
    summary.characterAppearances?.lockedDeletionBlocked !== true ||
    summary.characterAppearances?.retainedOtherAppearance !== true ||
    summary.chapterImages?.status !== "ok" ||
    summary.chapterImages?.rendered !== true ||
    summary.chapterImages?.referenceUnchanged !== true ||
    summary.chapterImages?.staleRejected !== true ||
    summary.chapterImages?.filePasteDecoded !== true ||
    summary.chapterImages?.previewReopened !== true ||
    summary.chapterImages?.focusPreserved !== true ||
    summary.chapterImages?.reopenPreserved !== true ||
    summary.chapterImages?.illustration?.status !== "ok" ||
    summary.chapterImages?.illustration?.cancel !== true ||
    summary.chapterImages?.illustration?.added !== true ||
    summary.chapterImages?.illustration?.keyboardPaste !== true ||
    summary.chapterImages?.illustration?.sequence !== true ||
    summary.chapterImages?.illustration?.undoRedo !== true ||
    summary.chapterImages?.illustration?.preview !== true ||
    summary.chapterImages?.illustration?.reopened !== true ||
    !(summary.chapterImages?.imageBytes >= 8 * 1024 * 1024) ||
    summary.unifiedCreation?.created !== true ||
    summary.unifiedCreation?.tools?.status !== "ok" ||
    summary.unifiedCreation?.tools?.linkedNavigation !== true ||
    summary.unifiedCreation?.tools?.scriptEdit !== true ||
    summary.unifiedCreation?.tools?.confirmedDelete !== true ||
    summary.unifiedCreation?.promptTemplates?.status !== "ok" ||
    summary.unifiedCreation?.promptTemplates?.create !== true ||
    summary.unifiedCreation?.promptTemplates?.reopen !== true ||
    summary.unifiedCreation?.promptTemplates?.imagePreview !== true ||
    summary.unifiedCreation?.promptTemplates?.delete !== true ||
    summary.unifiedCreation?.retiredApisAbsent !== true ||
    summary.conversation?.status !== "ok" ||
    summary.conversation?.staged !== true ||
    summary.conversation?.reopened !== false ||
    !(summary.conversation?.chunkPages >= 2) ||
    !(summary.conversation?.metadataChunkPages >= 2) ||
    summary.conversation?.unknownRetained !== true ||
    summary.conversation?.proposalRetained !== true
  ) {
    console.error(
      `Electron smoke returned an invalid summary: ${JSON.stringify(summary)}`
    );
    process.exit(1);
  }

  console.log(
    `Electron smoke passed: utilities, unified novel creation, independent tool editor/save/linked navigation/script edit/confirmed deletion, templates, large chapter-image (${summary.chapterImages.imageBytes} bytes) clipboard/replace/reopen/render through real IPC with unchanged references, chapter illustration add/cancel/numbering/undo/redo/preview/reopen, editor preview mode/scroll preservation, and character appearance create/copy/refresh/render/permanent-delete/cancel/lock/other-appearance retention.`
  );
});
