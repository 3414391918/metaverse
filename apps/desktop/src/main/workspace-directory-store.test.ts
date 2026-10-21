import {
  mkdtemp,
  mkdir,
  readFile,
  realpath,
  rm,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { WorkspaceDirectoryStore } from "./workspace-directory-store";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true }))
  );
});

describe("WorkspaceDirectoryStore", () => {
  const settings = (
    path: string | null,
    previousPath: string | null = null,
    migrationSourcePath: string | null = null
  ) => ({ path, previousPath, migrationSourcePath });
  it("defaults a first-time user to the system documents directory", async () => {
    const root = await mkdtemp(
      join(tmpdir(), "deepwrite-workspace-directory-default-")
    );
    temporaryRoots.push(root);
    const documents = join(root, "Documents");
    const userData = join(root, "user-data");

    const store = new WorkspaceDirectoryStore(userData);
    const initialized = await store.initializeDefault(documents);
    const canonicalDocuments = await realpath(documents);
    expect(initialized).toEqual(settings(canonicalDocuments));

    const reloaded = new WorkspaceDirectoryStore(userData);
    await expect(reloaded.list()).resolves.toEqual(
      settings(canonicalDocuments)
    );
  });

  it("keeps an existing workspace directory when initializing the default", async () => {
    const root = await mkdtemp(
      join(tmpdir(), "deepwrite-workspace-directory-existing-")
    );
    temporaryRoots.push(root);
    const existing = join(root, "已有工作区");
    const documents = join(root, "Documents");
    await Promise.all([mkdir(existing), mkdir(documents)]);

    const store = new WorkspaceDirectoryStore(join(root, "user-data"));
    const canonicalExisting = await realpath(existing);
    await store.save(existing);

    await expect(store.initializeDefault(documents)).resolves.toEqual(
      settings(canonicalExisting)
    );
    await expect(store.list()).resolves.toEqual(settings(canonicalExisting));
  });

  it("starts unset and persists freely switchable directories", async () => {
    const root = await mkdtemp(
      join(tmpdir(), "deepwrite-workspace-directory-")
    );
    temporaryRoots.push(root);
    const first = join(root, "工作区一");
    const second = join(root, "工作区二");
    await Promise.all([mkdir(first), mkdir(second)]);

    const store = new WorkspaceDirectoryStore(join(root, "user-data"));
    await expect(store.list()).resolves.toEqual(settings(null));
    const canonicalFirst = await realpath(first);
    const canonicalSecond = await realpath(second);
    await expect(store.save(first)).resolves.toEqual(settings(canonicalFirst));
    await expect(store.save(second)).resolves.toEqual(
      settings(canonicalSecond, canonicalFirst)
    );

    const reloaded = new WorkspaceDirectoryStore(join(root, "user-data"));
    await expect(reloaded.list()).resolves.toEqual(
      settings(canonicalSecond, canonicalFirst)
    );
  });

  it("rejects files as workspace directories", async () => {
    const root = await mkdtemp(
      join(tmpdir(), "deepwrite-workspace-directory-file-")
    );
    temporaryRoots.push(root);
    const file = join(root, "not-a-folder.txt");
    await writeFile(file, "x", "utf8");

    await expect(
      new WorkspaceDirectoryStore(join(root, "user-data")).save(file)
    ).rejects.toThrow(/真实文件夹/u);
  });

  it("restores only the immediately previous directory and migrates its replacement without deleting it", async () => {
    const root = await mkdtemp(join(tmpdir(), "deepwrite-workspace-restore-"));
    temporaryRoots.push(root);
    const first = join(root, "first");
    const second = join(root, "second");
    const third = join(root, "third");
    await Promise.all([mkdir(first), mkdir(second), mkdir(third)]);
    const store = new WorkspaceDirectoryStore(join(root, "user-data"));
    await store.save(first);
    await store.save(second);
    await store.save(third);
    const restored = await store.restore();
    expect(restored).toEqual(
      settings(await realpath(second), null, await realpath(third))
    );
    await expect(store.restore()).rejects.toThrow("没有可恢复");
    await mkdir(join(third, "books"));
    await writeFile(join(third, "books", "chapter.txt"), "第三个目录的数据");
    const migrated = await store.migrate();
    expect(migrated).toEqual(settings(await realpath(second)));
    expect(await readFile(join(second, "books", "chapter.txt"), "utf8")).toBe(
      "第三个目录的数据"
    );
    expect(await readFile(join(third, "books", "chapter.txt"), "utf8")).toBe(
      "第三个目录的数据"
    );
  });

  it("refuses conflicting migration files without overwriting the destination", async () => {
    const root = await mkdtemp(join(tmpdir(), "deepwrite-workspace-conflict-"));
    temporaryRoots.push(root);
    const first = join(root, "first");
    const second = join(root, "second");
    await Promise.all([mkdir(first), mkdir(second)]);
    await writeFile(join(first, "same.txt"), "target");
    await writeFile(join(second, "same.txt"), "source");
    const store = new WorkspaceDirectoryStore(join(root, "user-data"));
    await store.save(first);
    await store.save(second);
    await store.restore();
    await expect(store.migrate()).rejects.toThrow("未覆盖");
    expect(await readFile(join(first, "same.txt"), "utf8")).toBe("target");
    expect((await store.list()).migrationSourcePath).toBe(
      await realpath(second)
    );
  });
});
