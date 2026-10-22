import { constants } from "node:fs";
import { lstat, mkdir, open, readdir, realpath, rm } from "node:fs/promises";
import { basename, extname, isAbsolute, join, relative, sep } from "node:path";
import { pipeline } from "node:stream/promises";
import { ResourcePathSchema } from "@deepwrite/contracts";

export function validateResourceName(name: string): string {
  if (
    name !== name.trim() ||
    !name ||
    name === "." ||
    name === ".." ||
    /[<>:"/\\|?*\u0000-\u001f]/u.test(name) ||
    /[. ]$/u.test(name) ||
    /^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/iu.test(name) ||
    name.length > 255
  ) {
    throw new Error(
      "名称无效：不能含路径分隔符、Windows 保留名称或末尾的点和空格。"
    );
  }
  return name;
}

export function containsPath(
  root: string,
  path: string,
  paths = { relative, isAbsolute, sep }
): boolean {
  const part = paths.relative(root, path);
  return (
    part === "" ||
    (!paths.isAbsolute(part) &&
      part !== ".." &&
      !part.startsWith(`..${paths.sep}`))
  );
}

export async function resourceRoot(workspace: string): Promise<string> {
  const workspaceInfo = await lstat(workspace);
  if (!workspaceInfo.isDirectory() || workspaceInfo.isSymbolicLink())
    throw new Error("工作目录不可用。");
  const parent = await realpath(workspace);
  const root = join(parent, "resources");
  await mkdir(root, { recursive: true });
  const info = await lstat(root);
  if (!info.isDirectory() || info.isSymbolicLink())
    throw new Error("资源目录不能是符号链接。");
  if ((await realpath(root)) !== root)
    throw new Error("资源目录不是本地真实目录。");
  return root;
}

export async function resourcePath(
  root: string,
  input: string
): Promise<string> {
  const value = ResourcePathSchema.parse(input);
  let current = root;
  for (const part of value ? value.split("/") : []) {
    current = join(current, part);
    const info = await lstat(current);
    if (info.isSymbolicLink()) throw new Error("不支持操作符号链接。");
    if (!info.isDirectory() && !info.isFile())
      throw new Error("不支持此文件类型。");
  }
  const canonical = await realpath(current);
  if (!containsPath(root, canonical))
    throw new Error("不能访问资源目录以外的文件。");
  return canonical;
}

export async function requireDirectory(
  root: string,
  value: string
): Promise<string> {
  const path = await resourcePath(root, value);
  if (!(await lstat(path)).isDirectory()) throw new Error("请选择文件夹。");
  return path;
}

export function minimalPaths(paths: string[]): string[] {
  return [...new Set(paths)].filter(
    (path, _index, all) =>
      !all.some((parent) => parent !== path && path.startsWith(`${parent}/`))
  );
}

export async function availableDestination(
  directory: string,
  source: string,
  isDirectory: boolean
): Promise<string> {
  const name = validateResourceName(basename(source));
  const names = new Set(
    (await readdir(directory)).map((item) =>
      item.normalize("NFC").toLowerCase()
    )
  );
  const extension = isDirectory ? "" : extname(name);
  const stem = extension ? name.slice(0, -extension.length) : name;
  for (let count = 0; count < 10000; count++) {
    const candidate = count ? `${stem} (${count + 1})${extension}` : name;
    if (!names.has(candidate.normalize("NFC").toLowerCase()))
      return join(directory, candidate);
  }
  throw new Error("同名资源过多，请更换名称。");
}

export async function inspectResourceTree(
  path: string,
  budget = { count: 0 }
): Promise<void> {
  if (++budget.count > 50000)
    throw new Error("一次操作的文件数量不能超过 50000 个，请分批操作。");
  validateResourceName(basename(path));
  const info = await lstat(path);
  if (info.isSymbolicLink() || (!info.isFile() && !info.isDirectory()))
    throw new Error("导入或复制的内容中含符号链接或特殊文件，已停止操作。");
  if (info.isDirectory()) {
    for (const item of await readdir(path))
      await inspectResourceTree(join(path, item), budget);
  }
}

export async function copyResource(
  source: string,
  destination: string
): Promise<void> {
  const info = await lstat(source);
  if (info.isSymbolicLink() || (!info.isDirectory() && !info.isFile()))
    throw new Error("不支持复制符号链接或特殊文件。");
  let created = false;
  try {
    if (info.isDirectory()) {
      await mkdir(destination);
      created = true;
      for (const item of await readdir(source))
        await copyResource(join(source, item), join(destination, item));
    } else {
      const canonical = await realpath(source);
      const input = await open(
        source,
        constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0)
      );
      try {
        const opened = await input.stat();
        if (
          !opened.isFile() ||
          opened.ino !== info.ino ||
          opened.dev !== info.dev ||
          (await realpath(source)) !== canonical
        )
          throw new Error("来源文件已变化，请重试。");
        const output = await open(destination, "wx", 0o600);
        created = true;
        try {
          await pipeline(
            input.createReadStream({ autoClose: true }),
            output.createWriteStream({ autoClose: true })
          );
        } finally {
          await output.close();
        }
      } finally {
        await input.close();
      }
    }
  } catch (error) {
    if (created) await rm(destination, { recursive: true, force: true });
    throw error;
  }
}

export function relativeResource(root: string, path: string): string {
  return relative(root, path).split(sep).join("/");
}
export function parentResource(path: string): string {
  return path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
}
