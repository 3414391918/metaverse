import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "vitest";

const repoRoot = resolve(import.meta.dirname, "..");

const PI_PACKAGE_PATTERNS = [
  /@earendil-works\//,
  /^pi-agent-core$/,
  /^pi-ai$/,
  /^pi-telemetry$/,
  /^@deepwrite\/pi-runtime-adapter$/
];

/**
 * After the core-only refactor, the desktop runtime must not depend on any Pi
 * (agent framework) package in production dependencies of workspace packages.
 */
test("workspace packages declare no Pi production dependencies", async () => {
  const manifests = [
    "package.json",
    "apps/desktop/package.json",
    "apps/harness/package.json",
    "packages/contracts/package.json",
    "packages/shared/package.json"
  ];
  for (const manifestPath of manifests) {
    const manifest = JSON.parse(
      await readFile(resolve(repoRoot, manifestPath), "utf8")
    );
    const production = {
      ...(manifest.dependencies ?? {}),
      ...(manifest.optionalDependencies ?? {})
    };
    for (const [name, range] of Object.entries(production)) {
      assert.ok(
        !PI_PACKAGE_PATTERNS.some((pattern) => pattern.test(name)),
        `${manifestPath} declares Pi production dependency ${name}@${String(range)}`
      );
    }
  }
});

test("pnpm workspace catalog declares no Pi packages", async () => {
  const workspaceYaml = await readFile(
    resolve(repoRoot, "pnpm-workspace.yaml"),
    "utf8"
  );
  for (const line of workspaceYaml.split("\n")) {
    const entry = line.trim();
    assert.ok(
      !/@earendil-works/.test(entry) || /^#/.test(entry),
      `pnpm-workspace.yaml still references an earendil-works entry: ${entry}`
    );
  }
});

test("the Pi runtime adapter package is removed", async () => {
  const { err } = await stat(
    resolve(repoRoot, "packages/pi-runtime-adapter")
  ).then(
    () => ({ err: new Error("packages/pi-runtime-adapter still exists") }),
    (error) => ({ err: error })
  );
  assert.equal(
    err.code,
    "ENOENT",
    `expected packages/pi-runtime-adapter to be removed: ${err.message}`
  );
});

test("electron build declares only the Core utility entry", async () => {
  const config = await readFile(
    resolve(repoRoot, "apps/desktop/electron.vite.config.ts"),
    "utf8"
  );
  assert.ok(
    !config.includes("agent-entry"),
    "electron.vite.config.ts still declares an Agent build entry"
  );
  assert.ok(
    !config.includes("tool-entry"),
    "electron.vite.config.ts still declares a Tool build entry"
  );
  assert.ok(
    config.includes("core-entry"),
    "electron.vite.config.ts must keep the Core utility build entry"
  );
  assert.ok(
    !config.includes("pi-runtime-adapter"),
    "electron.vite.config.ts still aliases the Pi runtime adapter"
  );
});

test("packaged runtime files contain only Core utility entries", async () => {
  const script = await readFile(
    resolve(repoRoot, "apps/desktop/scripts/package-runtime-files.mjs"),
    "utf8"
  );
  for (const forbidden of ["agent-entry", "tool-entry", "pi-runtime-adapter"]) {
    assert.ok(
      !script.includes(forbidden),
      `package-runtime-files.mjs still requires ${forbidden}`
    );
  }
  assert.ok(
    script.includes("core-entry.js"),
    "package-runtime-files.mjs must keep the Core runtime entry"
  );
});

test("the main process forks only the Core utility process", async () => {
  const supervisor = await readFile(
    resolve(repoRoot, "apps/desktop/src/main/supervisor.ts"),
    "utf8"
  );
  assert.ok(
    supervisor.includes('join(__dirname, "utilities", "core-entry.js")'),
    "supervisor.ts must fork the Core utility entry"
  );
  for (const forbidden of ["agent-entry", "tool-entry", "pi-runtime-adapter"]) {
    assert.ok(
      !supervisor.includes(forbidden),
      `supervisor.ts still references the retired ${forbidden} worker`
    );
  }
});

test("network proxy preference and remote fetch stay agent-free in production source", async () => {
  for (const sourcePath of [
    "apps/desktop/src/main/network-proxy-preference.ts",
    "apps/desktop/src/main/disable-node-http-proxy-env.ts",
    "apps/desktop/src/main/electron-remote-fetch.ts"
  ]) {
    const source = await readFile(resolve(repoRoot, sourcePath), "utf8");
    for (const forbidden of [
      "ProxyAgent",
      "Agent(",
      "undici",
      "http-proxy-agent",
      "https-proxy-agent",
      "socks-proxy-agent"
    ]) {
      assert.ok(
        !source.includes(forbidden),
        `${sourcePath} must not route through a Node proxy agent (${forbidden})`
      );
    }
  }
  const remoteFetch = await readFile(
    resolve(repoRoot, "apps/desktop/src/main/electron-remote-fetch.ts"),
    "utf8"
  );
  assert.ok(
    remoteFetch.includes("net.fetch"),
    "electron-remote-fetch.ts must keep using the Chromium network stack"
  );
});

test("the built-in Pi 0.85 model runtime is absent while the Harness-bundled pi-ai@1.4 may remain", async () => {
  const lock = await readFile(resolve(repoRoot, "pnpm-lock.yaml"), "utf8");
  for (const line of lock.split("\n")) {
    const entry = line.trim();
    assert.ok(
      !/^'?pi-ai@0\./.test(entry),
      `pnpm-lock.yaml still pins the retired built-in Pi runtime: ${entry}`
    );
    assert.ok(
      !/^'?pi-agent-core@/.test(entry),
      `pnpm-lock.yaml still pins the retired pi-agent-core runtime: ${entry}`
    );
  }
});
