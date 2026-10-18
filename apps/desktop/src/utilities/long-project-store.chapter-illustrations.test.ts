import { rename } from "node:fs/promises";
import { dirname } from "node:path";
import sharp from "sharp";
import { vi } from "vitest";
import * as transactions from "./project-transaction";
import {
  createFixture,
  describe,
  expect,
  it,
  join,
  mkdir,
  readFile,
  readdir,
  symlink,
  writeFile,
  LONG_WORKSPACE_INDEX_PATH
} from "./long-project-store.test-support";

async function fixture(suffix: string) {
  const setup = await createFixture(`illustration-${suffix}`);
  const chapter = setup.created.book.workspaceIndex.chapters[0]!;
  const content = "第一段。\n\n第二段。";
  await setup.projectStore.writeDocument(setup.created.projectDirectory, {
    fileId: chapter.body.id,
    content
  });
  const png = await sharp({
    create: {
      width: 4,
      height: 3,
      channels: 4,
      background: { r: 20, g: 40, b: 60, alpha: 1 }
    }
  })
    .png()
    .toBuffer();
  const bodyPath = join(setup.created.projectDirectory, chapter.body.path);
  return {
    ...setup,
    chapter,
    bodyPath,
    images: join(dirname(bodyPath), "images"),
    input: {
      bookId: setup.created.book.id,
      chapterCardId: chapter.chapterCardId,
      content,
      expectedContent: content,
      offset: 4,
      pngDataUrl: `data:image/png;base64,${png.toString("base64")}`
    }
  };
}

