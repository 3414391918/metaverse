import { cp, mkdtemp, mkdir, readFile, realpath, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const project = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = await mkdtemp(join(tmpdir(), "virtual-world-standalone-tools-"));
try {
  await cp(join(project, "apps/desktop/out/toolkit"), join(root, "tools"), {
    recursive: true
  });
  await mkdir(join(root, "books"), { recursive: true });
  // Each editable CLI runtime must remain usable when the other runtime is updated.
  const isolatedContext = join(root, "context-only", "tools", "creation");
  await mkdir(join(isolatedContext, "runtime"), { recursive: true });
  await cp(
    join(root, "tools", "creation", "context-cli.mjs"),
    join(isolatedContext, "context-cli.mjs")
  );
  await cp(
    join(root, "tools", "creation", "runtime", "context-engine.mjs"),
    join(isolatedContext, "runtime", "context-engine.mjs")
  );
  const isolatedList = JSON.parse(
    execFileSync(
      process.execPath,
      [join(isolatedContext, "context-cli.mjs"), "--input", "-"],
      { input: JSON.stringify({ action: "list" }), encoding: "utf8" }
    )
  );
  assert.deepEqual(isolatedList.libraries, []);
  const call = (tool, request, book) =>
    JSON.parse(
      execFileSync(
        process.execPath,
        [
          join(
            root,
            "tools",
            "creation",
            tool === "context" ? "context-cli.mjs" : "cli.mjs"
          ),
          "--input",
          "-",
          ...(book ? ["--book", book] : [])
        ],
        { input: JSON.stringify(request), encoding: "utf8" }
      )
    );
  const created = call("creation", {
    action: "create",
    input: {
      parentDirectory: join(root, "books"),
      title: "工具独立验收",
      genre: "玄幻"
    }
  });
  const book = created.projectDirectory;
  const index = call("creation", { action: "index" }, book);
  const fileId = index.workspaceIndex.bookLine.id;
  const before = call("creation", { action: "read", input: { fileId } }, book);
  call(
    "creation",
    {
      action: "write",
      input: {
        fileId,
        content: "# 故事线\n\n独立工具写入。\n",
        expectedSha256: before.sha256
      }
    },
    book
  );
  assert.match(
    call("creation", { action: "read", input: { fileId } }, book).content,
    /独立工具写入/
  );
  assert.ok(
    call("creation", { action: "schema", input: { name: "apply" } }).schema
      .properties.operations
  );
  const chapter = index.workspaceIndex.chapters[0];
  assert.ok(chapter, "新建小说应包含可供插图的首章");
  const chapterBefore = call(
    "creation",
    { action: "read", input: { fileId: chapter.body.id } },
    book
  );
  call(
    "creation",
    {
      action: "write",
      input: {
        fileId: chapter.body.id,
        content: "# 第一章\n\n欲仙楼的石台旁，慕星离停下脚步。\n",
        expectedSha256: chapterBefore.sha256
      }
    },
    book
  );
  const chapterReady = call(
    "creation",
    { action: "read", input: { fileId: chapter.body.id } },
    book
  );
  const sourceImage = join(root, "scene.png");
  await cp(
    join(project, "apps/desktop/src/renderer/public/app-icon.png"),
    sourceImage
  );
  const added = call(
    "creation",
    {
      action: "illustration.add",
      input: {
        chapterCardId: chapter.chapterCardId,
        imagePath: sourceImage,
        expectedSha256: chapterReady.sha256,
        offset: chapterReady.content.length
      }
    },
    book
  );
  assert.equal(added.filename, "001.png");
  assert.equal(added.reference, "![](images/001.png)");
  assert.match(
    call(
      "creation",
      { action: "read", input: { fileId: chapter.body.id } },
      book
    ).content,
    /!\[\]\(images\/001\.png\)/
  );
  assert.deepEqual(
    await readFile(added.imagePath),
    await readFile(sourceImage)
  );
  const references = call(
    "creation",
    {
      action: "illustration.references",
      input: { chapterCardId: chapter.chapterCardId }
    },
    book
  ).references;
  assert.equal(references.length, 1);
  assert.equal(references[0].path, added.imagePath);
  assert.equal(references[0].available, true);
  assert.match(references[0].nearbyText, /欲仙楼/);
  assert.throws(
    () =>
      call(
        "creation",
        {
          action: "illustration.add",
          input: {
            chapterCardId: chapter.chapterCardId,
            imagePath: sourceImage,
            expectedSha256: chapterReady.sha256,
            offset: chapterReady.content.length
          }
        },
        book
      ),
    /章节正文已更新/
  );
  const beforeDelete = call(
    "creation",
    { action: "read", input: { fileId: chapter.body.id } },
    book
  );
  const deleted = call(
    "creation",
    {
      action: "illustration.delete",
      input: {
        chapterCardId: chapter.chapterCardId,
        filename: added.filename,
        expectedSha256: beforeDelete.sha256,
        offset: beforeDelete.content.indexOf(added.reference)
      }
    },
    book
  );
  assert.equal(deleted.fileDeleted, true);
  assert.doesNotMatch(
    call(
      "creation",
      { action: "read", input: { fileId: chapter.body.id } },
      book
    ).content,
    /!\[\]\(images\/001\.png\)/
  );
  await assert.rejects(readFile(added.imagePath), { code: "ENOENT" });
  const manyReferencesBefore = call(
    "creation",
    { action: "read", input: { fileId: chapter.body.id } },
    book
  );
  const manyReferences = Array.from({ length: 20 }, (_, index) => {
    const filename = `${String(index + 100).padStart(3, "0")}.png`;
    return `${index === 17 ? "夜晚洞穴，火光照亮石壁。" : `第${index + 1}个场景。`}\n![](images/${filename})`;
  }).join("\n\n");
  call(
    "creation",
    {
      action: "write",
      input: {
        fileId: chapter.body.id,
        content: `${manyReferencesBefore.content}\n\n${manyReferences}\n`,
        expectedSha256: manyReferencesBefore.sha256
      }
    },
    book
  );
  const nightImage = join(dirname(added.imagePath), "117.png");
  await cp(sourceImage, nightImage);
  const latestReferences = call(
    "creation",
    {
      action: "illustration.references",
      input: { chapterCardId: chapter.chapterCardId }
    },
    book
  );
  assert.equal(latestReferences.total, 20);
  assert.equal(latestReferences.references.length, 6);
  assert.equal(latestReferences.references[0].filename, "119.png");
  assert.equal(latestReferences.hasMore, true);
  assert.equal(
    latestReferences.references.find(({ filename }) => filename === "117.png")
      ?.available,
    true
  );
  const filteredReferences = call(
    "creation",
    {
      action: "illustration.references",
      input: { chapterCardId: chapter.chapterCardId, query: "117.png" }
    },
    book
  );
  assert.deepEqual(
    filteredReferences.references.map(({ filename }) => filename),
    ["117.png"]
  );
  const olderReferences = call(
    "creation",
    {
      action: "illustration.references",
      input: { chapterCardId: chapter.chapterCardId, offset: 6, limit: 2 }
    },
    book
  );
  assert.deepEqual(
    olderReferences.references.map(({ filename }) => filename),
    ["113.png", "112.png"]
  );
  assert.ok(
    call("creation", { action: "schema", input: { name: "character.assets" } })
      .schema.properties.characterId
  );
  const character = call(
    "creation",
    {
      action: "character.create",
      input: {
        group: "protagonist",
        name: "测试人物",
        faceDescription: "黑发，身形修长",
        settingDescription: "来自山门的修士",
        appearances: [{ name: "常服", description: "青色常服" }]
      }
    },
    book
  );
  assert.equal(character.profile.faceDescription, "黑发，身形修长");
  assert.equal(character.profile.appearances[0].description, "青色常服");
  const addedAppearance = call(
    "creation",
    {
      action: "appearance.add",
      input: {
        characterId: character.characterId,
        name: "礼服",
        description: "白色礼服",
        expectedRevision: character.revision
      }
    },
    book
  );
  assert.match(addedAppearance.assetsDirectory, /appearance_/);
  const afterAppearance = call(
    "creation",
    {
      action: "character.read",
      input: { characterId: character.characterId }
    },
    book
  );
  assert.deepEqual(
    afterAppearance.profile.appearances.map(({ name }) => name),
    ["常服", "礼服"]
  );
  const template = call(
    "creation",
    {
      action: "character.create",
      input: {
        group: "major_supporting",
        name: "慕天香",
        faceDescription: "清秀面容，身形高挑",
        settingDescription: "风系修士",
        appearances: [{ name: "形象1", description: "绿色常服" }]
      }
    },
    book
  );
  assert.ok(
    call("creation", {
      action: "schema",
      input: { name: "appearance.catalog" }
    }).schema.properties.limit
  );
  const firstAppearancePage = call(
    "creation",
    { action: "appearance.catalog", input: { limit: 1 } },
    book
  );
  const secondAppearancePage = call(
    "creation",
    {
      action: "appearance.catalog",
      input: { offset: firstAppearancePage.nextOffset, limit: 1 }
    },
    book
  );
  assert.equal(firstAppearancePage.total, 2);
  assert.equal(firstAppearancePage.characters.length, 1);
  assert.equal(secondAppearancePage.nextOffset, null);
  assert.deepEqual(
    [firstAppearancePage, secondAppearancePage]
      .flatMap(({ characters }) => characters.map(({ name }) => name))
      .sort(),
    ["慕天香", "测试人物"].sort()
  );
  assert.ok(
    [firstAppearancePage, secondAppearancePage]
      .flatMap(({ characters }) => characters)
      .some(
        ({ faceDescription, appearances }) =>
          faceDescription === "黑发，身形修长" &&
          appearances.some(({ description }) => description === "白色礼服")
      )
  );
  assert.ok(
    [firstAppearancePage, secondAppearancePage]
      .flatMap(({ characters }) => characters)
      .every(
        (character) =>
          !Object.hasOwn(character, "settingDescription") &&
          !Object.hasOwn(character, "assets")
      )
  );
  const templateImage = join(root, "面部特写.png");
  await cp(sourceImage, templateImage);
  const canonicalTemplateImage = await realpath(templateImage);
  call(
    "creation",
    {
      action: "character.assets.import",
      input: {
        characterId: template.characterId,
        appearanceId: template.profile.appearances[0].id,
        sourcePaths: [canonicalTemplateImage]
      }
    },
    book
  );
  const generated = call(
    "creation",
    {
      action: "appearance.prompt",
      input: {
        characterId: character.characterId,
        appearanceId: addedAppearance.appearanceId
      }
    },
    book
  );
  assert.match(generated.prompt, /慕天香/);
  assert.match(generated.prompt, /白色礼服/);
  assert.match(generated.prompt, /面部特写/);
  assert.doesNotMatch(generated.prompt, /用户上传的参考形象/);
  const imported = call(
    "creation",
    {
      action: "character.assets.import",
      input: {
        characterId: character.characterId,
        appearanceId: addedAppearance.appearanceId,
        sourcePaths: [canonicalTemplateImage]
      }
    },
    book
  );
  assert.equal(imported.assets[0].label, "面部特写");
  assert.equal(
    call(
      "creation",
      {
        action: "character.assets",
        input: { characterId: character.characterId }
      },
      book
    ).assets.find(
      (asset) => asset.appearanceId === addedAppearance.appearanceId
    )?.available,
    true
  );
  assert.ok(
    call("creation", { action: "index" }, book).workspaceIndex.characters.some(
      ({ id }) => id === character.characterId
    )
  );
  const batch = {
    updatedAt: new Date().toISOString(),
    operations: [
      {
        type: "featureSettings.update",
        patch: { worldbuildingItemLayout: "left-tree" }
      }
    ]
  };
  call("creation", { action: "preview", input: batch }, book);
  call("creation", { action: "apply", input: batch }, book);
  assert.equal(
    call("creation", { action: "index" }, book).workspaceIndex.featureSettings
      .worldbuildingItemLayout,
    "left-tree"
  );
  const library = call("context", {
    action: "createLibrary",
    input: { domain: "skill", name: "写作方法", skillKind: "general" }
  });
  const directory = library.projectDirectory;
  const entry = call("context", {
    action: "createEntry",
    input: {
      libraryDirectory: directory,
      title: "因果检查",
      content: "检查因果。",
      baseProjectRevision: library.revision
    }
  });
  assert.equal(
    call("context", {
      action: "read",
      input: { libraryDirectory: directory, entryId: entry.id }
    }).entry.content,
    "检查因果。"
  );
  const context = call("context", {
    action: "bookContext",
    input: { bookDirectory: book }
  });
  assert.equal(context.libraries.libraries.length, 1);
  assert.equal(
    await readFile(join(root, "tools", "creation", "tool.json"), "utf8").then(
      (text) => JSON.parse(text).name
    ),
    "创作工具"
  );
  await assert.rejects(
    readFile(join(root, "tools", "workspace", "tool.json")),
    { code: "ENOENT" }
  );
  await assert.rejects(
    readFile(join(root, "tools", "creation-context", "tool.json")),
    { code: "ENOENT" }
  );
  const voiceTool = join(root, "tools", "voice-design");
  assert.equal(
    JSON.parse(await readFile(join(voiceTool, "tool.json"), "utf8")).id,
    "voice-design"
  );
  const voiceSchema = JSON.parse(
    execFileSync(
      process.execPath,
      [join(voiceTool, "cli.mjs"), "--input", "-"],
      {
        input: JSON.stringify({ action: "schema" }),
        encoding: "utf8"
      }
    )
  );
  assert.deepEqual(voiceSchema.schema.required, ["title", "instruction"]);
  const { createDesignedVoice } = await import(
    pathToFileURL(join(voiceTool, "voice-design.mjs"))
  );
  const requests = [];
  const voice = await createDesignedVoice(
    { title: "测试角色", instruction: "温和而清晰的声音" },
    "invalid-test-key",
    async (url, init) => {
      requests.push({ url, init });
      if (url.endsWith("/v1/voice-design"))
        return Response.json({
          candidates: [
            {
              audio_base64: Buffer.from("sample").toString("base64"),
              text: "你好"
            }
          ]
        });
      return Response.json({ _id: "voice-example" }, { status: 201 });
    }
  );
  assert.equal(voice.id, "voice-example");
  assert.equal(requests.length, 2);
  assert.equal(requests[1].init.body.get("title"), "测试角色");
  assert.equal(requests[1].init.body.get("visibility"), "private");
  assert.ok(requests[1].init.body.get("voices"));
  console.log(
    "Standalone toolkit smoke passed: copied files, schema, novel create/read/write/structure/illustrations, library create/read, shared context, and voice design; no Electron or node_modules."
  );
} finally {
  await rm(root, { recursive: true, force: true });
}
