import { createHash } from "node:crypto";
import { cp, lstat, mkdir, realpath, rename, symlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { ensureStorageDirectory } from "../storage-paths";

async function exists(path: string): Promise<boolean> {
  try { await lstat(path); return true; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return false; throw error; }
}

export function assistantStoragePaths(workspace: string, environment: NodeJS.ProcessEnv) {
  const production = Boolean(environment.METAVERSE_OUTPUTS_ROOT && environment.METAVERSE_CONFIGS_ROOT);
  const key = createHash("sha256").update(workspace).digest("hex").slice(0, 24);
  return production ? {
    home: join(environment.METAVERSE_OUTPUTS_ROOT!, "assistant", key),
    configs: join(environment.METAVERSE_CONFIGS_ROOT!, "assistant", key),
    relocated: true
  } : { home: join(workspace, "assistant"), configs: join(workspace, "assistant"), relocated: false };
}

/** Copy a legacy home once; never delete the source or overwrite a new profile. */
export async function prepareAssistantStorage(workspace: string, environment: NodeJS.ProcessEnv) {
  const paths = assistantStoragePaths(workspace, environment);
  if (!paths.relocated) {
    await mkdir(paths.home, { recursive: true });
    return paths;
  }
  const legacy = join(workspace, "assistant");
  ensureStorageDirectory(join(environment.METAVERSE_OUTPUTS_ROOT!, "assistant"));
  ensureStorageDirectory(join(environment.METAVERSE_CONFIGS_ROOT!, "assistant"));
  if (!(await exists(paths.home)) && await exists(legacy)) {
    const info = await lstat(legacy);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("旧智能体数据目录不能是符号链接。");
    await cp(legacy, paths.home, { recursive: true, force: false, errorOnExist: true, dereference: false, verbatimSymlinks: true });
  }
  ensureStorageDirectory(paths.home);
  ensureStorageDirectory(paths.configs);
  const profiles = join(paths.home, "profiles");
  const configProfiles = join(paths.configs, "profiles");
  if (await exists(profiles)) {
    const info = await lstat(profiles);
    if (info.isSymbolicLink()) {
      if (await realpath(profiles) !== resolve(configProfiles)) throw new Error("智能体配置链接指向了错误的位置。");
    } else {
      if (await exists(configProfiles)) throw new Error("智能体配置迁移目标已存在，不会覆盖。");
      await rename(profiles, configProfiles);
    }
  }
  ensureStorageDirectory(configProfiles);
  if (!(await exists(profiles))) await symlink(configProfiles, profiles, process.platform === "win32" ? "junction" : "dir");
  // Credential writes use an explicit provider path. A leaf symlink would be broken by atomic rename.
  for (const name of [".credentials.yaml", ".env", "cordis.patch.yml"]) {
    const source = join(paths.home, name);
    const target = join(paths.configs, name);
    if (await exists(source)) {
      if (await exists(target)) throw new Error(`智能体配置迁移发生冲突：${name}`);
      if ((await lstat(source)).isSymbolicLink()) throw new Error(`智能体配置不能是符号链接：${name}`);
      await rename(source, target);
    }
  }
  const marker = join(paths.home, "storage-layout.json");
  if (!(await exists(marker))) await writeFile(marker, JSON.stringify({ version: 1, workspace, configs: paths.configs, legacySourcePreserved: true }), { flag: "wx", mode: 0o600 });
  return paths;
}
