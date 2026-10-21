import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  constants,
  copyFile,
  lstat,
  mkdir,
  readdir,
  realpath,
  rm,
  rmdir
} from "node:fs/promises";
import { dirname, isAbsolute, join, relative, sep } from "node:path";

interface CopyPlan {
  directories: string[];
  files: Array<{ source: string; destination: string }>;
}

async function hashFile(path: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

async function inspect(
  source: string,
  destination: string,
  plan: CopyPlan
): Promise<void> {
  const sourceInfo = await lstat(source);
  if (sourceInfo.isSymbolicLink())
    throw new Error("迁移目录中包含符号链接，已停止迁移。");
  const destinationInfo = await lstat(destination).catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return null;
      throw error;
    }
  );
  if (destinationInfo?.isSymbolicLink())
    throw new Error("目标目录中包含符号链接，已停止迁移。");
  if (sourceInfo.isDirectory()) {
    if (destinationInfo && !destinationInfo.isDirectory()) {
      throw new Error(`目标已有同名文件，无法合并：${destination}`);
    }
    if (!destinationInfo) plan.directories.push(destination);
    for (const entry of await readdir(source)) {
      if (entry === ".metaverse") continue;
      await inspect(join(source, entry), join(destination, entry), plan);
    }
    return;
  }
  if (!sourceInfo.isFile()) throw new Error("迁移目录中包含不支持的文件类型。");
  if (destinationInfo) {
    if (
      !destinationInfo.isFile() ||
      sourceInfo.size !== destinationInfo.size ||
      (await hashFile(source)) !== (await hashFile(destination))
    ) {
      throw new Error(`目标已有不同内容的同名文件，未覆盖：${destination}`);
    }
    return;
  }
  plan.files.push({ source, destination });
}

/** Copies workspace content without overwriting either directory's existing files. */
export async function copyWorkspaceData(
  sourcePath: string,
  destinationPath: string
): Promise<void> {
  const source = await realpath(sourcePath);
  const destination = await realpath(destinationPath);
  const nested = (root: string, candidate: string) => {
    const path = relative(root, candidate);
    return (
      path === "" ||
      (path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path))
    );
  };
  if (nested(source, destination) || nested(destination, source)) {
    throw new Error("来源目录与目标目录不能相同或相互包含。");
  }
  const plan: CopyPlan = { directories: [], files: [] };
  for (const entry of await readdir(source)) {
    if (entry === ".metaverse") continue;
    await inspect(join(source, entry), join(destination, entry), plan);
  }
  const createdFiles: string[] = [];
  const createdDirectories: string[] = [];
  try {
    for (const directory of plan.directories) {
      await mkdir(directory, { recursive: true });
      createdDirectories.push(directory);
    }
    for (const file of plan.files) {
      await mkdir(dirname(file.destination), { recursive: true });
      await copyFile(file.source, file.destination, constants.COPYFILE_EXCL);
      createdFiles.push(file.destination);
    }
  } catch (error) {
    for (const file of createdFiles.reverse()) await rm(file, { force: true });
    for (const directory of createdDirectories.reverse()) {
      await rmdir(directory).catch(() => undefined);
    }
    throw error;
  }
}
