import { lstat, readdir, rmdir } from "node:fs/promises";
import { afterEach, vi } from "vitest";
import { dirname } from "node:path";
import {
  FIXED_NOW,
  LongProjectStore,
  createFixture,
  createEmptyLongMarkdownFileReference,
  expect,
  it,
  join,
  longCharacterCoreProfileFileId,
  longCharacterFilePath,
  longCharacterRelationshipsFileId,
  readFile,
  writeFile,
  symlink
} from "./long-project-store.test-support";

vi.mock("node:fs/promises", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:fs/promises")>();
  return { ...original, rmdir: vi.fn(original.rmdir) };
});
afterEach(() => vi.mocked(rmdir).mockClear());
const png = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000b49444154789c636000020000050001a5f645400000000049454e44ae426082",
  "hex"
);
async function fixture(suffix: string, withAssets = true) {
  const f = await createFixture(suffix);
  const characterId = `character_${suffix}`;
  const coreProfile = createEmptyLongMarkdownFileReference(
    longCharacterCoreProfileFileId(characterId),
    longCharacterFilePath(characterId, "core-profile.md"),
    FIXED_NOW
  );
  const relationships = createEmptyLongMarkdownFileReference(
    longCharacterRelationshipsFileId(characterId),
    longCharacterFilePath(characterId, "relationships.md"),
    FIXED_NOW
  );
  const root = f.created.projectDirectory;
  const input = { bookId: f.created.book.id, characterId };
  await f.projectStore.applyWorkspaceOperations(root, {
    batch: {
      updatedAt: FIXED_NOW,
      operations: [
        {
          type: "character.create",
          character: {
            id: characterId,
            name: "林岚",
            group: "protagonist",
            order: 1,
            aliases: []
          },
          files: { characterId, coreProfile, relationships }
        }
      ],
      documentWrites: []
    }
  });
  const before = await f.projectStore.readCharacterProfile(root, input);
  await f.projectStore.saveCharacterProfile(root, {
    ...input,
    expectedRevision: before.revision,
    profile: {
      ...before.profile,
      settingDescription: "保留设定",
      appearances: [
        {
          id: "look_ice",
          name: "冰魄系列第一套服装",
          description: "待删除描述"
        },
        { id: "look_rain", name: "雨夜", description: "保留描述" }
      ]
    }
  });
  const source = join(dirname(root), "原图.png");
  await writeFile(source, png);
  if (withAssets)
    for (const appearanceId of ["look_ice", "look_rain"])
      await f.projectStore.importCharacterAssetsAtPaths(root, {
        ...input,
        appearanceId,
        sourcePaths: [source]
      });
  const saved = await f.projectStore.readCharacterProfile(root, input);
  const directory = join(root, dirname(coreProfile.path));
  const deletion = {
    ...input,
    appearanceId: "look_ice",
    expectedRevision: saved.revision,
    expectedAssetIds: saved.assets
      .filter((a) => a.appearanceId === "look_ice")
      .map((a) => a.id)
  };
  return {
    ...f,
    root,
    input,
    source,
    saved,
    directory,
    deletion,
    corePath: join(root, coreProfile.path)
  };
}

it("permanently deletes only the selected appearance and registered binaries with no transaction backup remaining", async () => {
  const f = await fixture("delete_look");
  const deleted = f.saved.assets.find((a) => a.appearanceId === "look_ice")!;
  const kept = f.saved.assets.find((a) => a.appearanceId === "look_rain")!;
  const after = await f.projectStore.deleteCharacterAppearance(
    f.root,
    f.deletion
  );
  expect(after.profile.appearances.map((a) => a.id)).toEqual(["look_rain"]);
  expect(after.profile.settingDescription).toBe("保留设定");
  expect(after.assets).toEqual([kept]);
  expect(
    await readFile(
      join(f.directory, "assets", kept.directory ?? "", kept.filename)
    )
  ).toEqual(png);
  await expect(
    lstat(
      join(f.directory, "assets", deleted.directory ?? "", deleted.filename)
    )
  ).rejects.toMatchObject({ code: "ENOENT" });
  expect(await readFile(f.corePath, "utf8")).not.toContain("待删除描述");
  const reopened = new LongProjectStore({ now: () => FIXED_NOW });
  expect(await reopened.readCharacterProfile(f.root, f.input)).toEqual(after);
  expect(await readdir(join(f.root, ".deepwrite", "transactions"))).toEqual([]);
});

