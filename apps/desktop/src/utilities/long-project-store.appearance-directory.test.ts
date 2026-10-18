import { createHash } from "node:crypto";
import { readdir, unlink } from "node:fs/promises";
import {
  FIXED_NOW,
  createFixture,
  createEmptyLongMarkdownFileReference,
  longCharacterCoreProfileFileId,
  longCharacterRelationshipsFileId,
  longCharacterFilePath,
  expect,
  it,
  join,
  writeFile,
  readFile,
  mkdir,
  symlink
} from "./long-project-store.test-support";

const png = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489000000000049454e44ae426082",
  "hex"
);
const hash = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
async function fixture() {
  const f = await createFixture("appearance_directory");
  const characterId = "character_example";
  const input = { bookId: f.created.book.id, characterId };
  const profilePath = longCharacterFilePath(characterId, "core-profile.md");
  await f.projectStore.applyWorkspaceOperations(f.created.projectDirectory, {
    batch: {
      updatedAt: FIXED_NOW,
      documentWrites: [],
      operations: [
        {
          type: "character.create",
          character: {
            id: characterId,
            name: "示例角色",
            group: "protagonist",
            order: 1,
            aliases: []
          },
          files: {
            characterId,
            coreProfile: createEmptyLongMarkdownFileReference(
              longCharacterCoreProfileFileId(characterId),
              profilePath,
              FIXED_NOW
            ),
            relationships: createEmptyLongMarkdownFileReference(
              longCharacterRelationshipsFileId(characterId),
              longCharacterFilePath(characterId, "relationships.md"),
              FIXED_NOW
            )
          }
        }
      ]
    }
  });
  const before = await f.projectStore.readCharacterProfile(
    f.created.projectDirectory,
    input
  );
  await f.projectStore.saveCharacterProfile(f.created.projectDirectory, {
    ...input,
    expectedRevision: before.revision,
    profile: {
      ...before.profile,
      settingDescription: "保留角色设定",
      appearances: [
        { id: "look_one", name: "第一套", description: "旧衣" },
        { id: "look_two", name: "第二套", description: "新衣" },
        { id: "look_empty", name: "无图形象", description: "" }
      ]
    }
  });
  const directory = join(
    f.created.projectDirectory,
    profilePath.replace("core-profile.md", "assets")
  );
  await mkdir(directory, { recursive: true });
  const assets = [
    {
      id: "a".repeat(32),
      appearanceId: "look_one",
      label: "第一套正面",
      filename: `${"a".repeat(32)}.png`
    },
    {
      id: "b".repeat(32),
      appearanceId: "look_two",
      label: "第二套正面",
      filename: `${"b".repeat(32)}.png`
    },
    {
      id: "c".repeat(32),
      appearanceId: "look_two",
      label: "第二套侧面",
      filename: `${"c".repeat(32)}.png`
    }
  ];
  for (const asset of assets)
    await writeFile(join(directory, asset.filename), png);
  const manifestPath = join(
    f.created.projectDirectory,
    profilePath.replace("core-profile.md", "assets.json")
  );
  await writeFile(manifestPath, JSON.stringify({ version: 1, assets }));
  return { ...f, input, directory, manifestPath, assets };
}

it("prepares only the selected second appearance with unchanged bytes, labels and identities", async () => {
  const f = await fixture();
  const result = await f.projectStore.prepareCharacterAppearanceDirectory(
    f.created.projectDirectory,
    { ...f.input, appearanceId: "look_two" }
  );
  expect(result.assetsDirectory).toBe(join(f.directory, "look_two"));
  expect((await readdir(result.assetsDirectory)).sort()).toEqual(
    f.assets
      .slice(1)
      .map((a) => a.filename)
      .sort()
  );
  for (const asset of f.assets.slice(1)) {
    expect(
      hash(await readFile(join(result.assetsDirectory, asset.filename)))
    ).toBe(hash(png));
    await expect(
      readFile(join(f.directory, asset.filename))
    ).rejects.toMatchObject({ code: "ENOENT" });
    expect(result.snapshot.assets.find((a) => a.id === asset.id)).toEqual({
      ...asset,
      directory: "look_two"
    });
  }
  expect(await readFile(join(f.directory, f.assets[0]!.filename))).toEqual(png);
  expect(result.snapshot.assets[0]).toEqual(f.assets[0]);
  expect(result.snapshot.profile.settingDescription).toBe("保留角色设定");
  expect(
    (
      await f.projectStore.readCharacterProfile(
        f.created.projectDirectory,
        f.input
      )
    ).assets
  ).toEqual(result.snapshot.assets);
  expect(
    await f.projectStore.prepareCharacterAppearanceDirectory(
      f.created.projectDirectory,
      { ...f.input, appearanceId: "look_two" }
    )
  ).toEqual(result);
});

it("returns an existing empty directory for a saved appearance without images", async () => {
  const f = await fixture();
  const result = await f.projectStore.prepareCharacterAppearanceDirectory(
    f.created.projectDirectory,
    { ...f.input, appearanceId: "look_empty" }
  );
  expect(await readdir(result.assetsDirectory)).toEqual([]);
  expect(result.snapshot.assets).toEqual(f.assets);
});

it("rejects an unknown appearance before touching any asset", async () => {
  const f = await fixture();
  const before = await readFile(f.manifestPath);
  await expect(
    f.projectStore.prepareCharacterAppearanceDirectory(
      f.created.projectDirectory,
      { ...f.input, appearanceId: "missing" }
    )
  ).rejects.toThrow(/形象/);
  expect(await readFile(f.manifestPath)).toEqual(before);
});

it("refuses a colliding destination without overwriting it or deleting the legacy images", async () => {
  const f = await fixture();
  const selected = f.assets[1]!;
  const next = join(f.directory, "look_two");
  await mkdir(next);
  await writeFile(join(next, selected.filename), "existing external result");
  const before = await readFile(f.manifestPath);
  await expect(
    f.projectStore.prepareCharacterAppearanceDirectory(
      f.created.projectDirectory,
      { ...f.input, appearanceId: "look_two" }
    )
  ).rejects.toThrow();
  expect(await readFile(join(next, selected.filename), "utf8")).toBe(
    "existing external result"
  );
  expect(await readFile(join(f.directory, selected.filename))).toEqual(png);
  expect(await readFile(f.manifestPath)).toEqual(before);
});

it("rejects a destination linked to another appearance", async () => {
  const f = await fixture();
  const one = join(f.directory, "look_one");
  await mkdir(one);
  await symlink(one, join(f.directory, "look_two"));
  const before = await readFile(f.manifestPath);
  await expect(
    f.projectStore.prepareCharacterAppearanceDirectory(
      f.created.projectDirectory,
      { ...f.input, appearanceId: "look_two" }
    )
  ).rejects.toThrow(/链接|目录|path/i);
  expect(await readFile(f.manifestPath)).toEqual(before);
});

it("rejects a missing legacy image before moving the remaining images or changing the manifest", async () => {
  const f = await fixture();
  await unlink(join(f.directory, f.assets[2]!.filename));
  const before = await readFile(f.manifestPath);
  await expect(
    f.projectStore.prepareCharacterAppearanceDirectory(
      f.created.projectDirectory,
      {
        ...f.input,
        appearanceId: "look_two"
      }
    )
  ).rejects.toThrow();
  expect(await readFile(f.manifestPath)).toEqual(before);
  expect(await readFile(join(f.directory, f.assets[1]!.filename))).toEqual(png);
  expect(await readdir(join(f.directory, "look_two"))).toEqual([]);
});
