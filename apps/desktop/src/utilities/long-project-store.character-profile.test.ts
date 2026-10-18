import { createHash } from "node:crypto";
import { dirname } from "node:path";
import {
  FIXED_NOW,
  LongProjectStore,
  createFixture,
  createEmptyLongMarkdownFileReference,
  describe,
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

async function fixture(
  suffix: string,
  content = "原始设定\n\n![旧图](legacy.png)\n"
) {
  const result = await createFixture(suffix);
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
  await result.projectStore.applyWorkspaceOperations(
    result.created.projectDirectory,
    {
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
              aliases: ["旧友"]
            },
            files: { characterId, coreProfile, relationships }
          }
        ],
        documentWrites: [
          {
            proposalId: "proposal_fixture",
            fileId: coreProfile.id,
            content,
            mode: "create",
            updatedAt: FIXED_NOW,
            reason: "临时角色"
          }
        ]
      }
    }
  );
  return {
    ...result,
    parent: dirname(result.created.projectDirectory),
    characterId,
    coreProfile,
    input: { bookId: result.created.book.id, characterId }
  };
}

async function savedFixture(suffix: string) {
  const f = await fixture(suffix);
  const before = await f.projectStore.readCharacterProfile(
    f.created.projectDirectory,
    f.input
  );
  const saved = await f.projectStore.saveCharacterProfile(
    f.created.projectDirectory,
    {
      ...f.input,
      profile: {
        ...before.profile,
        appearances: [
          { id: "appearance_rain", name: "雨夜", description: "黑衣" }
        ]
      },
      expectedRevision: before.revision
    }
  );
  return { ...f, saved };
}

const png = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000b49444154789c636000020000050001a5f645400000000049454e44ae426082",
  "hex"
);