it("deletes the last appearance's manifest and empty image directory while keeping the character", async () => {
  const f = await fixture("delete_last");
  const one = await f.projectStore.deleteCharacterAppearance(
    f.root,
    f.deletion
  );
  const after = await f.projectStore.deleteCharacterAppearance(f.root, {
    ...f.input,
    appearanceId: "look_rain",
    expectedRevision: one.revision,
    expectedAssetIds: one.assets.map((a) => a.id)
  });
  expect(after.profile.appearances).toEqual([]);
  expect(after.assets).toEqual([]);
  await expect(lstat(join(f.directory, "assets"))).rejects.toMatchObject({
    code: "ENOENT"
  });
  await expect(lstat(join(f.directory, "assets.json"))).rejects.toMatchObject({
    code: "ENOENT"
  });
  expect(await readFile(f.corePath, "utf8")).toContain("保留设定");
});

it("deletes an empty appearance without creating an image directory", async () => {
  const f = await fixture("delete_empty", false);
  const after = await f.projectStore.deleteCharacterAppearance(
    f.root,
    f.deletion
  );
  expect(after.profile.appearances.map((a) => a.id)).toEqual(["look_rain"]);
  await expect(lstat(join(f.directory, "assets"))).rejects.toMatchObject({
    code: "ENOENT"
  });
});

it("refuses a stale confirmation after a profile edit before changing files", async () => {
  const f = await fixture("delete_stale");
  await f.projectStore.saveCharacterProfile(f.root, {
    ...f.input,
    expectedRevision: f.saved.revision,
    profile: { ...f.saved.profile, settingDescription: "更新后的设定" }
  });
  await expect(
    f.projectStore.deleteCharacterAppearance(f.root, f.deletion)
  ).rejects.toThrow(/更新|重新/);
  expect(
    (await f.projectStore.readCharacterProfile(f.root, f.input)).assets
  ).toEqual(f.saved.assets);
});

it("refuses a stale confirmation after more images were added to the appearance", async () => {
  const f = await fixture("delete_assets_stale");
  await f.projectStore.importCharacterAssetsAtPaths(f.root, {
    ...f.input,
    appearanceId: "look_ice",
    sourcePaths: [f.source]
  });
  await expect(
    f.projectStore.deleteCharacterAppearance(f.root, f.deletion)
  ).rejects.toThrow(/图片|重新/);
  expect(
    (await f.projectStore.readCharacterProfile(f.root, f.input)).assets
  ).toHaveLength(3);
});

it("rejects a symlink asset before deleting any metadata or the external file", async () => {
  const f = await fixture("delete_link");
  const deleted = f.saved.assets.find((a) => a.appearanceId === "look_ice")!;
  const path = join(
    f.directory,
    "assets",
    deleted.directory ?? "",
    deleted.filename
  );
  const { unlink } = await import("node:fs/promises");
  await unlink(path);
  await symlink(f.source, path);
  const before = await readFile(f.corePath);
  await expect(
    f.projectStore.deleteCharacterAppearance(f.root, f.deletion)
  ).rejects.toThrow(/链接|文件/);
  expect(await readFile(f.corePath)).toEqual(before);
  expect(await readFile(f.source)).toEqual(png);
});

it("reports successful file deletion with a cleanup warning when the empty directory cannot be removed", async () => {
  const f = await fixture("delete_cleanup");
  const one = await f.projectStore.deleteCharacterAppearance(
    f.root,
    f.deletion
  );
  vi.mocked(rmdir).mockRejectedValueOnce(
    Object.assign(new Error("permission denied"), { code: "EACCES" })
  );
  const after = await f.projectStore.deleteCharacterAppearance(f.root, {
    ...f.input,
    appearanceId: "look_rain",
    expectedRevision: one.revision,
    expectedAssetIds: one.assets.map((a) => a.id)
  });
  expect(after.profile.appearances).toEqual([]);
  expect(after.assets).toEqual([]);
  expect(after.directoryCleanupWarning).toContain("目录");
  await expect(
    lstat(
      join(
        f.directory,
        "assets",
        one.assets[0]!.directory ?? "",
        one.assets[0]!.filename
      )
    )
  ).rejects.toMatchObject({ code: "ENOENT" });
});

it("permanent deletion never creates or retains a legacy copy of the removed appearance", async () => {
  const f = await fixture("delete_legacy", false);
  const legacyPath = join(f.directory, "core-profile.legacy.md");
  await writeFile(
    f.corePath,
    "1.服装：敏感旧形象文本\n\n2.服装：保留旧形象文本\n"
  );
  await writeFile(
    legacyPath,
    "1.服装：敏感旧形象文本\n\n2.服装：保留旧形象文本\n"
  );
  const before = await f.projectStore.readCharacterProfile(f.root, f.input);
  await f.projectStore.deleteCharacterAppearance(f.root, {
    ...f.input,
    appearanceId: "appearance_legacy_1",
    expectedRevision: before.revision,
    expectedAssetIds: []
  });
  expect(await readFile(f.corePath, "utf8")).not.toContain("敏感旧形象文本");
  expect(await readFile(f.corePath, "utf8")).toContain("保留旧形象文本");
  await expect(lstat(legacyPath)).rejects.toMatchObject({ code: "ENOENT" });
});
