import { dirname } from "node:path";
import {
  LongWorkspaceIndexSnapshotSchema,
  serializeLongCharacterProfileMarkdown,
  type LongWorkspaceOperationBatch
} from "@deepwrite/contracts";
import {
  FIXED_NOW,
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
  rm
} from "./long-project-store.test-support";
import { stageRecovery } from "./project-recovery.test-support";

const png = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000b49444154789c636000020000050001a5f645400000000049454e44ae426082",
  "hex"
);
async function fixture(suffix: string) {
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
  const character = {
    id: characterId,
    name: "林岚",
    group: "protagonist" as const,
    order: 1,
    aliases: ["旧友"]
  };
  await f.projectStore.applyWorkspaceOperations(f.created.projectDirectory, {
    batch: {
      updatedAt: FIXED_NOW,
      operations: [
        {
          type: "character.create",
          character,
          files: { characterId, coreProfile, relationships }
        }
      ],
      documentWrites: [
        {
          proposalId: "proposal_fixture",
          fileId: coreProfile.id,
          mode: "create",
          updatedAt: FIXED_NOW,
          reason: "临时角色",
          content: "原始设定"
        }
      ]
    }
  });
  await writeFile(
    join(f.created.projectDirectory, coreProfile.path),
    "\uFEFF原始设定\r\n\r\n![原图](old.png)\r\n",
    "utf8"
  );
  const input = { bookId: f.created.book.id, characterId };
  const before = await f.projectStore.readCharacterProfile(
    f.created.projectDirectory,
    input
  );
  const saved = await f.projectStore.saveCharacterProfile(
    f.created.projectDirectory,
    {
      ...input,
      expectedRevision: before.revision,
      profile: {
        ...before.profile,
        appearances: [
          { id: "appearance_original", name: "雨夜", description: "黑衣" }
        ]
      }
    }
  );
  return { ...f, input, saved, character, coreProfile, relationships };
}
const proposal = (fileId: string, content: string) => ({
  proposalId: "proposal_character_edit",
  fileId,
  content,
  mode: "replace" as const,
  updatedAt: FIXED_NOW,
  reason: "审批修改"
});