describe("chapter illustration insertion", () => {
  it("adds an image to a chapter whose indexed directory uses its chapter id", async () => {
    const setup = await fixture("chapter-id-directory");
    const directory = "chapter_071894ed";
    const previousDirectory = dirname(setup.bodyPath);
    const nextDirectory = join(dirname(previousDirectory), directory);
    await rename(previousDirectory, nextDirectory);
    const indexPath = join(
      setup.created.projectDirectory,
      LONG_WORKSPACE_INDEX_PATH
    );
    const index = JSON.parse(await readFile(indexPath, "utf8")) as {
      chapters: Array<Record<string, unknown>>;
    };
    const chapter = index.chapters[0]!;
    for (const field of ["body", "card", "characterState", "handoff"]) {
      const file = chapter[field] as { path: string } | undefined;
      if (file)
        file.path = file.path.replace(
          /long\/chapters\/[^/]+\//u,
          `long/chapters/${directory}/`
        );
    }
    await writeFile(indexPath, JSON.stringify(index));

    const result = await setup.projectStore.addChapterImage(
      setup.created.projectDirectory,
      setup.input
    );
    expect(result.filename).toBe("001.png");
    expect(result.document.file.path).toBe(
      `long/chapters/${directory}/body.md`
    );
    expect(
      (await readFile(join(nextDirectory, "images", "001.png"))).byteLength
    ).toBeGreaterThan(0);
  });

  it("atomically saves 001.png and its reference at the requested offset", async () => {
    const setup = await fixture("first");
    const result = await setup.projectStore.addChapterImage(
      setup.created.projectDirectory,
      setup.input
    );
    expect(result.filename).toBe("001.png");
    expect(result.content).toBe("第一段。\n\n![](images/001.png)\n\n第二段。");
    expect(result.document.file.id).toBe(setup.chapter.body.id);
    expect(await readFile(setup.bodyPath, "utf8")).toBe(result.content);
    expect(
      await sharp(
        await readFile(join(setup.images, result.filename))
      ).metadata()
    ).toMatchObject({ format: "png", width: 4, height: 3 });
    const reopened = await setup.projectStore.readDocument(
      setup.created.projectDirectory,
      {
        fileId: setup.chapter.body.id
      }
    );
    expect(reopened.content).toBe(result.content);
    const second = await setup.projectStore.addChapterImage(
      setup.created.projectDirectory,
      {
        ...setup.input,
        content: result.content,
        expectedContent: result.content,
        offset: result.content.length
      }
    );
    expect(second.filename).toBe("002.png");
    expect((await readdir(setup.images)).sort()).toEqual([
      "001.png",
      "002.png"
    ]);
  });

  it("continues after existing images and references while preserving unsaved text", async () => {
    const setup = await fixture("numbering");
    await mkdir(setup.images);
    await writeFile(join(setup.images, "022.PNG"), "existing asset");
    const draft = `${setup.input.content}\n\n![](images/024.png)\n\n新增草稿。`;
    const result = await setup.projectStore.addChapterImage(
      setup.created.projectDirectory,
      {
        ...setup.input,
        content: draft,
        offset: draft.length
      }
    );
    expect(result.filename).toBe("025.png");
    expect(result.content).toContain("新增草稿。");
    expect(await readFile(join(setup.images, "022.PNG"), "utf8")).toBe(
      "existing asset"
    );
  });

  it("rejects stale saved text without creating an image or overwriting the body", async () => {
    const setup = await fixture("stale");
    await writeFile(setup.bodyPath, "外部修改。");
    await expect(
      setup.projectStore.addChapterImage(
        setup.created.projectDirectory,
        setup.input
      )
    ).rejects.toThrow(/已.*修改|已.*更新/u);
    expect(await readFile(setup.bodyPath, "utf8")).toBe("外部修改。");
    await expect(readdir(setup.images)).rejects.toMatchObject({
      code: "ENOENT"
    });
  });

  it("does not let a stale editor save erase an illustration added externally", async () => {
    const setup = await fixture("stale-editor-save");
    const inserted = await setup.projectStore.addChapterImage(
      setup.created.projectDirectory,
      setup.input
    );
    await expect(
      setup.projectStore.writeDocument(setup.created.projectDirectory, {
        fileId: setup.chapter.body.id,
        content: `${setup.input.content}\n\n编辑器中的新文字。`,
        expectedContent: setup.input.content
      })
    ).rejects.toThrow(/正文.*修改|正文.*更新|冲突/u);
    expect(await readFile(setup.bodyPath, "utf8")).toBe(inserted.content);
  });

  it("rejects broken images and invalid offsets before saving anything", async () => {
    const setup = await fixture("invalid");
    for (const changes of [
      {
        pngDataUrl: `data:image/png;base64,${Buffer.from("not an image").toString("base64")}`
      },
      { offset: setup.input.content.length + 1 },
      { bookId: "longbook_other" }
    ]) {
      await expect(
        setup.projectStore.addChapterImage(setup.created.projectDirectory, {
          ...setup.input,
          ...changes
        })
      ).rejects.toThrow();
    }
    expect(await readFile(setup.bodyPath, "utf8")).toBe(
      setup.input.expectedContent
    );
    await expect(readdir(setup.images)).rejects.toMatchObject({
      code: "ENOENT"
    });
  });

  it("rejects an images directory that points outside the chapter", async () => {
    const setup = await fixture("symlink");
    const outside = join(setup.parent, "outside");
    await mkdir(outside);
    await symlink(outside, setup.images);
    await expect(
      setup.projectStore.addChapterImage(
        setup.created.projectDirectory,
        setup.input
      )
    ).rejects.toThrow(/符号链接|真实目录/u);
    expect(await readdir(outside)).toEqual([]);
  });

  it("keeps an externally occupied number and retries with the next filename", async () => {
    const setup = await fixture("occupied");
    const original = transactions.commitProjectTransaction;
    const spy = vi
      .spyOn(transactions, "commitProjectTransaction")
      .mockImplementationOnce(async (input) => {
        await mkdir(setup.images, { recursive: true });
        await writeFile(join(setup.images, "001.png"), "external asset");
        return original(input);
      });
    try {
      const result = await setup.projectStore.addChapterImage(
        setup.created.projectDirectory,
        setup.input
      );
      expect(result.filename).toBe("002.png");
      expect(await readFile(join(setup.images, "001.png"), "utf8")).toBe(
        "external asset"
      );
      expect(result.content).toContain("![](images/002.png)");
    } finally {
      spy.mockRestore();
    }
  });

  it("checks the body again in the transaction and leaves no image on conflict", async () => {
    const setup = await fixture("body-race");
    const original = transactions.commitProjectTransaction;
    const indexBefore = await readFile(
      join(setup.created.projectDirectory, LONG_WORKSPACE_INDEX_PATH)
    );
    const spy = vi
      .spyOn(transactions, "commitProjectTransaction")
      .mockImplementationOnce(async (input) => {
        await writeFile(setup.bodyPath, "newer external body");
        return original(input);
      });
    try {
      await expect(
        setup.projectStore.addChapterImage(
          setup.created.projectDirectory,
          setup.input
        )
      ).rejects.toBeInstanceOf(transactions.ProjectTransactionConflictError);
      expect(await readFile(setup.bodyPath, "utf8")).toBe(
        "newer external body"
      );
      expect(
        await readFile(
          join(setup.created.projectDirectory, LONG_WORKSPACE_INDEX_PATH)
        )
      ).toEqual(indexBefore);
      expect(await readdir(setup.images).catch(() => [])).toEqual([]);
    } finally {
      spy.mockRestore();
    }
  });
});
