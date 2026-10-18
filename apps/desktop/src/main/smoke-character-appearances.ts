import { app, clipboard, nativeImage, type BrowserWindow } from "electron";
import { lstat, mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import {
  CommandEnvelopeSchema,
  createEnvelope,
  createEmptyLongMarkdownFileReference,
  longCharacterCoreProfileFileId,
  longCharacterRelationshipsFileId,
  longCharacterFilePath,
  LongOpenBookResultSchema,
  LongCharacterProfileSnapshotSchema,
  LongGetCharacterAppearanceReferencesResultSchema,
  serializeLongCharacterProfileMarkdown
} from "@deepwrite/contracts";
import type { UtilitySupervisor } from "./supervisor";

/** Uses only the disposable Electron smoke profile and never invokes a generation model. */
export async function runCharacterAppearanceSmoke(
  supervisor: UtilitySupervisor,
  window: BrowserWindow
) {
  const profile = await realpath(app.getPath("userData"));
  if (
    process.env.DEEPWRITE_SMOKE !== "1" ||
    !profile.includes("deepwrite-electron-smoke-")
  )
    throw new Error("Appearance smoke requires a disposable profile");
  let sequence = 0;
  const core = async (type: string, payload: unknown) => {
    const result = await supervisor.requestCommand(
      "core",
      CommandEnvelopeSchema.parse(
        createEnvelope(type, payload, {
          id: `cmd_appearance_smoke_${++sequence}`
        })
      )
    );
    if (result.status === "rejected") throw new Error(result.error.message);
    return result.payload;
  };
  const created = LongOpenBookResultSchema.parse(
    await core("long.createBookAtPath", {
      parentDirectory: join(profile, "workspace"),
      input: { title: "形象提示词测试", genre: "悬疑" }
    })
  );
  const target = {
    bookId: created.book.id,
    characterId: "character_appearance_target"
  };
  const reference = {
    bookId: created.book.id,
    characterId: "character_appearance_source"
  };
  const operations = [target, reference].map((identity, order) => ({
    type: "character.create",
    character: {
      id: identity.characterId,
      name: order ? "参考角色" : "目标角色",
      group: "protagonist",
      order: order + 1,
      aliases: []
    },
    files: {
      characterId: identity.characterId,
      coreProfile: createEmptyLongMarkdownFileReference(
        longCharacterCoreProfileFileId(identity.characterId),
        longCharacterFilePath(identity.characterId, "core-profile.md"),
        created.book.workspaceIndex.updatedAt
      ),
      relationships: createEmptyLongMarkdownFileReference(
        longCharacterRelationshipsFileId(identity.characterId),
        longCharacterFilePath(identity.characterId, "relationships.md"),
        created.book.workspaceIndex.updatedAt
      )
    }
  }));
  await core("long.applyOperations", {
    bookId: target.bookId,
    batch: {
      updatedAt: created.book.workspaceIndex.updatedAt,
      operations,
      documentWrites: []
    }
  });
  for (const identity of [target, reference]) {
    const before = LongCharacterProfileSnapshotSchema.parse(
      await core("long.readCharacterProfile", identity)
    );
    await core("long.saveCharacterProfile", {
      ...identity,
      expectedRevision: before.revision,
      profile: {
        ...before.profile,
        faceDescription: "成年角色，深色眼睛，修长身材",
        settingDescription: "原有设定不能丢失",
        appearances: [
          { id: "look_original", name: "常服", description: "原有衣服" },
          { id: "look_other", name: "礼服", description: "其他形象" }
        ]
      }
    });
  }
  const png = nativeImage
    .createFromBitmap(Buffer.from([30, 90, 160, 255]), { width: 1, height: 1 })
    .toPNG();
  const sourcePaths: string[] = [];
  for (const name of ["面部上半身多角度", "全身多角度"]) {
    const path = join(profile, `${name}.png`);
    await writeFile(path, png);
    sourcePaths.push(path);
  }
  await core("long.importCharacterAssetsAtPaths", {
    ...reference,
    appearanceId: "look_original",
    sourcePaths
  });
  await core("long.importCharacterAssetsAtPaths", {
    ...target,
    appearanceId: "look_original",
    sourcePaths: [sourcePaths[0]!]
  });
  const other = join(profile, "多余形象专用图.png");
  await writeFile(other, png);
  await core("long.importCharacterAssetsAtPaths", {
    ...reference,
    appearanceId: "look_other",
    sourcePaths: [other]
  });
  const inventory = LongGetCharacterAppearanceReferencesResultSchema.parse(
    await core("long.getCharacterAppearanceReferences", target)
  );
  const source = inventory.characters.find(
    (item) => item.characterId === reference.characterId
  )!;
  const sourceSnapshot = LongCharacterProfileSnapshotSchema.parse(
    await core("long.readCharacterProfile", reference)
  );
  const sourceManifest = await readFile(source.assetsManifestPath);
  const previousClipboard = {
    text: clipboard.readText(),
    html: clipboard.readHTML(),
    rtf: clipboard.readRTF(),
    image: clipboard.readImage()
  };
  const moduleUrl = process.env.DEEPWRITE_SMOKE_CHAPTER_IMAGE_MODULE;
  if (!moduleUrl) throw new Error("Appearance renderer smoke module missing");
  try {
    window.show();
    window.focus();
    window.webContents.focus();
    const checked = (await window.webContents.executeJavaScript(
      `(async () => { const smoke = await import(${JSON.stringify(moduleUrl)}); return await smoke.runCharacterAppearanceRendererSmoke(${JSON.stringify(target)}); })()`
    )) as { appearanceId: string; prompt: string; cancelled: boolean };
    if (clipboard.readText() !== checked.prompt)
      throw new Error("Appearance prompt did not reach the native clipboard");
    const saved = LongCharacterProfileSnapshotSchema.parse(
      await core("long.readCharacterProfile", target)
    );
    const look = saved.profile.appearances.find(
      (item) => item.id === checked.appearanceId
    );
    if (
      !look ||
      saved.profile.appearances.length !== 3 ||
      !checked.prompt.includes(inventory.target.coreProfilePath) ||
      !checked.prompt.includes(inventory.target.assetsManifestPath)
    )
      throw new Error("Appearance creation or exact output paths failed");
    // Simulate the external Agent following the generated existing-file protocol.
    look.description =
      "发型描述：外部生成的发型描述。\n服装描述：外部生成的服装描述。";
    const id = randomUUID().replaceAll("-", "");
    const outputDirectory = join(
      inventory.target.assetsDirectory,
      checked.appearanceId
    );
    await mkdir(outputDirectory, { recursive: true });
    await writeFile(join(outputDirectory, `${id}.png`), png);
    await writeFile(
      inventory.target.assetsManifestPath,
      JSON.stringify({
        version: 1,
        assets: [
          ...saved.assets,
          {
            id,
            appearanceId: checked.appearanceId,
            directory: checked.appearanceId,
            label: "新图标签",
            filename: `${id}.png`
          }
        ]
      })
    );
    await writeFile(
      inventory.target.coreProfilePath,
      serializeLongCharacterProfileMarkdown(saved.profile)
    );
    const final = (await window.webContents.executeJavaScript(
      `(async () => { const smoke = await import(${JSON.stringify(moduleUrl)}); return await smoke.finishCharacterAppearanceRendererSmoke(); })()`
    )) as {
      refreshed: boolean;
      rendered: boolean;
      copiedAssetsDirectory: string;
    };
    if (
      final.copiedAssetsDirectory !== outputDirectory ||
      clipboard.readText() !== outputDirectory
    )
      throw new Error(
        "Asset directory path did not reach the native clipboard"
      );
    const reopened = LongCharacterProfileSnapshotSchema.parse(
      await core("long.readCharacterProfile", target)
    );
    if (
      reopened.profile.settingDescription !== "原有设定不能丢失" ||
      reopened.profile.appearances[0]?.description !== "原有衣服" ||
      reopened.assets.length !== 2 ||
      reopened.assets[0]?.id !== saved.assets[0]?.id
    )
      throw new Error("External result overwrote unrelated profile data");
    if (
      !sourceManifest.equals(await readFile(source.assetsManifestPath)) ||
      JSON.stringify(sourceSnapshot) !==
        JSON.stringify(
          LongCharacterProfileSnapshotSchema.parse(
            await core("long.readCharacterProfile", reference)
          )
        )
    )
      throw new Error("Source appearance was modified");
    const deletion = (await window.webContents.executeJavaScript(
      `import(${JSON.stringify(moduleUrl)}).then(smoke => smoke.runCharacterAppearanceDeletionSmoke())`
    )) as {
      deleted: boolean;
      deleteCancelled: boolean;
      lockedDeletionBlocked: boolean;
      retainedOtherAppearance: boolean;
    };
    for (const path of [
      inventory.target.assetsManifestPath,
      inventory.target.assetsDirectory
    ]) {
      try {
        await lstat(path);
        throw new Error(
          "Permanent appearance deletion left a file or directory"
        );
      } catch (error) {
        if (!(
          error instanceof Error &&
          "code" in error &&
          error.code === "ENOENT"
        ))
          throw error;
      }
    }
    const deleted = LongCharacterProfileSnapshotSchema.parse(
      await core("long.readCharacterProfile", target)
    );
    if (deleted.profile.appearances.length || deleted.assets.length)
      throw new Error("Deleted appearance returned after reopening");
    if (!sourceManifest.equals(await readFile(source.assetsManifestPath)))
      throw new Error("Deletion changed source assets");
    return {
      status: "ok",
      created: true,
      copied: true,
      cancelled: checked.cancelled,
      referenceIsolated: true,
      persisted: true,
      ...deletion,
      ...final
    };
  } finally {
    await window.webContents
      .executeJavaScript(
        `import(${JSON.stringify(moduleUrl)}).then((smoke) => smoke.cleanupCharacterAppearanceSmoke())`
      )
      .catch(() => undefined);
    clipboard.write({
      text: previousClipboard.text,
      html: previousClipboard.html,
      rtf: previousClipboard.rtf,
      ...(!previousClipboard.image.isEmpty()
        ? { image: previousClipboard.image }
        : {})
    });
  }
}
