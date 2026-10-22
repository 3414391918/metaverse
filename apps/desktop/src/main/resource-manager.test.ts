import {
  mkdtemp,
  mkdir,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, win32 } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ResourceManager } from "./resource-manager";
import {
  validateResourceName,
  copyResource,
  containsPath
} from "./resource-manager-files";
import { WorkspaceDirectoryStore } from "./workspace-directory-store";
const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((path) => rm(path, { recursive: true, force: true }))
  );
});
async function fixture() {
  const temp = await realpath(
    await mkdtemp(join(tmpdir(), "metaverse-resources-"))
  );
  roots.push(temp);
  const workspace = new WorkspaceDirectoryStore(join(temp, "profile"));
  const work = join(temp, "metadata");
  await mkdir(work);
  await workspace.save(work);
  const ports = {
    openPath: vi.fn(async () => ""),
    reveal: vi.fn(),
    trash: vi.fn(async () => undefined),
    copyText: vi.fn(),
    chooseFiles: vi.fn(async () => [] as string[])
  };
  const manager = new ResourceManager(workspace, ports);
  const root = (
    await manager.execute({ action: "list", directory: "", query: "" })
  ).root;
  return { manager, root, work, workspace, temp, ports };
}
describe("resource manager", () => {
  it("imports without overwriting and searches, copies and moves nested resources", async () => {
    const { manager, temp, root } = await fixture();
    const source = join(temp, "图片.png");
    await writeFile(source, "image bytes");
    await manager.execute({
      action: "import",
      directory: "",
      sourcePaths: [source]
    });
    await manager.execute({
      action: "import",
      directory: "",
      sourcePaths: [source]
    });
    expect(await readFile(join(root, "图片.png"), "utf8")).toBe("image bytes");
    expect(await readFile(join(root, "图片 (2).png"), "utf8")).toBe(
      "image bytes"
    );
    await manager.execute({
      action: "createFolder",
      directory: "",
      name: "场景"
    });
    await manager.execute({
      action: "clipboard",
      paths: ["图片.png"],
      mode: "copy"
    });
    await manager.execute({ action: "paste", directory: "场景" });
    await manager.execute({
      action: "clipboard",
      paths: ["图片 (2).png"],
      mode: "cut"
    });
    await manager.execute({ action: "paste", directory: "场景" });
    await expect(readFile(join(root, "图片 (2).png"))).rejects.toMatchObject({
      code: "ENOENT"
    });
    const result = await manager.execute({
      action: "list",
      directory: "",
      query: "图片"
    });
    expect(result.entries.map((entry) => entry.path)).toEqual(
      expect.arrayContaining(["图片.png", "场景/图片.png", "场景/图片 (2).png"])
    );
  });
  it("rejects escape paths, links and self-contained copies; never removes an existing destination on conflict", async () => {
    const { manager, root, temp } = await fixture();
    await expect(
      manager.execute({ action: "open", path: "../secret" })
    ).rejects.toThrow();
    await expect(
      manager.execute({ action: "open", path: "C:\\secret" })
    ).rejects.toThrow();
    await expect(
      manager.execute({ action: "trash", paths: [""] })
    ).rejects.toThrow();
    await mkdir(join(root, "nested"));
    await symlink(
      temp,
      join(root, "link"),
      process.platform === "win32" ? "junction" : "dir"
    );
    await expect(
      manager.execute({ action: "open", path: "link" })
    ).rejects.toThrow("符号链接");
    await manager.execute({
      action: "clipboard",
      mode: "copy",
      paths: ["nested"]
    });
    await expect(
      manager.execute({ action: "paste", directory: "nested" })
    ).rejects.toThrow("自身");
    await writeFile(join(temp, "source.txt"), "source");
    await writeFile(join(root, "existing.txt"), "destination");
    await expect(
      copyResource(join(temp, "source.txt"), join(root, "existing.txt"))
    ).rejects.toMatchObject({ code: "EEXIST" });
    expect(await readFile(join(root, "existing.txt"), "utf8")).toBe(
      "destination"
    );
  });
  it("clears the file clipboard when switching workspaces and copies native absolute paths", async () => {
    const { manager, root, temp, workspace, ports } = await fixture();
    await writeFile(join(root, "test.txt"), "test");
    await manager.execute({ action: "copyPath", paths: ["test.txt"] });
    expect(ports.copyText).toHaveBeenCalledWith(join(root, "test.txt"));
    await manager.execute({
      action: "clipboard",
      paths: ["test.txt"],
      mode: "cut"
    });
    const next = join(temp, "next");
    await mkdir(next);
    await workspace.save(next);
    const listing = await manager.execute({
      action: "list",
      directory: "",
      query: ""
    });
    expect(listing.entries).toEqual([]);
    expect(listing.canPaste).toBe(false);
    await expect(
      manager.execute({ action: "paste", directory: "" })
    ).rejects.toThrow("先复制");
  });
  it.each([
    "CON",
    "nul.txt",
    "LPT1",
    "COM¹.txt",
    "a:b",
    "a\\b",
    "ending.",
    "ending ",
    "../x"
  ])("rejects Windows-incompatible names: %s", (name) =>
    expect(() => validateResourceName(name)).toThrow()
  );
  it("handles Windows drive letters, separators and UNC shares without prefix escapes", () => {
    expect(
      containsPath(
        "C:\\metadata\\resources",
        "c:\\metadata\\resources\\场景\\图.png",
        win32
      )
    ).toBe(true);
    expect(containsPath("C:\\metadata\\resources", "D:\\outside", win32)).toBe(
      false
    );
    expect(
      containsPath(
        "C:\\metadata\\resources",
        "C:\\metadata\\resources-copy\\x",
        win32
      )
    ).toBe(false);
    expect(
      containsPath(
        "\\\\server\\share\\resources",
        "\\\\server\\share\\resources\\x",
        win32
      )
    ).toBe(true);
    expect(
      containsPath(
        "\\\\server\\share\\resources",
        "\\\\server\\other\\x",
        win32
      )
    ).toBe(false);
  });
});