describe("LongProjectStore character profiles and assets", () => {
  it("rejects an oversized structured profile before changing canonical text", async () => {
    const f = await fixture("profile_size");
    const before = await f.projectStore.readCharacterProfile(
      f.created.projectDirectory,
      f.input
    );
    const path = join(f.created.projectDirectory, f.coreProfile.path);
    const original = await readFile(path);
    await expect(
      f.projectStore.saveCharacterProfile(f.created.projectDirectory, {
        ...f.input,
        expectedRevision: before.revision,
        profile: {
          ...before.profile,
          appearances: Array.from({ length: 34 }, (_, i) => ({
            id: `appearance_${i}`,
            name: `形象 ${i}`,
            description: "a".repeat(1_000_000)
          }))
        }
      })
    ).rejects.toThrow(/32|大小/);
    expect(
      createHash("sha256")
        .update(await readFile(path))
        .digest("hex")
    ).toBe(createHash("sha256").update(original).digest("hex"));
  });

  it("reads legacy text without writes, backs it up on first save, persists fields and aliases", async () => {
    const f = await fixture("profile_migration");
    const path = join(f.created.projectDirectory, f.coreProfile.path);
    const original = await readFile(path, "utf8");
    const before = await f.projectStore.readCharacterProfile(
      f.created.projectDirectory,
      f.input
    );
    expect(await readFile(path, "utf8")).toBe(original);
    const saved = await f.projectStore.saveCharacterProfile(
      f.created.projectDirectory,
      {
        ...f.input,
        expectedRevision: before.revision,
        profile: {
          ...before.profile,
          name: "新名字",
          keywords: "侦探，旅人\n旧友",
          faceDescription: "深色眼睛"
        }
      }
    );
    expect(saved.profile.settingDescription).toBe(original);
    expect(
      await readFile(
        join(
          f.created.projectDirectory,
          f.coreProfile.path.replace(
            "core-profile.md",
            "core-profile.legacy.md"
          )
        ),
        "utf8"
      )
    ).toBe(original);
    const reopened = new LongProjectStore({ now: () => FIXED_NOW });
    expect(
      await reopened.readCharacterProfile(f.created.projectDirectory, f.input)
    ).toEqual(saved);
    const book = await reopened.openBook(f.created.projectDirectory);
    expect(book.book.workspaceIndex.characters[0]).toMatchObject({
      name: "新名字",
      aliases: ["侦探", "旅人", "旧友"]
    });
  });

  it("rejects a stale profile save after an Agent document edit", async () => {
    const f = await savedFixture("profile_conflict");
    const text = await readFile(
      join(f.created.projectDirectory, f.coreProfile.path),
      "utf8"
    );
    await f.projectStore.writeDocument(f.created.projectDirectory, {
      fileId: f.coreProfile.id,
      content: text.replace("黑衣", "白衣")
    });
    await expect(
      f.projectStore.saveCharacterProfile(f.created.projectDirectory, {
        ...f.input,
        profile: f.saved.profile,
        expectedRevision: f.saved.revision
      })
    ).rejects.toThrow(/更新|冲突/);
    expect(
      (
        await f.projectStore.readCharacterProfile(
          f.created.projectDirectory,
          f.input
        )
      ).profile.appearances[0]?.description
    ).toBe("白衣");
  });

  it("imports original bytes, persists labels, deletes assets and copies them with a project duplicate", async () => {
    const f = await savedFixture("asset_roundtrip");
    const sourcePath = join(f.parent, "雨夜.png");
    await writeFile(sourcePath, png);
    const imported = await f.projectStore.importCharacterAssetsAtPaths(
      f.created.projectDirectory,
      { ...f.input, appearanceId: "appearance_rain", sourcePaths: [sourcePath] }
    );
    const asset = imported.assets[0]!;
    expect(asset.label).toBe("雨夜");
    expect(asset.filename).toMatch(/^[a-f0-9]{32}\.png$/);
    const assetPath = join(
      f.created.projectDirectory,
      f.coreProfile.path.replace(
        "core-profile.md",
        `assets/${asset.directory}/${asset.filename}`
      )
    );
    expect(await readFile(assetPath)).toEqual(png);
    const renamed = await f.projectStore.renameCharacterAsset(
      f.created.projectDirectory,
      { ...f.input, assetId: asset.id, label: "新标签" }
    );
    expect(renamed.assets[0]?.label).toBe("新标签");
    expect(
      await readFile(
        join(f.created.projectDirectory, f.coreProfile.path),
        "utf8"
      )
    ).not.toContain("新标签");
    const duplicate = await f.projectStore.duplicateBook(
      f.parent,
      f.created.projectDirectory,
      "副本"
    );
    const copy = await f.projectStore.readCharacterProfile(
      duplicate.projectDirectory,
      { ...f.input, bookId: duplicate.book.id }
    );
    expect(copy.assets).toEqual(renamed.assets);
    expect(
      await readFile(
        assetPath.replace(
          f.created.projectDirectory,
          duplicate.projectDirectory
        )
      )
    ).toEqual(png);
    const deleted = await f.projectStore.deleteCharacterAsset(
      f.created.projectDirectory,
      { ...f.input, assetId: asset.id }
    );
    expect(deleted.assets).toEqual([]);
    await expect(readFile(assetPath)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rejects broken generic writes and appearance removal while assets reference it", async () => {
    const f = await savedFixture("asset_guard");
    const sourcePath = join(f.parent, "rain.png");
    await writeFile(sourcePath, png);
    await f.projectStore.importCharacterAssetsAtPaths(
      f.created.projectDirectory,
      { ...f.input, appearanceId: "appearance_rain", sourcePaths: [sourcePath] }
    );
    await expect(
      f.projectStore.writeDocument(f.created.projectDirectory, {
        fileId: f.coreProfile.id,
        content: "覆盖原文"
      })
    ).rejects.toThrow(/结构|分区/);
    await expect(
      f.projectStore.applyWorkspaceOperations(f.created.projectDirectory, {
        batch: {
          updatedAt: FIXED_NOW,
          operations: [],
          documentWrites: [
            {
              proposalId: "proposal_broken",
              fileId: f.coreProfile.id,
              content: "覆盖原文",
              mode: "replace",
              updatedAt: FIXED_NOW,
              reason: "测试"
            }
          ]
        }
      })
    ).rejects.toThrow(/结构|分区/);
    const latest = await f.projectStore.readCharacterProfile(
      f.created.projectDirectory,
      f.input
    );
    await expect(
      f.projectStore.saveCharacterProfile(f.created.projectDirectory, {
        ...f.input,
        profile: { ...latest.profile, appearances: [] },
        expectedRevision: latest.revision
      })
    ).rejects.toThrow(/图片|形象/);
  });

  it("rejects disguised images and symlink sources without partial imports", async () => {
    const f = await savedFixture("asset_safety");
    const good = join(f.parent, "good.png");
    const bad = join(f.parent, "bad.png");
    const link = join(f.parent, "link.png");
    await writeFile(good, png);
    await writeFile(bad, "not an image");
    await symlink(good, link);
    for (const sourcePaths of [[good, bad], [link]]) {
      await expect(
        f.projectStore.importCharacterAssetsAtPaths(
          f.created.projectDirectory,
          { ...f.input, appearanceId: "appearance_rain", sourcePaths }
        )
      ).rejects.toThrow(/图片|格式|链接/);
    }
    expect(
      (
        await f.projectStore.readCharacterProfile(
          f.created.projectDirectory,
          f.input
        )
      ).assets
    ).toEqual([]);
  });

  it("removes the manifest and binaries when deleting a character", async () => {
    const f = await savedFixture("asset_character_delete");
    const sourcePath = join(f.parent, "rain.png");
    await writeFile(sourcePath, png);
    const imported = await f.projectStore.importCharacterAssetsAtPaths(
      f.created.projectDirectory,
      { ...f.input, appearanceId: "appearance_rain", sourcePaths: [sourcePath] }
    );
    const assetPath = join(
      f.created.projectDirectory,
      f.coreProfile.path.replace(
        "core-profile.md",
        `assets/${imported.assets[0]!.directory}/${imported.assets[0]!.filename}`
      )
    );
    const batch = {
      updatedAt: FIXED_NOW,
      operations: [{ type: "character.delete" as const, id: f.characterId }],
      documentWrites: []
    };
    const preview = await f.projectStore.previewWorkspaceOperations(
      f.created.projectDirectory,
      batch
    );
    await f.projectStore.applyWorkspaceOperations(f.created.projectDirectory, {
      batch: { ...batch, expectedImpact: preview.confirmation }
    });
    await expect(readFile(assetPath)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(
      readFile(
        join(
          f.created.projectDirectory,
          f.coreProfile.path.replace("core-profile.md", "assets.json")
        )
      )
    ).rejects.toMatchObject({ code: "ENOENT" });
  });
});
