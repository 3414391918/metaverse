import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { PromptTemplateStore } from "./prompt-template-store";
import { WorkspaceDirectoryStore } from "./workspace-directory-store";

const roots: string[] = [];
const png =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/vV8AAAAASUVORK5CYII=";

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
  );
});

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "virtual-world-templates-"));
  roots.push(root);
  const userData = join(root, "user-data");
  const work = join(root, "work");
  await mkdir(work);
  const directory = new WorkspaceDirectoryStore(userData);
  await directory.save(work);
  return {
    root,
    userData,
    work,
    directory,
    store: new PromptTemplateStore(userData, directory),
    templatesPath: join(work, "prompt-templates", "templates.json")
  };
}

describe("workspace prompt templates", () => {
  it("moves the existing templates into the chosen work directory without touching agent settings", async () => {
    const setup = await fixture();
    const legacyPath = join(
      setup.userData,
      "config",
      "long-workspace-agents.json"
    );
    const legacy = {
      version: 3,
      workspaceType: "long",
      promptTemplates: [{ id: "legacy", name: "旧模板", content: "旧内容" }],
      agents: [{ id: "long", systemPrompt: "保留此配置" }]
    };
    await writeFile(legacyPath, JSON.stringify(legacy));
    expect(await setup.store.list()).toEqual(legacy.promptTemplates);
    expect(JSON.parse(await readFile(setup.templatesPath, "utf8"))).toEqual(
      legacy.promptTemplates
    );
    const after = JSON.parse(await readFile(legacyPath, "utf8"));
    expect(after.promptTemplates).toBeUndefined();
    expect(after.agents).toEqual(legacy.agents);
  });

  it("saves several pasted images, reads them, and removes their files with the template", async () => {
    const setup = await fixture();
    const template = {
      id: "with-images",
      name: "多图模板",
      content: "参考下面的图片。",
      imageIds: ["first", "second"]
    };
    expect(
      await setup.store.save({
        template,
        newImages: [
          { id: "first", pngDataUrl: png },
          { id: "second", pngDataUrl: png }
        ]
      })
    ).toEqual([template]);
    const reloaded = new PromptTemplateStore(setup.userData, setup.directory);
    expect(await reloaded.list()).toEqual([template]);
    expect(
      await reloaded.readImage({ templateId: template.id, imageId: "second" })
    ).toEqual({ pngDataUrl: png });
    await setup.store.save({
      template: { ...template, imageIds: ["first"] },
      newImages: []
    });
    await expect(
      setup.store.readImage({ templateId: template.id, imageId: "second" })
    ).rejects.toThrow(/不存在/);
    await setup.store.delete(template.id);
    expect(await reloaded.list()).toEqual([]);
    expect(
      await readdir(join(setup.work, "prompt-templates", "images"))
    ).toEqual([]);
  });

  it("keeps existing work-directory templates and imports only missing legacy templates", async () => {
    const setup = await fixture();
    await mkdir(join(setup.work, "prompt-templates"));
    const local = [
      { id: "shared", name: "工作目录版本", content: "最新内容" },
      { id: "local", name: "本地模板", content: "本地内容" }
    ];
    await writeFile(setup.templatesPath, JSON.stringify(local));
    const legacyPath = join(
      setup.userData,
      "config",
      "long-workspace-agents.json"
    );
    await writeFile(
      legacyPath,
      JSON.stringify({
        promptTemplates: [
          { id: "shared", name: "旧版本", content: "旧内容" },
          { id: "other", name: "未迁移模板", content: "旧内容" }
        ]
      })
    );
    expect((await setup.store.list()).map(({ id }) => id)).toEqual([
      "shared",
      "local",
      "other"
    ]);
    expect((await setup.store.list())[0]).toEqual(local[0]);
    expect(JSON.parse(await readFile(legacyPath, "utf8"))).toEqual({});
  });

  it("preserves template order when editing", async () => {
    const setup = await fixture();
    for (const id of ["first", "second", "third"])
      await setup.store.save({
        template: { id, name: id, content: id },
        newImages: []
      });
    await setup.store.save({
      template: { id: "second", name: "已编辑", content: "新的内容" },
      newImages: []
    });
    expect((await setup.store.list()).map(({ id }) => id)).toEqual([
      "first",
      "second",
      "third"
    ]);
  });

  it("rejects missing image data without changing the saved template", async () => {
    const setup = await fixture();
    await setup.store.save({
      template: { id: "safe", name: "安全模板", content: "原内容" },
      newImages: []
    });
    const before = await readFile(setup.templatesPath, "utf8");
    await expect(
      setup.store.save({
        template: {
          id: "safe",
          name: "安全模板",
          content: "新内容",
          imageIds: ["missing"]
        },
        newImages: []
      })
    ).rejects.toThrow(/不存在/);
    expect(await readFile(setup.templatesPath, "utf8")).toBe(before);
  });

  it("loads templates from the currently selected work directory", async () => {
    const setup = await fixture();
    await setup.store.save({
      template: { id: "one", name: "目录一", content: "内容一" },
      newImages: []
    });
    const second = join(setup.root, "second-work");
    await mkdir(second);
    await setup.directory.save(second);
    expect(await setup.store.list()).toEqual([]);
    await setup.directory.save(setup.work);
    expect((await setup.store.list()).map(({ name }) => name)).toEqual([
      "目录一"
    ]);
  });
});
