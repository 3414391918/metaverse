import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  symlink,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ToolLibraryStore } from "./tool-library-store";
import { WorkspaceDirectoryStore } from "./workspace-directory-store";
const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((path) => rm(path, { recursive: true, force: true }))
  );
});
async function setup() {
  const root = await mkdtemp(join(tmpdir(), "virtual-world-tools-"));
  roots.push(root);
  const work = join(root, "work"),
    defaults = join(root, "defaults");
  await mkdir(work);
  for (const id of ["alpha", "beta"]) {
    await mkdir(join(defaults, id), { recursive: true });
    await writeFile(
      join(defaults, id, "tool.json"),
      JSON.stringify({
        version: 1,
        id,
        name: id,
        description: "工具",
        entryFile: "SKILL.md",
        relatedToolIds: id === "beta" ? ["alpha"] : []
      })
    );
    await writeFile(join(defaults, id, "SKILL.md"), `# ${id}\n`);
  }
  const workspace = new WorkspaceDirectoryStore(join(root, "user-data"));
  await workspace.save(work);
  const directory = join((await workspace.list()).path!, "tools");
  const store = new ToolLibraryStore(workspace, defaults, async () => [
    { toolId: "alpha", path: "notes.md", content: "已迁入规则" }
  ]);
  return { root, work, directory, defaults, store };
}
describe("editable tool library", () => {
  it("merges legacy creation tools without dropping edited guidance", async () => {
    const { store, directory, defaults } = await setup();
    await store.list();
    await rm(join(directory, ".creation-merged-v1.json"));
    const source = join(defaults, "creation");
    await mkdir(join(source, "runtime"), { recursive: true });
    for (const name of [
      "SKILL.md",
      "workspace.md",
      "context.md",
      "cli.mjs",
      "context-cli.mjs",
      "tool.json"
    ])
      await writeFile(
        join(source, name),
        name === "tool.json"
          ? JSON.stringify({
              version: 1,
              id: "creation",
              name: "创作工具",
              description: "",
              entryFile: "SKILL.md",
              relatedToolIds: []
            })
          : `new ${name}`
      );
    await writeFile(join(source, "runtime/engine.mjs"), "new runtime");
    await mkdir(join(directory, "creation-context"));
    await mkdir(join(directory, "workspace/runtime"), { recursive: true });
    await writeFile(
      join(directory, "creation-context/SKILL.md"),
      "旧上下文规则"
    );
    await writeFile(
      join(directory, "creation-context/material-management.md"),
      "用户素材规则"
    );
    await writeFile(
      join(directory, "creation-context/libraries.json"),
      '{"libraryDirectories":[]}'
    );
    await writeFile(
      join(directory, "creation-context/cli.mjs"),
      "old context cli"
    );
    await writeFile(join(directory, "workspace/SKILL.md"), "旧空间规则");
    await writeFile(join(directory, "workspace/cli.mjs"), "old workspace cli");
    await writeFile(
      join(directory, "workspace/runtime/engine.mjs"),
      "old runtime"
    );
    await mkdir(join(directory, "creation"));
    await writeFile(join(directory, "creation/SKILL.md"), "用户旧创作规则");
    await writeFile(
      join(directory, "creation/writing-rules.md"),
      "用户写作规则"
    );
    await writeFile(
      join(directory, "beta/tool.json"),
      JSON.stringify({
        version: 1,
        id: "beta",
        name: "beta",
        description: "",
        entryFile: "SKILL.md",
        relatedToolIds: ["workspace", "creation-context"]
      })
    );
    const tools = (await store.list()).tools;
    expect(tools.map(({ id }) => id)).not.toContain("workspace");
    expect(tools.map(({ id }) => id)).not.toContain("creation-context");
    expect(tools.find(({ id }) => id === "beta")?.relatedToolIds).toEqual([
      "creation"
    ]);
    expect(
      await readFile(join(directory, "creation/material-management.md"), "utf8")
    ).toBe("用户素材规则");
    expect(
      await readFile(join(directory, "creation/writing-rules.md"), "utf8")
    ).toBe("用户写作规则");
    expect(
      await readFile(join(directory, "creation/legacy/creation.md"), "utf8")
    ).toBe("用户旧创作规则");
    expect(
      await readFile(
        join(directory, "creation/legacy/runtime/engine.mjs"),
        "utf8"
      )
    ).toBe("old runtime");
    expect(
      await readFile(join(directory, "creation/runtime/engine.mjs"), "utf8")
    ).toBe("new runtime");
  });
  it("adds voice design once to an existing work directory and respects later deletion", async () => {
    const { store, directory, defaults } = await setup();
    await store.list();
    await mkdir(join(defaults, "voice-design"));
    await writeFile(
      join(defaults, "voice-design/tool.json"),
      JSON.stringify({
        version: 1,
        id: "voice-design",
        name: "声音设计工具",
        description: "设计声音",
        entryFile: "SKILL.md",
        relatedToolIds: []
      })
    );
    await writeFile(join(defaults, "voice-design/SKILL.md"), "原始说明");
    expect((await store.list()).tools.map(({ id }) => id)).toContain(
      "voice-design"
    );
    await writeFile(join(directory, "voice-design/SKILL.md"), "用户改过的说明");
    await store.list();
    expect(
      await readFile(join(directory, "voice-design/SKILL.md"), "utf8")
    ).toBe("用户改过的说明");
    await store.delete("voice-design");
    expect((await store.list()).tools.map(({ id }) => id)).not.toContain(
      "voice-design"
    );
  });
  it("installs defaults once in the work directory and edits the installed files", async () => {
    const { store, directory } = await setup();
    expect((await store.list()).tools).toHaveLength(2);
    expect((await store.list()).directory).toBe(directory);
    expect(await readFile(join(directory, "alpha/notes.md"), "utf8")).toBe(
      "已迁入规则"
    );
    const file = await store.read({ toolId: "alpha", path: "SKILL.md" });
    await store.save({
      toolId: "alpha",
      path: "SKILL.md",
      content: "已修改",
      expectedSha256: file.sha256
    });
    expect(await readFile(join(directory, "alpha/SKILL.md"), "utf8")).toBe(
      "已修改"
    );
    await writeFile(join(directory, "alpha/SKILL.md"), "外部修改");
    expect(
      (await store.read({ toolId: "alpha", path: "SKILL.md" })).content
    ).toBe("外部修改");
    await expect(store.delete("alpha")).rejects.toThrow(/beta/);
    await store.delete("beta");
    await store.delete("alpha");
    expect((await store.list()).tools).toEqual([]);
    expect(
      await readFile(join(directory, ".initialized-v1.json"), "utf8")
    ).toContain("1");
  });
  it("rejects overwriting an external edit and accepts a new nested source file", async () => {
    const { store, directory } = await setup();
    await store.list();
    const file = await store.read({ toolId: "alpha", path: "SKILL.md" });
    await writeFile(join(directory, "alpha/SKILL.md"), "外部新内容");
    await expect(
      store.save({
        toolId: "alpha",
        path: "SKILL.md",
        content: "旧内容",
        expectedSha256: file.sha256
      })
    ).rejects.toThrow(/外部修改/);
    expect(
      (await store.read({ toolId: "alpha", path: "SKILL.md" })).content
    ).toBe("外部新内容");
    await store.save({
      toolId: "alpha",
      path: "scripts/check.mjs",
      content: "export const value = 1;",
      expectedSha256: null
    });
    expect(
      (await store.list()).tools
        .find(({ id }) => id === "alpha")
        ?.files.map(({ path }) => path)
    ).toContain("scripts/check.mjs");
  });
  it("rejects path traversal and symbolic links without changing their targets", async () => {
    const { store, root, directory } = await setup();
    await store.list();
    const outside = join(root, "outside");
    await mkdir(outside);
    await writeFile(join(outside, "secret.txt"), "原内容");
    await symlink(outside, join(directory, "alpha/linked"));
    expect(() =>
      store.read({ toolId: "alpha", path: "../beta/SKILL.md" })
    ).toThrow();
    await expect(
      store.save({
        toolId: "alpha",
        path: "linked/secret.txt",
        content: "修改",
        expectedSha256: null
      })
    ).rejects.toThrow(/符号链接/);
    expect(await readFile(join(outside, "secret.txt"), "utf8")).toBe("原内容");
  });
  it("keeps malformed tools repairable and validates manifest identity on save", async () => {
    const { store, directory } = await setup();
    await store.list();
    await writeFile(join(directory, "alpha/tool.json"), "bad json");
    const listed = await store.list();
    expect(listed.tools.find(({ id }) => id === "alpha")?.error).toBeTruthy();
    expect(listed.tools.find(({ id }) => id === "beta")?.error).toBeUndefined();
    const file = await store.read({ toolId: "alpha", path: "tool.json" });
    const manifest = {
      version: 1,
      id: "different",
      name: "A",
      description: "",
      entryFile: "SKILL.md",
      relatedToolIds: []
    };
    await expect(
      store.save({
        toolId: "alpha",
        path: "tool.json",
        content: JSON.stringify(manifest),
        expectedSha256: file.sha256
      })
    ).rejects.toThrow(/id/);
  });
});
