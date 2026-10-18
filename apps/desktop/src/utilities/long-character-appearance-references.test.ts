import { LongWorkspaceService } from "./long-workspace-service";
import { dirname } from "node:path";
import { getCharacterAppearanceReferences } from "./long-character-appearance-references";
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
  symlink,
  unlink
} from "./long-project-store.test-support";

const png = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489000000000049454e44ae426082",
  "hex"
);

async function fixture() {
  const f = await createFixture("appearance_references");
  for (const [i, name] of ["目标角色", "参考角色", "无图角色"].entries()) {
    const id = `character_ref_${i}`;
    await f.projectStore.applyWorkspaceOperations(f.created.projectDirectory, {
      batch: {
        updatedAt: FIXED_NOW,
        operations: [
          {
            type: "character.create",
            character: {
              id,
              name,
              group: "protagonist",
              order: i + 1,
              aliases: []
            },
            files: {
              characterId: id,
              coreProfile: createEmptyLongMarkdownFileReference(
                longCharacterCoreProfileFileId(id),
                longCharacterFilePath(id, "core-profile.md"),
                FIXED_NOW
              ),
              relationships: createEmptyLongMarkdownFileReference(
                longCharacterRelationshipsFileId(id),
                longCharacterFilePath(id, "relationships.md"),
                FIXED_NOW
              )
            }
          }
        ],
        documentWrites: []
      }
    });
    const input = { bookId: f.created.book.id, characterId: id };
    const before = await f.projectStore.readCharacterProfile(
      f.created.projectDirectory,
      input
    );
    await f.projectStore.saveCharacterProfile(f.created.projectDirectory, {
      ...input,
      expectedRevision: before.revision,
      profile: {
        ...before.profile,
        faceDescription: "已保存的脸部身材",
        appearances: [
          { id: "look_one", name: "常服", description: "" },
          { id: "look_two", name: "礼服", description: "" },
          { id: "look_empty", name: "无图形象", description: "" }
        ]
      }
    });
    if (i === 1) {
      for (const appearanceId of ["look_one", "look_two"]) {
        const source = join(
          dirname(f.created.projectDirectory),
          `${appearanceId}.png`
        );
        await writeFile(source, png);
        await f.projectStore.importCharacterAssetsAtPaths(
          f.created.projectDirectory,
          {
            ...input,
            appearanceId,
            sourcePaths: [source]
          }
        );
      }
    }
  }
  const service = new LongWorkspaceService({
    userDataPath: join(dirname(f.created.projectDirectory), "user"),
    now: () => FIXED_NOW
  });
  await service.catalog.openAtPath(f.created.projectDirectory);
  return {
    ...f,
    service,
    input: { bookId: f.created.book.id, characterId: "character_ref_0" }
  };
}

it("returns only image-backed reference appearances and exact registered output paths without writes", async () => {
  const f = await fixture();
  const indexBefore = await readFile(
    join(f.created.projectDirectory, "long/index.json")
  );
  const result = await getCharacterAppearanceReferences(f.service, f.input);
  expect(result.characters.map((x) => x.name)).toEqual(["参考角色"]);
  expect(result.characters[0]?.appearances.map((x) => x.name)).toEqual([
    "常服",
    "礼服"
  ]);
  const references = result.characters[0]!;
  expect(references.appearances[0]?.assets).toHaveLength(1);
  expect(references.appearances[0]?.assetsDirectory).toBe(
    join(references.assetsDirectory, "look_one")
  );
  expect(references.appearances[1]?.assetsDirectory).toBe(
    join(references.assetsDirectory, "look_two")
  );
  expect(references.appearances[1]?.assets[0]?.label).toBe("look_two");
  const core = join(
    f.created.projectDirectory,
    longCharacterFilePath(f.input.characterId, "core-profile.md")
  );
  expect(result.target.coreProfilePath).toBe(core);
  expect(result.target.assetsManifestPath).toBe(
    core.replace("core-profile.md", "assets.json")
  );
  expect(
    references.assetsDirectory.startsWith(f.created.projectDirectory)
  ).toBe(true);
  expect(
    await readFile(join(f.created.projectDirectory, "long/index.json"))
  ).toEqual(indexBefore);
});

it("rejects unknown target roles or books instead of returning arbitrary paths", async () => {
  const f = await fixture();
  await expect(
    getCharacterAppearanceReferences(f.service, {
      ...f.input,
      characterId: "character_missing"
    })
  ).rejects.toThrow(/角色|人物/);
  await expect(
    getCharacterAppearanceReferences(f.service, {
      ...f.input,
      bookId: "longbook_missing"
    })
  ).rejects.toThrow();
});

it("rejects a target image directory linked into a different character", async () => {
  const f = await fixture();
  const target = join(
    f.created.projectDirectory,
    longCharacterFilePath(f.input.characterId, "core-profile.md")
  );
  const reference = join(
    f.created.projectDirectory,
    longCharacterFilePath("character_ref_1", "core-profile.md")
  );
  await symlink(
    join(dirname(reference), "assets"),
    join(dirname(target), "assets")
  );
  await expect(
    getCharacterAppearanceReferences(f.service, f.input)
  ).rejects.toThrow(/链接|目录/);
});

it("rejects a reference image file linked outside its managed directory", async () => {
  const f = await fixture();
  const reference = await f.projectStore.readCharacterProfile(
    f.created.projectDirectory,
    { ...f.input, characterId: "character_ref_1" }
  );
  const path = join(
    f.created.projectDirectory,
    longCharacterFilePath("character_ref_1", "core-profile.md").replace(
      "core-profile.md",
      `assets/${reference.assets[0]!.directory}/${reference.assets[0]!.filename}`
    )
  );
  await unlink(path);
  await symlink(
    join(dirname(f.created.projectDirectory), "look_one.png"),
    path
  );
  await expect(
    getCharacterAppearanceReferences(f.service, f.input)
  ).rejects.toThrow(/链接|图片/);
});
