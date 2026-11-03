import { constants, copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, readlinkSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { basename, dirname, join, relative, resolve, isAbsolute } from "node:path";
import type { ApplicationStoragePaths } from "../storage-paths";

interface MigrationFile { source: string; target: string; sha256: string; size: number; }
function hash(path: string): string { return createHash("sha256").update(readFileSync(path)).digest("hex"); }
function contains(parent: string, child: string): boolean {
  const rel = relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

/** A closed application's private profile only. Preflight all conflicts, copy exclusively, verify, retain source. */
export function migrateApplicationStorage(source: string, storage: ApplicationStoragePaths): { copied: number; preserved: boolean } {
  if (!existsSync(source)) return { copied: 0, preserved: true };
  if (!lstatSync(source).isDirectory()) return { copied: 0, preserved: true };
  if (["Chromium", "Electron"].includes(basename(source))) {
    throw new Error("通用 Electron/Chromium 目录可能属于其它应用，拒绝自动迁移。");
  }
  source = realpathSync(source);
  const lock = join(source, "SingletonLock");
  try {
    const pid = Number(readlinkSync(lock).match(/-(\d+)$/u)?.[1]);
    if (pid && pid !== process.pid) {
      let alive = false;
      try { process.kill(pid, 0); alive = true; } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
      }
      if (alive) throw new Error("旧元宇宙实例仍在运行，请先退出后迁移配置。");
    }
  } catch (error) {
    if (!["ENOENT", "EINVAL", "ENOTDIR"].includes((error as NodeJS.ErrnoException).code ?? "")) throw error;
  }
  if (resolve(source) === resolve(storage.userData)) return { copied: 0, preserved: true };
  if (contains(source, storage.root) || contains(storage.root, source)) throw new Error("旧用户目录与新应用根目录互相包含，拒绝自动迁移。");
  const receipt = join(storage.outputs, "migrations", "application-profile.json");
  if (existsSync(receipt)) {
    const saved = JSON.parse(readFileSync(receipt, "utf8")) as { source?: string; userData?: string; complete?: boolean };
    if (saved.complete && saved.source === source && saved.userData === storage.userData) return { copied: 0, preserved: true };
    throw new Error(`已存在其它应用存储迁移记录，拒绝覆盖（记录 source=${saved.source}, userData=${saved.userData}; 本次 source=${source}, userData=${storage.userData}）。`);
  }
  const files: MigrationFile[] = [];
  const walk = (from: string, to: string) => {
    const info = lstatSync(from);
    if (info.isSymbolicLink()) throw new Error(`旧应用存储包含符号链接，需单独确认：${from}`);
    if (info.isDirectory()) {
      if (existsSync(to) && (!lstatSync(to).isDirectory() || realpathSync(to) !== resolve(to))) throw new Error(`迁移目标目录不可用：${to}`);
      for (const name of readdirSync(from)) walk(join(from, name), join(to, name));
      return;
    }
    if (!info.isFile()) throw new Error(`旧应用存储包含特殊文件，需在应用退出后再迁移：${from}`);
    const sha256 = hash(from);
    if (existsSync(to)) {
      const targetInfo = lstatSync(to);
      if (!targetInfo.isFile() || targetInfo.isSymbolicLink() || hash(to) !== sha256) throw new Error(`配置或运行数据迁移发生冲突，不会覆盖：${to}`);
    }
    files.push({ source: from, target: to, sha256, size: info.size });
  };
  for (const name of readdirSync(source)) {
    if (["SingletonLock", "SingletonCookie", "SingletonSocket", "DevToolsActivePort"].includes(name)) continue;
    const target = name === "config" ? storage.configs
      : name === "diagnostics" ? join(storage.outputs, "logs", "legacy-diagnostics")
      : join(storage.userData, name);
    walk(join(source, name), target);
  }
  const created: string[] = [];
  try {
    for (const entry of files) {
      if (!existsSync(entry.target)) {
        mkdirSync(dirname(entry.target), { recursive: true, mode: 0o700 });
        copyFileSync(entry.source, entry.target, constants.COPYFILE_EXCL);
        created.push(entry.target);
      }
      if (hash(entry.target) !== entry.sha256) throw new Error(`迁移内容校验失败：${entry.target}`);
    }
    mkdirSync(dirname(receipt), { recursive: true, mode: 0o700 });
    writeFileSync(receipt, JSON.stringify({ version: 1, complete: true, source, userData: storage.userData, sourcePreserved: true, files: files.map(({ target, sha256, size }) => ({ target, sha256, size })) }, null, 2), { flag: "wx", mode: 0o600 });
    return { copied: created.length, preserved: true };
  } catch (error) {
    for (const path of created.reverse()) rmSync(path, { force: true });
    throw error;
  }
}
