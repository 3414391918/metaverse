import { afterEach, describe, expect, it } from "vitest";
import {
  mkdtemp,
  mkdir,
  rm,
  writeFile,
  realpath,
  symlink,
  readFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  AssistantRuntime,
  assistantReadyUrl,
  assistantOverlay
} from "./assistant-runtime";
import { AssistantConnectionSchema } from "@deepwrite/contracts";
const roots: string[] = [],
  runtimes: AssistantRuntime[] = [];
afterEach(async () => {
  await Promise.all(runtimes.splice(0).map((runtime) => runtime.stop()));
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
  );
});
async function fixture(
  silent = false,
  proxyResolver?: () => Promise<string>,
  environment?: NodeJS.ProcessEnv
) {
  const root = await mkdtemp(join(tmpdir(), "metaverse-assistant-"));
  roots.push(root);
  const cli = join(root, "cli.mjs");
  await writeFile(
    cli,
    (silent
      ? ""
      : 'console.log("dsh web: http://127.0.0.1:12345/?token=local-token");') +
      'setInterval(()=>{},1000);process.on("SIGTERM",()=>process.exit(0));'
  );
  const runtime = new AssistantRuntime({
    executable: process.execPath,
    cli,
    plugin: root,
    ...(proxyResolver ? { proxyResolver } : {}),
    ...(environment ? { environment } : {}),
    startupTimeoutMs: silent ? 150 : 5000
  });
  runtimes.push(runtime);
  const first = join(root, "first"),
    second = join(root, "second");
  await mkdir(first);
  await mkdir(second);
  return { root, first, second, runtime };
}
describe("assistant runtime", () => {
  it("accepts only the CLI's authenticated loopback URL", () => {
    expect(
      assistantReadyUrl("dsh web: http://127.0.0.1:3080/?token=abc_123")
    ).toBeDefined();
    for (const line of [
      "dsh web: http://example.com/?token=abc",
      "dsh web: http://127.0.0.1:3080/",
      "other http://127.0.0.1:3080/?token=abc",
      "dsh web: http://127.0.0.1:3080/?token=abc&redirect=elsewhere"
    ])
      expect(assistantReadyUrl(line)).toBeUndefined();
    expect(
      AssistantConnectionSchema.safeParse({
        url: "https://example.com/",
        nonce: "x".repeat(48),
        workspace: "/tmp"
      }).success
    ).toBe(false);
    expect(
      AssistantConnectionSchema.safeParse({
        url: "garbage",
        nonce: "x".repeat(48),
        workspace: "/tmp"
      }).success
    ).toBe(false);
  });
  it("shares a concurrent start, preserves the connection and changes it with the workspace", async () => {
    const { first, second, runtime } = await fixture();
    const [a, b] = await Promise.all([
      runtime.ensure(first),
      runtime.ensure(first)
    ]);
    expect(a).toEqual(b);
    const next = await runtime.ensure(second);
    expect(next.workspace).toBe(await realpath(second));
    expect(next.nonce).not.toBe(a.nonce);
    await runtime.stop();
    const restarted = await runtime.ensure(first);
    expect(restarted.nonce).not.toBe(a.nonce);
  });
  it("cancels a preparing start without leaving a running child", async () => {
    const { first, runtime } = await fixture();
    const starting = runtime.ensure(first);
    const settled = starting.catch(() => undefined);
    await runtime.stop();
    await settled;
    await runtime.stop();
  });
  it("migrates a saved DeepSeek default while keeping a backup", async () => {
    const { first, runtime } = await fixture();
    const profile = join(first, "assistant", "profiles", "web");
    await mkdir(profile, { recursive: true });
    const patch = join(profile, "cordis.patch.yml");
    const previous = `- id: agent-default-model\n  config:\n    provider: deepseek-official\n    model: deepseek-v4-pro\n    reasoningEffort: high\n`;
    await writeFile(patch, previous);
    await runtime.ensure(first);
    expect(await readFile(patch, "utf8")).toContain("provider: venice");
    expect(await readFile(`${patch}.pre-qwen`, "utf8")).toBe(previous);
  });
  it("passes the resolved system proxy to the Harness subprocess", async () => {
    const { root, first, runtime } = await fixture(
      false,
      async () => "PROXY 127.0.0.1:7892; DIRECT",
      {
        HTTPS_PROXY: undefined,
        https_proxy: undefined,
        ALL_PROXY: undefined,
        all_proxy: undefined,
        NO_PROXY: undefined,
        no_proxy: undefined
      }
    );
    const environmentFile = join(root, "environment.json");
    await writeFile(
      join(root, "cli.mjs"),
      `import { writeFileSync } from "node:fs";
writeFileSync(${JSON.stringify(environmentFile)}, JSON.stringify({ proxy: process.env.HTTPS_PROXY, useEnvProxy: process.env.NODE_USE_ENV_PROXY, noProxy: process.env.NO_PROXY }));
console.log("dsh web: http://127.0.0.1:12345/?token=local-token");
setInterval(() => {}, 1000);
process.on("SIGTERM", () => process.exit(0));`
    );
    await runtime.ensure(first);
    expect(JSON.parse(await readFile(environmentFile, "utf8"))).toEqual({
      proxy: "http://127.0.0.1:7892",
      useEnvProxy: "1",
      noProxy: "localhost,127.0.0.1,::1"
    });
  });
  it("authorizes only the active guest origin, initial token and bridge nonce", async () => {
    const { first, runtime } = await fixture();
    const connection = await runtime.ensure(first);
    const url = new URL(connection.url);
    url.hash = new URLSearchParams({ metaverse: connection.nonce }).toString();
    expect(runtime.isGuestUrl(url.href, true)).toBe(true);
    expect(runtime.isGuestUrl(connection.url, true)).toBe(false);
    expect(
      runtime.isGuestUrl(url.href.replace("local-token", "another"), true)
    ).toBe(false);
    expect(runtime.isGuestUrl(url.href.replace("127.0.0.1", "localhost"))).toBe(
      false
    );
    expect(runtime.isGuestUrl(url.href.replace(":12345/", ":12346/"))).toBe(
      false
    );
    expect(runtime.isGuestUrl(url.origin + "/plugins/evil.js")).toBe(false);
    await runtime.stop();
    expect(runtime.isGuestUrl(url.href)).toBe(false);
  });
  it("rejects a runtime that never reports readiness", async () => {
    const { first, runtime } = await fixture(true);
    await expect(runtime.ensure(first)).rejects.toThrow("启动超时");
    await runtime.stop();
  });
  it.skipIf(process.platform === "win32")(
    "replaces generated leaf symlinks without overwriting their targets",
    async () => {
      const { root, first, runtime } = await fixture();
      const target = join(root, "user-document.md");
      await writeFile(target, "preserve this");
      const home = join(first, "assistant");
      await mkdir(home, { recursive: true });
      await symlink(target, join(home, "platform.md"));
      await runtime.ensure(first);
      expect(await readFile(target, "utf8")).toBe("preserve this");
      expect(await readFile(join(home, "platform.md"), "utf8")).toContain(
        "元宇宙创作平台"
      );
    }
  );
  it("disables duplicate shell and telemetry surfaces while keeping a profile overlay", () => {
    const patch = assistantOverlay("/app/plugin", "/work/space");
    expect(patch).toContainEqual({ id: "ui-layout", disabled: true });
    expect(patch).toContainEqual({
      id: "session-log-deepseek",
      disabled: true
    });
    expect(patch).toContainEqual({ id: "llm-deepseek", disabled: true });
    expect(patch).toContainEqual({
      id: "llm-deepseek-account",
      disabled: true
    });
    expect(patch).toContainEqual({ id: "deepseek-account", disabled: true });
    expect(patch.at(-1)).toMatchObject({
      insert: [{ id: "metaverse-integration" }]
    });
  });
  it("keeps the workspace fixed to the application setting", () => {
    const patch = assistantOverlay("/app/plugin", "/work/space");
    expect(patch).toContainEqual({ id: "directory-picker", disabled: true });
  });
  it("scans local skills only under the workspace tools directory", () => {
    const patch = assistantOverlay("/app/plugin", "/work/space");
    expect(patch).toContainEqual({
      id: "skill-filesystem",
      name: "@deepseek-ai/dsh-skill-filesystem",
      config: {
        includeDefaultRoots: false,
        customSkillDirs: [join("/work/space", "tools")]
      }
    });
  });
});
