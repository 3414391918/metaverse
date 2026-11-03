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
    migrationSourcePath: string | null = null,
    directories: string[] | null = null
  ) => ({
    path,
    previousPath,
    migrationSourcePath,
    directories: directories ?? (path ? [path] : [])
  });
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
      settings(canonicalSecond, canonicalFirst, null, [
        canonicalFirst,
        canonicalSecond
      ])
    );

    const reloaded = new WorkspaceDirectoryStore(join(root, "user-data"));
    await expect(reloaded.list()).resolves.toEqual(
      settings(canonicalSecond, canonicalFirst, null, [
        canonicalFirst,
        canonicalSecond
      ])
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
      settings(await realpath(second), null, await realpath(third), [
        await realpath(first),
        await realpath(second),
        await realpath(third)
      ])
    );
    await expect(store.restore()).rejects.toThrow("没有可恢复");
    await mkdir(join(third, "books"));
    await writeFile(join(third, "books", "chapter.txt"), "第三个目录的数据");
    const migrated = await store.migrate();
    expect(migrated.path).toBe(await realpath(second));
    expect(migrated.migrationSourcePath).toBeNull();
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

  it("upgrades a legacy v2 config into a managed directory list", async () => {
    const root = await mkdtemp(join(tmpdir(), "deepwrite-workspace-legacy-"));
    temporaryRoots.push(root);
    const first = join(root, "first");
    const second = join(root, "second");
    await Promise.all([mkdir(first), mkdir(second)]);
    const userData = join(root, "user-data");
    const store = new WorkspaceDirectoryStore(userData);
    await store.save(first);
    await store.save(second);

    // Simulate a v2 on-disk config with only path/previousPath.
    const { writeFile: writeDisk } = await import("node:fs/promises");
    const settingsPath = store.settingsPath;
    const canonicalFirst = await realpath(first);
    const canonicalSecond = await realpath(second);
    await writeDisk(
      settingsPath,
      JSON.stringify({
        version: 2,
        path: canonicalSecond,
        previousPath: canonicalFirst,
        migrationSourcePath: null
      }),
      "utf8"
    );

    const upgraded = await new WorkspaceDirectoryStore(userData).list();
    expect(upgraded.path).toBe(canonicalSecond);
    expect(upgraded.previousPath).toBe(canonicalFirst);
    expect(upgraded.directories).toEqual([canonicalSecond, canonicalFirst]);
  });

  it("registers, switches and removes managed directories", async () => {
    const root = await mkdtemp(join(tmpdir(), "deepwrite-workspace-manage-"));
    temporaryRoots.push(root);
    const first = join(root, "first");
    const second = join(root, "second");
    await Promise.all([mkdir(first), mkdir(second)]);
    const store = new WorkspaceDirectoryStore(join(root, "user-data"));
    await store.save(first);

    const added = await store.add(second);
    const canonicalFirst = await realpath(first);
    const canonicalSecond = await realpath(second);
    expect(added.path).toBe(canonicalFirst);
    expect(added.directories).toEqual([canonicalFirst, canonicalSecond]);

    await expect(store.add(second)).rejects.toThrow("已在管理列表中");

    const switched = await store.switch(second);
    expect(switched.path).toBe(canonicalSecond);
    expect(switched.previousPath).toBe(canonicalFirst);
    expect(switched.directories).toEqual([canonicalFirst, canonicalSecond]);

    await expect(store.remove(second)).rejects.toThrow("请先切换");

    const removed = await store.remove(first);
    expect(removed.path).toBe(canonicalSecond);
    expect(removed.directories).toEqual([canonicalSecond]);

    await expect(store.switch(first)).rejects.toThrow("不在工作目录管理列表中");
    await expect(store.remove(first)).rejects.toThrow("不在管理列表中");
  });

  it("removes a registered directory even after it disappears from disk", async () => {
    const root = await mkdtemp(
      join(tmpdir(), "deepwrite-workspace-remove-gone-")
    );
    temporaryRoots.push(root);
    const first = join(root, "first");
    const second = join(root, "second");
    await Promise.all([mkdir(first), mkdir(second)]);
    const store = new WorkspaceDirectoryStore(join(root, "user-data"));
    await store.save(first);
    await store.add(second);
    const canonicalFirst = await realpath(first);
    const canonicalSecond = await realpath(second);
    await store.switch(second);

    await rm(first, { recursive: true, force: true });
    const removed = await store.remove(canonicalFirst);
    expect(removed.directories).toEqual([canonicalSecond]);
    expect(removed.path).toBe(canonicalSecond);
  });

  it("migrates data between two registered empty-target directories", async () => {
    const root = await mkdtemp(join(tmpdir(), "deepwrite-workspace-mdata-"));
    temporaryRoots.push(root);
    const source = join(root, "source");
    const target = join(root, "target");
    await Promise.all([mkdir(source), mkdir(target)]);
    const store = new WorkspaceDirectoryStore(join(root, "user-data"));
    await store.save(source);
    await store.add(target);
    await mkdir(join(source, "books"));
    await writeFile(join(source, "books", "chapter.txt"), "源数据");
    await expect(store.migrateData(source, target)).resolves.toBeTruthy();
    expect(
      await readFile(join(target, "books", "chapter.txt"), "utf8")
    ).toBe("源数据");
    expect(
      await readFile(join(source, "books", "chapter.txt"), "utf8")
    ).toBe("源数据");
    // Current directory and registrations stay unchanged.
    const after = await store.list();
    expect(after.path).toBe(await realpath(source));
    expect(after.directories).toHaveLength(2);
  });

  it("rejects migrateData edge cases: unregistered, same, nested and parent targets", async () => {
    const root = await mkdtemp(join(tmpdir(), "deepwrite-workspace-medge-"));
    temporaryRoots.push(root);
    const source = join(root, "source");
    const target = join(root, "target");
    const unregistered = join(root, "unregistered");
    await Promise.all([mkdir(source), mkdir(target), mkdir(unregistered)]);
    const child = join(source, "child");
    await mkdir(child);
    const store = new WorkspaceDirectoryStore(join(root, "user-data"));
    await store.save(source);
    await store.add(target);

    await expect(store.migrateData(source, unregistered)).rejects.toThrow(
      "迁移目标目录必须已在工作目录管理列表中"
    );
    await expect(
      store.migrateData(unregistered, target)
    ).rejects.toThrow("迁移来源目录必须已在工作目录管理列表中");
    await expect(store.migrateData(source, source)).rejects.toThrow("不能相同");
    await store.add(child);
    await expect(store.migrateData(source, child)).rejects.toThrow(
      "不能相同或相互包含"
    );
    // Target being a parent of the source must also be rejected.
    await expect(store.migrateData(child, source)).rejects.toThrow(
      "不能相同或相互包含"
    );
  });

  it("rejects migrateData into a non-empty target without touching its data", async () => {
    const root = await mkdtemp(join(tmpdir(), "deepwrite-workspace-mnon-"));
    temporaryRoots.push(root);
    const source = join(root, "source");
    const target = join(root, "target");
    await Promise.all([mkdir(source), mkdir(target)]);
    await writeFile(join(source, "same.txt"), "source");
    await writeFile(join(target, "same.txt"), "target");
    const store = new WorkspaceDirectoryStore(join(root, "user-data"));
    await store.save(source);
    await store.add(target);

    await expect(store.migrateData(source, target)).rejects.toThrow(
      "目标目录必须为空目录"
    );
    expect(await readFile(join(target, "same.txt"), "utf8")).toBe("target");
    expect(await readFile(join(source, "same.txt"), "utf8")).toBe("source");
  });

  it("rolls back a partially copied migration so the target stays clean on failure", async () => {
    const root = await mkdtemp(join(tmpdir(), "deepwrite-workspace-mroll-"));
    temporaryRoots.push(root);
    const source = join(root, "source");
    const target = join(root, "target");
    await Promise.all([mkdir(source), mkdir(target)]);
    await mkdir(join(source, "books"));
    await writeFile(join(source, "books", "chapter.txt"), "源数据");
    const unreadable = join(source, "secret.txt");
    await writeFile(unreadable, "无法读取");
    await import("node:fs/promises").then((fs) =>
      fs.chmod(unreadable, 0o000)
    );
    const store = new WorkspaceDirectoryStore(join(root, "user-data"));
    await store.save(source);
    await store.add(target);

    await expect(store.migrateData(source, target)).rejects.toThrow();
    // The failure rollback must leave the empty target untouched: no stray
    // copies from the partially completed migration.
    const { readdir } = await import("node:fs/promises");
    expect(await readdir(target)).toEqual([]);
    expect(
      await readFile(join(source, "books", "chapter.txt"), "utf8")
    ).toBe("源数据");
  });
});
