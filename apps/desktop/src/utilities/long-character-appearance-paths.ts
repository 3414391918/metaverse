import { lstat, realpath } from "node:fs/promises";
import { dirname, join } from "node:path";
import { LONG_CHARACTER_IMAGE_MAX_BYTES } from "@deepwrite/contracts";
import { characterAssetPaths } from "./long-project-store/character-profile-context";
import {
  isNodeError,
  validateParentDirectories
} from "./long-project-store/io";

/** Reject redirected storage before publishing external-agent read/write paths. */
export async function characterAppearanceStorage(
  projectDirectory: string,
  coreProfilePath: string,
  filenames: readonly string[] = []
) {
  const assetPaths = characterAssetPaths(coreProfilePath);
  const core = join(projectDirectory, coreProfilePath);
  const directory = join(
    projectDirectory,
    dirname(assetPaths.binary("placeholder.png"))
  );
  await validateParentDirectories(projectDirectory, dirname(core));
  try {
    const stat = await lstat(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink())
      throw new Error("角色资产目录不能包含符号链接或非目录节点。");
    await validateParentDirectories(projectDirectory, directory);
  } catch (error) {
    // A newly created target can have no asset directory; its existing parent
    // was checked above. References with registered images must exist.
    if (!isNodeError(error, "ENOENT") || filenames.length) throw error;
  }
  for (const filename of filenames) {
    const path = join(directory, filename);
    const stat = await lstat(path);
    if (
      !stat.isFile() ||
      stat.isSymbolicLink() ||
      stat.nlink !== 1 ||
      (await realpath(path)) !== path
    ) {
      throw new Error("角色资产图片不能包含符号链接或其他文件映射。");
    }
    if (!stat.size || stat.size > LONG_CHARACTER_IMAGE_MAX_BYTES)
      throw new Error("角色资产图片大小无效。");
  }
  return {
    coreProfilePath: core,
    assetsManifestPath: join(projectDirectory, assetPaths.manifest),
    assetsDirectory: directory
  };
}
