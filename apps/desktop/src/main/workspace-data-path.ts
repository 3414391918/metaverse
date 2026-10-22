import { lstat, realpath } from "node:fs/promises";
import { join } from "node:path";
import { WorkspaceDirectoryStore } from "./workspace-directory-store";

/** Media access follows the same selected workspace as Core's project index. */
export async function workspaceDataPath(userDataPath: string): Promise<string> {
  const { path } = await new WorkspaceDirectoryStore(userDataPath).list();
  if (!path) throw new Error("请先选择工作目录。");
  const info = await lstat(path);
  if (!info.isDirectory() || info.isSymbolicLink())
    throw new Error("工作目录不可用。");
  const directory = join(await realpath(path), ".metaverse");
  const dataInfo = await lstat(directory);
  if (!dataInfo.isDirectory() || dataInfo.isSymbolicLink())
    throw new Error("工作目录索引不可用。");
  return realpath(directory);
}