describe("character Core review regressions", () => {
  it("persists metadata aliases into structured keywords and preserves them after a face-only save", async () => {
    const f = await fixture("alias_sync");
    const aliases = ["新别名", "旅人"];
    await f.projectStore.applyWorkspaceOperations(f.created.projectDirectory, {
      batch: {
        updatedAt: FIXED_NOW,
        operations: [
          {
            type: "character.update",
            id: f.input.characterId,
            patch: { aliases }
          }
        ],
        documentWrites: []
      }
    });
    const latest = await f.projectStore.readCharacterProfile(
      f.created.projectDirectory,
      f.input
    );
    expect(latest.profile.keywords).toBe("新别名、旅人");
    expect(latest.profile.settingDescription).toBe(
      f.saved.profile.settingDescription
    );
    await f.projectStore.saveCharacterProfile(f.created.projectDirectory, {
      ...f.input,
      expectedRevision: latest.revision,
      profile: { ...latest.profile, faceDescription: "新的脸部描述" }
    });
    expect(
      (await f.projectStore.openBook(f.created.projectDirectory)).book
        .workspaceIndex.characters[0]?.aliases
    ).toEqual(aliases);
  });

  it("rejects conflicting explicit profile keywords and metadata aliases before any files change", async () => {
    const f = await fixture("alias_conflict");
    const path = join(f.created.projectDirectory, f.coreProfile.path);
    const before = await readFile(path);
    await expect(
      f.projectStore.applyWorkspaceOperations(f.created.projectDirectory, {
        batch: {
          updatedAt: FIXED_NOW,
          operations: [
            {
              type: "character.update",
              id: f.input.characterId,
              patch: { aliases: ["元数据别名"] }
            }
          ],
          documentWrites: [
            proposal(
              f.coreProfile.id,
              serializeLongCharacterProfileMarkdown({
                ...f.saved.profile,
                keywords: "文档别名"
              })
            )
          ]
        }
      })
    ).rejects.toThrow(/别名|关键词/);
    expect(await readFile(path)).toEqual(before);
    expect(
      (await f.projectStore.openBook(f.created.projectDirectory)).book
        .workspaceIndex.characters[0]?.aliases
    ).toEqual(["旧友"]);
  });

  it("rejects metadata aliases containing keyword separators instead of silently splitting them", async () => {
    const f = await fixture("alias_separator");
    await expect(
      f.projectStore.applyWorkspaceOperations(f.created.projectDirectory, {
        batch: {
          updatedAt: FIXED_NOW,
          operations: [
            {
              type: "character.update",
              id: f.input.characterId,
              patch: { aliases: ["别名，含分隔符"] }
            }
          ],
          documentWrites: []
        }
      })
    ).rejects.toThrow(/别名|关键词/);
    expect(
      (
        await f.projectStore.readCharacterProfile(
          f.created.projectDirectory,
          f.input
        )
      ).profile.keywords
    ).toBe("旧友");
  });

  it("accepts matching explicit profile keywords and metadata aliases", async () => {
    const f = await fixture("alias_match");
    await f.projectStore.applyWorkspaceOperations(f.created.projectDirectory, {
      batch: {
        updatedAt: FIXED_NOW,
        operations: [
          {
            type: "character.update",
            id: f.input.characterId,
            patch: { aliases: ["一致别名"] }
          }
        ],
        documentWrites: [
          proposal(
            f.coreProfile.id,
            serializeLongCharacterProfileMarkdown({
              ...f.saved.profile,
              keywords: "一致别名",
              settingDescription: "新设定"
            })
          )
        ]
      }
    });
    expect(
      (
        await f.projectStore.readCharacterProfile(
          f.created.projectDirectory,
          f.input
        )
      ).profile
    ).toMatchObject({ keywords: "一致别名", settingDescription: "新设定" });
  });

  it.each(["direct", "proposal"])(
    "protects empty existing appearance identities in a %s write",
    async (mode) => {
      const f = await fixture(`appearance_guard_${mode}`);
      const content = serializeLongCharacterProfileMarkdown({
        ...f.saved.profile,
        appearances: [
          { id: "appearance_replacement", name: "替换", description: "白衣" }
        ]
      });
      const operation =
        mode === "direct"
          ? f.projectStore.writeDocument(f.created.projectDirectory, {
              fileId: f.coreProfile.id,
              content
            })
          : f.projectStore.applyWorkspaceOperations(
              f.created.projectDirectory,
              {
                batch: {
                  updatedAt: FIXED_NOW,
                  operations: [],
                  documentWrites: [proposal(f.coreProfile.id, content)]
                }
              }
            );
      await expect(operation).rejects.toThrow(/形象|标识/);
      expect(
        (
          await f.projectStore.readCharacterProfile(
            f.created.projectDirectory,
            f.input
          )
        ).profile.appearances[0]?.id
      ).toBe("appearance_original");
    }
  );

  it("validates newly created structured core-profile proposals against the next index", async () => {
    const f = await createFixture("profile_create_guard");
    const id = "character_new_structured";
    const coreProfile = createEmptyLongMarkdownFileReference(
      longCharacterCoreProfileFileId(id),
      longCharacterFilePath(id, "core-profile.md"),
      FIXED_NOW
    );
    const relationships = createEmptyLongMarkdownFileReference(
      longCharacterRelationshipsFileId(id),
      longCharacterFilePath(id, "relationships.md"),
      FIXED_NOW
    );
    const batch: LongWorkspaceOperationBatch = {
      updatedAt: FIXED_NOW,
      operations: [
        {
          type: "character.create",
          character: {
            id,
            name: "新角色",
            group: "protagonist",
            order: 1,
            aliases: []
          },
          files: { characterId: id, coreProfile, relationships }
        }
      ],
      documentWrites: [
        {
          ...proposal(
            coreProfile.id,
            "<!-- deepwrite:character-profile:v1 -->\n损坏分区"
          ),
          mode: "create"
        }
      ]
    };
    await expect(
      f.projectStore.applyWorkspaceOperations(f.created.projectDirectory, {
        batch
      })
    ).rejects.toThrow(/结构|分区/);
    expect(
      (await f.projectStore.openBook(f.created.projectDirectory)).book
        .workspaceIndex.characters
    ).toEqual([]);
    const structuredWrite = {
      ...batch.documentWrites[0]!,
      content: serializeLongCharacterProfileMarkdown({
        name: "新角色",
        keywords: "新别名",
        faceDescription: "",
        settingDescription: "设定",
        appearances: []
      })
    };
    await expect(
      f.projectStore.applyWorkspaceOperations(f.created.projectDirectory, {
        batch: {
          ...batch,
          operations: [
            ...batch.operations,
            { type: "character.update", id, patch: { aliases: ["冲突的别名"] } }
          ],
          documentWrites: [structuredWrite]
        }
      })
    ).rejects.toThrow(/别名|关键词/);
    await f.projectStore.applyWorkspaceOperations(f.created.projectDirectory, {
      batch: { ...batch, documentWrites: [structuredWrite] }
    });
    expect(
      (await f.projectStore.openBook(f.created.projectDirectory)).book
        .workspaceIndex.characters[0]?.aliases
    ).toEqual(["新别名"]);
  });

  it.each([false, true])(
    "restores retained character assets and legacy backup bytes after an interrupted deletion, applied: %s",
    async (applied) => {
      const f = await fixture(`asset_recovery_${applied}`);
      const sourcePath = join(
        dirname(f.created.projectDirectory),
        "original.png"
      );
      await writeFile(sourcePath, png);
      const imported = await f.projectStore.importCharacterAssetsAtPaths(
        f.created.projectDirectory,
        {
          ...f.input,
          appearanceId: "appearance_original",
          sourcePaths: [sourcePath]
        }
      );
      const directory = dirname(f.coreProfile.path);
      const paths = [
        f.coreProfile.path,
        f.relationships.path,
        `${directory}/assets.json`,
        `${directory}/assets/${imported.assets[0]!.directory}/${imported.assets[0]!.filename}`,
        `${directory}/core-profile.legacy.md`
      ];
      const originals = await Promise.all(
        paths.map((path) => readFile(join(f.created.projectDirectory, path)))
      );
      const originalIndex = await readFile(
        join(f.created.projectDirectory, "long/index.json"),
        "utf8"
      );
      const index = LongWorkspaceIndexSnapshotSchema.parse(
        JSON.parse(originalIndex)
      );
      index.characters = [];
      index.characterFiles = [];
      const { journalPath } = await stageRecovery(
        f.created.projectDirectory,
        [
          { path: "long/index.json", content: JSON.stringify(index) },
          ...paths.map((path) => ({ path, content: null }))
        ],
        "committing"
      );
      if (applied)
        await Promise.all(
          paths.map((path) => rm(join(f.created.projectDirectory, path)))
        );
      await writeFile(
        join(f.created.projectDirectory, "long/index.json"),
        `${originalIndex}\n `
      );
      await f.projectStore.resolveConflicts(
        f.created.projectDirectory,
        f.input.bookId
      );
      for (const [i, path] of paths.entries())
        expect(await readFile(join(f.created.projectDirectory, path))).toEqual(
          originals[i]
        );
      expect(
        (
          await f.projectStore.readCharacterProfile(
            f.created.projectDirectory,
            f.input
          )
        ).assets
      ).toEqual(imported.assets);
      await expect(readFile(journalPath)).rejects.toMatchObject({
        code: "ENOENT"
      });
    }
  );
});
