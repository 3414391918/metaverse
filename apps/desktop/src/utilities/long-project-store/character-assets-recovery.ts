import { TextDecoder } from "node:util";
import {
  LongCharacterAssetManifestSchema,
  type LongWorkspaceIndexSnapshot
} from "@deepwrite/contracts";
import type { ResolveProjectConflictsInput } from "../project-transaction/resolve-conflicts";
import { characterAssetPaths } from "./character-profile-context";
import { parseJson } from "./io";

/** A retained character retains its independent asset and migration files too. */
export async function restoreRetainedCharacterAssets(
  index: LongWorkspaceIndexSnapshot,
  read: Parameters<ResolveProjectConflictsInput["prepare"]>[0],
  recovery: Parameters<ResolveProjectConflictsInput["prepare"]>[1],
  changes: Map<string, string | Uint8Array>
) {
  const preserve = async (path: string, required: boolean) => {
    const current = await read(path);
    if (current !== null) return current;
    const before = recovery.deletions.has(path)
      ? await recovery.readBeforeDeletion(path)
      : null;
    if (before !== null) {
      changes.set(path, before);
      return before;
    }
    if (required)
      throw new Error(`角色资产引用的文件缺失：${path}。请恢复文件后重试。`);
    return null;
  };
  for (const entry of index.characterFiles) {
    const paths = characterAssetPaths(entry.coreProfile.path);
    const manifestBytes = await preserve(
      paths.manifest,
      recovery.deletions.has(paths.manifest)
    );
    if (manifestBytes !== null) {
      let content: string;
      try {
        content = new TextDecoder("utf-8", { fatal: true }).decode(
          manifestBytes
        );
      } catch {
        throw new Error("角色图片清单不是有效 UTF-8，无法恢复。");
      }
      const manifest = LongCharacterAssetManifestSchema.parse(
        parseJson(content, "角色图片清单")
      );
      for (const asset of manifest.assets)
        await preserve(paths.binary(asset.filename, asset.directory), true);
    }
    if (recovery.deletions.has(paths.legacy))
      await preserve(paths.legacy, true);
  }
}
