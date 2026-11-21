import { createHash } from "node:crypto";
import { cp, lstat, readdir, readlink, realpath, symlink, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { ensureStorageDirectory } from "../storage-paths";

async function exists(path: string): Promise<boolean> {
  try { await lstat(path); return true; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return false; throw error; }
}

export function assistantStoragePaths(workspace: string, _environment: NodeJS.ProcessEnv) {
  const home = join(workspace, "assistant");
  return { home, configs: home, relocated: false };
}

export function assistantPluginProfiles(workspace: string, environment = process.env) {
  return environment.METAVERSE_APP_ROOT
    ? join(environment.METAVERSE_APP_ROOT, "plugins", "profiles")
    : join(workspace, "assistant", "profiles");
}

async function connectPluginProfiles(workspace: string, environment: NodeJS.ProcessEnv) {
  if (!environment.METAVERSE_APP_ROOT) return;
  const target = assistantPluginProfiles(workspace, environment);
  const link = join(workspace, "assistant", "profiles");
  ensureStorageDirectory(dirname(target));
  if (await exists(link)) {
    if ((await lstat(link)).isSymbolicLink()) {
      ensureStorageDirectory(target);
      if (await realpath(link) !== resolve(target)) throw new Error("助手插件目录指向了意外的位置。");
      return;
    }
    ensureStorageDirectory(link);
    if (await exists(target)) {
      // Preserve a workspace's previous independent configuration before sharing the project profile.
      const backup = join(workspace, "assistant", "profiles.before-project");
      if (await exists(backup)) throw new Error("旧插件备份已存在，无法自动迁移。");
      await rename(link, backup);
    } else {
      try {
        await rename(link, target);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EXDEV") throw error;
        const staging = target + ".migrating";
        if (await exists(staging)) throw new Error("插件迁移尚未完成。");
        await cp(link, staging, { recursive: true, verbatimSymlinks: true });
        await rename(staging, target);
        await rm(link, { recursive: true });
      }
    }
  }
  ensureStorageDirectory(target);
  await symlink(target, link, process.platform === "win32" ? "junction" : "dir");
}

/** Consolidate a stopped assistant into the workspace; never merge conflicting data. */
export async function prepareAssistantStorage(workspace: string, environment: NodeJS.ProcessEnv) {
  const paths = assistantStoragePaths(workspace, environment);
  const key = createHash("sha256").update(workspace).digest("hex").slice(0, 24);
  const oldHome = environment.METAVERSE_OUTPUTS_ROOT ? join(environment.METAVERSE_OUTPUTS_ROOT, "assistant", key) : undefined;
  const oldConfigs = environment.METAVERSE_CONFIGS_ROOT ? join(environment.METAVERSE_CONFIGS_ROOT, "assistant", key) : undefined;
  const oldPlugins = join(workspace, "plugins", "profiles");
  const roots: string[] = [];
  for (const candidate of [oldHome, oldConfigs]) {
    if (candidate && await exists(candidate)) {
      ensureStorageDirectory(candidate);
      roots.push(candidate);
    }
  }
  const pluginsExist = await exists(oldPlugins);
  if (pluginsExist) ensureStorageDirectory(oldPlugins);
  if (!roots.length && !pluginsExist) {
    ensureStorageDirectory(paths.home);
    await connectPluginProfiles(workspace, environment);
    return paths;
  }
  if (await exists(paths.home)) throw new Error("智能体迁移目标已存在，不会覆盖，请先检查 assistant 目录。");
  const staging = `${paths.home}.migrating`;
  if (await exists(staging)) throw new Error("发现未完成的智能体迁移，请先检查 assistant.migrating 目录。");
  // Collect and validate before copying. Only generated files may be replaced.
  const entries = new Map<string, string>();
  for (const root of roots) {
    for (const name of await readdir(root)) {
      const source = join(root, name);
      if (name === "storage-layout.json") continue;
      if ((await lstat(source)).isSymbolicLink()) {
        const destination = resolve(dirname(source), await readlink(source));
        if (name !== "profiles" || ![oldPlugins, oldConfigs && join(oldConfigs, "profiles")].includes(destination)) {
          throw new Error("智能体数据包含无法迁移的链接。");
        }
        continue;
      }
      if (entries.has(name) && name !== "metaverse.patch.json") throw new Error(`智能体数据冲突，不会覆盖：${name}`);
      entries.set(name, source);
    }
  }
  if (pluginsExist) {
    if (entries.has("profiles")) throw new Error("插件配置冲突，不会覆盖。");
    entries.set("profiles", oldPlugins);
  }
  ensureStorageDirectory(staging);
  try {
    for (const [name, source] of entries) {
      await cp(source, join(staging, name), { recursive: true, force: false, errorOnExist: true, dereference: false, verbatimSymlinks: true });
    }
    await writeFile(join(staging, "storage-layout.json"), JSON.stringify({ version: 2, workspace, configs: paths.configs }), { mode: 0o600 });
    await rename(staging, paths.home);
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
  // Sources are removed only after a complete destination is published.
  for (const root of roots) await rm(root, { recursive: true });
  if (pluginsExist) await rm(oldPlugins, { recursive: true });
  await connectPluginProfiles(workspace, environment);
  return paths;
}
