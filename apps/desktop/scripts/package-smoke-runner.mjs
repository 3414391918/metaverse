import { prepareSmokeWorkspace } from "./smoke-workspace.mjs";
import { spawn } from "node:child_process";

export function validateSmokeSummary(summary, reopened) {
  if (
    summary.health?.status !== "ok" ||
    summary.health?.workers?.length !== 1 ||
    summary.health?.workers?.[0]?.name !== "core" ||
    summary.health?.workers?.[0]?.status !== "ok" ||
    summary.unifiedCreation?.status !== "ok" ||
    summary.unifiedCreation?.created !== true ||
    summary.unifiedCreation?.retiredApisAbsent !== true ||
    summary.unifiedCreation?.promptTemplates?.status !== "ok" ||
    summary.unifiedCreation?.tools?.status !== "ok" ||
    summary.conversation?.status !== "ok" ||
    summary.conversation?.staged !== true ||
    summary.conversation?.reopened !== reopened ||
    !(summary.conversation?.chunkPages >= 2) ||
    !(summary.conversation?.metadataChunkPages >= 2) ||
    summary.conversation?.unknownRetained !== true ||
    summary.conversation?.proposalRetained !== true ||
    summary.chapterImages?.status !== "ok" ||
    summary.chapterImages?.copied !== true ||
    summary.chapterImages?.replaced !== true ||
    summary.chapterImages?.reopened !== true ||
    summary.chapterImages?.referenceUnchanged !== true ||
    summary.chapterImages?.rendered !== true ||
    summary.chapterImages?.staleRejected !== true ||
    summary.characterAppearances?.status !== "ok" ||
    summary.characterAppearances?.created !== true ||
    summary.characterAppearances?.copied !== true ||
    summary.characterAppearances?.referenceIsolated !== true ||
    summary.characterAppearances?.persisted !== true
  )
    throw new Error(
      `Packaged app returned an invalid smoke summary: ${JSON.stringify(summary)}`
    );
}

export async function runPackagedSmoke(
  executable,
  appDir,
  profile,
  targetPlatform
) {
  await prepareSmokeWorkspace(profile);
  let output = "";
  const result = await new Promise((resolveResult) => {
    let timedOut = false;
    const child = spawn(
      executable,
      [
        `--user-data-dir=${profile}`,
        ...(targetPlatform === "mac" ? ["--use-mock-keychain"] : []),
        "--password-store=basic"
      ],
      {
        cwd: appDir,
        env: {
          ...process.env,
          DEEPWRITE_SMOKE: "1",
          ELECTRON_DISABLE_SECURITY_WARNINGS: "true"
        },
        stdio: ["ignore", "pipe", "pipe"]
      }
    );
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, 120_000);
    child.once("error", (error) => {
      clearTimeout(timeout);
      resolveResult({ error });
    });
    child.once("close", (code, signal) => {
      clearTimeout(timeout);
      resolveResult({ code, signal, timedOut });
    });
  });
  if (result.error) throw result.error;
  const marker = output
    .split(/\r?\n/)
    .find((line) => line.startsWith("DEEPWRITE_SMOKE_OK "));
  if (result.code !== 0 || !marker)
    throw new Error(
      `Packaged app smoke failed with exit code ${String(result.code)}, signal ${String(result.signal)}, timedOut ${String(result.timedOut)}:\n${output}`
    );
  return JSON.parse(marker.slice("DEEPWRITE_SMOKE_OK ".length));
}
