import { createHash, randomUUID } from "node:crypto";
import {
  lstat,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile
} from "node:fs/promises";
import { dirname, join } from "node:path";
import { ToolFilePathSchema, ToolIdSchema } from "@deepwrite/contracts";

export const MAX_TOOL_FILE_BYTES = 4 * 1024 * 1024;
export const sha256 = (content: string) =>
  createHash("sha256").update(content).digest("hex");
export const missing = (error: unknown) =>
  (error as NodeJS.ErrnoException).code === "ENOENT";

export async function toolFilePath(
  root: string,
  id: string,
  path?: string
): Promise<string> {
  const parts = [
    ToolIdSchema.parse(id),
    ...(path ? ToolFilePathSchema.parse(path).split("/") : [])
  ];
  let current = root;
  const rootInfo = await lstat(root);
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink())
    throw new Error("工具目录必须是真实文件夹。");
  for (let i = 0; i < parts.length; i++) {
    current = join(current, parts[i]!);
    try {
      const info = await lstat(current);
      if (
        info.isSymbolicLink() ||
        (i < parts.length - 1 && !info.isDirectory())
      )
        throw new Error("工具文件路径包含符号链接或无效目录。");
    } catch (error) {
      if (!missing(error)) throw error;
    }
  }
  return current;
}

export async function readToolText(path: string): Promise<string> {
  const info = await lstat(path);
  if (
    !info.isFile() ||
    info.isSymbolicLink() ||
    info.size > MAX_TOOL_FILE_BYTES
  )
    throw new Error("只支持编辑不超过 4 MB 的普通文本文件。");
  const bytes = await readFile(path);
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (text.includes("\0")) throw new Error("binary");
    return text;
  } catch {
    throw new Error("这个文件不是 UTF-8 文本，无法在工具编辑器中打开。");
  }
}

export async function writeToolText(
  path: string,
  content: string
): Promise<void> {
  if (Buffer.byteLength(content, "utf8") > MAX_TOOL_FILE_BYTES)
    throw new Error("工具文件不能超过 4 MB。");
  await mkdir(dirname(path), { recursive: true });
  const temporary = join(dirname(path), `.tool-${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, content, {
      encoding: "utf8",
      mode: 0o600,
      flag: "wx"
    });
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}

export async function listToolFiles(
  directory: string,
  prefix = ""
): Promise<Array<{ path: string; bytes: number }>> {
  const files: Array<{ path: string; bytes: number }> = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    if (
      item.name.startsWith(".") ||
      item.name === "node_modules" ||
      item.isSymbolicLink()
    )
      continue;
    const path = prefix ? `${prefix}/${item.name}` : item.name;
    if (!ToolFilePathSchema.safeParse(path).success) continue;
    if (item.isDirectory())
      files.push(...(await listToolFiles(join(directory, item.name), path)));
    else if (item.isFile())
      files.push({
        path,
        bytes: (await lstat(join(directory, item.name))).size
      });
    if (files.length > 1000)
      throw new Error("单个工具文件过多，最多展示 1000 个文件。");
  }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}
