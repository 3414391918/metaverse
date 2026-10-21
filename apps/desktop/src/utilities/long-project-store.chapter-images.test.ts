import { link, readdir, realpath, rename, truncate } from "node:fs/promises";
import { dirname } from "node:path";
import { crc32 } from "node:zlib";
import sharp from "sharp";
import { vi } from "vitest";
import {
  LONG_CHAPTER_IMAGE_MAX_BYTES,
  createEnvelope,
  CommandEnvelopeSchema
} from "@deepwrite/contracts";
import * as transactions from "./project-transaction";
import { LongWorkspaceService } from "./long-workspace-service";
import { handleLongCoreCommand } from "./long-core-commands";
import {
  LONG_WORKSPACE_INDEX_PATH,
  createFixture,
  describe,
  expect,
  it,
  join,
  mkdir,
  projectTransactionContentSha256,
  readFile,
  symlink,
  unlink,
  writeFile
} from "./long-project-store.test-support";

async function image(
  format: "png" | "jpeg" | "webp" | "gif" | "avif",
  red = 20
) {
  return await sharp({
    create: {
      width: 3,
      height: 2,
      channels: 4,
      background: { r: red, g: 40, b: 80, alpha: 1 }
    }
  })
    .toFormat(format)
    .toBuffer();
}

function dataUrl(bytes: Uint8Array) {
  return `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`;
}

async function fixture(extension = "png") {
  const setup = await createFixture(`chapter-image-${extension}`);
  const chapter = setup.created.book.workspaceIndex.chapters[0]!;
  const bodyPath = join(setup.created.projectDirectory, chapter.body.path);
  const targetPath = join(dirname(bodyPath), "images", `sample.${extension}`);
  await mkdir(dirname(targetPath));
  await writeFile(bodyPath, `# 正文\n\n![示例](images/sample.${extension})\n`);
  const format = extension === "jpg" ? "jpeg" : extension;
  const original = await image(format as Parameters<typeof image>[0]);
  await writeFile(targetPath, original);
  return {
    ...setup,
    chapter,
    bodyPath,
    targetPath,
    original,
    input: {
      bookId: setup.created.book.id,
      chapterCardId: chapter.chapterCardId,
      filename: `sample.${extension}`
    }
  };
}

describe("chapter image storage", () => {
  it("resolves the referenced image to its verified absolute path", async () => {
    const setup = await fixture();
    const source = await setup.projectStore.chapterImageCopySource(
      setup.created.projectDirectory,
      setup.input
    );
    expect(source.path).toBe(setup.targetPath);
    await unlink(setup.targetPath);
    await expect(
      setup.projectStore.chapterImageCopySource(
        setup.created.projectDirectory,
        setup.input
      )
    ).rejects.toThrow();
  });
  it("removes the selected image reference and deletes its file atomically", async () => {
    const setup = await fixture();
    const content = await readFile(setup.bodyPath, "utf8");
    const result = await setup.projectStore.deleteChapterImage(
      setup.created.projectDirectory,
      {
        ...setup.input,
        offset: content.indexOf("![示例]"),
        expectedContent: content,
        expectedRevision: projectTransactionContentSha256(setup.original)
      }
    );
    expect(result.content).toBe("# 正文\n\n");
    expect(result.fileDeleted).toBe(true);
    await expect(readFile(setup.targetPath)).rejects.toMatchObject({
      code: "ENOENT"
    });
  });

  it("keeps an image file while another reference still uses it", async () => {
    const setup = await fixture();
    const content =
      "# 正文\n\n![示例](images/sample.png)\n\n![再用](images/sample.png)\n";
    await writeFile(setup.bodyPath, content);
    const result = await setup.projectStore.deleteChapterImage(
      setup.created.projectDirectory,
      {
        ...setup.input,
        offset: content.indexOf("![再用]"),
        expectedContent: content,
        expectedRevision: projectTransactionContentSha256(setup.original)
      }
    );
    expect(result.content).toContain("![示例](images/sample.png)");
    expect(result.content).not.toContain("![再用]");
    expect(result.fileDeleted).toBe(false);
    expect(await readFile(setup.targetPath)).toEqual(setup.original);
  });

  it("reads and replaces an image in a chapter-id directory", async () => {
    const setup = await fixture();
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

    const snapshot = await setup.projectStore.readChapterImage(
      setup.created.projectDirectory,
      setup.input
    );
    expect(snapshot.revision).toBe(
      projectTransactionContentSha256(setup.original)
    );
    const replacement = await image("png", 200);
    await setup.projectStore.replaceChapterImage(
      setup.created.projectDirectory,
      {
        ...setup.input,
        pngDataUrl: dataUrl(replacement),
        expectedRevision: snapshot.revision
      }
    );
    expect(await readFile(join(nextDirectory, "images", "sample.png"))).toEqual(
      replacement
    );
  });

  it("copies JPEG pixels using the same EXIF orientation as the preview", async () => {
    const setup = await fixture("jpg");
    const oriented = await sharp(setup.original)
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();
    await writeFile(setup.targetPath, oriented);
    const snapshot = await setup.projectStore.readChapterImage(
      setup.created.projectDirectory,
      setup.input
    );
    const png = Buffer.from(snapshot.pngDataUrl.split(",")[1]!, "base64");
    expect(await sharp(png).metadata()).toMatchObject({
      format: "png",
      width: 2,
      height: 3
    });
    expect(snapshot.revision).toBe(projectTransactionContentSha256(oriented));
    expect(await readFile(setup.targetPath)).toEqual(oriented);
  });

  it.each(["png", "jpg", "jpeg", "webp", "gif", "avif"])(
    "reads and atomically replaces %s in place without changing Markdown or index",
    async (extension) => {
      const setup = await fixture(extension);
      const { projectStore, created, input, bodyPath, targetPath, original } =
        setup;
      const stablePaths = [
        bodyPath,
        join(created.projectDirectory, LONG_WORKSPACE_INDEX_PATH),
        join(created.projectDirectory, "deepwrite.json")
      ];
      const before = await Promise.all(
        stablePaths.map((path) => readFile(path))
      );
      const snapshot = await projectStore.readChapterImage(
        created.projectDirectory,
        input
      );
      expect(snapshot.revision).toBe(projectTransactionContentSha256(original));
      expect(
        (
          await sharp(
            Buffer.from(snapshot.pngDataUrl.split(",")[1]!, "base64")
          ).metadata()
        ).format
      ).toBe("png");
      const replaced = await projectStore.replaceChapterImage(
        created.projectDirectory,
        {
          ...input,
          pngDataUrl: dataUrl(await image("png", 200)),
          expectedRevision: snapshot.revision
        }
      );
      const bytes = await readFile(targetPath);
      expect(bytes).not.toEqual(original);
      expect(replaced.revision).toBe(projectTransactionContentSha256(bytes));
      expect(await readdir(dirname(targetPath))).toEqual([input.filename]);
      expect(
        await readdir(
          join(created.projectDirectory, ".deepwrite", "transactions")
        )
      ).toEqual([]);
      expect(
        (await projectStore.readChapterImage(created.projectDirectory, input))
          .revision
      ).toBe(replaced.revision);
      expect((await sharp(bytes).metadata()).format).toBe(
        extension === "jpg" ? "jpeg" : extension === "avif" ? "heif" : extension
      );
      expect(
        await Promise.all(stablePaths.map((path) => readFile(path)))
      ).toEqual(before);
    }
  );

  it("rejects concurrent replacements using an old revision", async () => {
    const { projectStore, created, input, original, targetPath } =
      await fixture();
    const replacement = {
      ...input,
      pngDataUrl: dataUrl(await image("png", 180)),
      expectedRevision: projectTransactionContentSha256(original)
    };
    const outcomes = await Promise.allSettled([
      projectStore.replaceChapterImage(created.projectDirectory, replacement),
      projectStore.replaceChapterImage(created.projectDirectory, replacement)
    ]);
    expect(outcomes.map(({ status }) => status).sort()).toEqual([
      "fulfilled",
      "rejected"
    ]);
    const rejected = outcomes.find((outcome) => outcome.status === "rejected");
    expect(rejected?.reason).toBeInstanceOf(
      transactions.ProjectTransactionConflictError
    );
    expect(await readFile(targetPath)).not.toEqual(original);
  });

  it.each(["body", "index", "image"])(
    "checks %s again in the commit transaction",
    async (changed) => {
      const setup = await fixture();
      const realCommit = transactions.commitProjectTransaction;
      const changedPath =
        changed === "body"
          ? setup.bodyPath
          : changed === "index"
            ? join(setup.created.projectDirectory, LONG_WORKSPACE_INDEX_PATH)
            : setup.targetPath;
      const nextBytes =
        changed === "image"
          ? await image("png", 240)
          : Buffer.concat([await readFile(changedPath), Buffer.from("\n")]);
      const spy = vi
        .spyOn(transactions, "commitProjectTransaction")
        .mockImplementationOnce(async (transaction) => {
          await writeFile(changedPath, nextBytes);
          return await realCommit(transaction);
        });
      try {
        await expect(
          setup.projectStore.replaceChapterImage(
            setup.created.projectDirectory,
            {
              ...setup.input,
              pngDataUrl: dataUrl(await image("png", 100)),
              expectedRevision: projectTransactionContentSha256(setup.original)
            }
          )
        ).rejects.toBeInstanceOf(transactions.ProjectTransactionConflictError);
        expect(await readFile(setup.targetPath)).toEqual(
          changed === "image" ? nextBytes : setup.original
        );
      } finally {
        spy.mockRestore();
      }
    }
  );

  it.each([
    "../sample.png",
    "nested/sample.png",
    "sample.png ",
    "sample.svg",
    "sample.png?x=1"
  ])("rejects unsafe or unsupported filename %s", async (filename) => {
    const setup = await fixture();
    await expect(
      setup.projectStore.readChapterImage(setup.created.projectDirectory, {
        ...setup.input,
        filename
      })
    ).rejects.toThrow();
    expect(await readFile(setup.targetPath)).toEqual(setup.original);
  });

  it("requires the current indexed chapter and an image reference in its body", async () => {
    const setup = await fixture();
    await writeFile(
      setup.bodyPath,
      "[普通链接](images/sample.png)\n![别的图片](images/other.png)"
    );
    await expect(
      setup.projectStore.readChapterImage(
        setup.created.projectDirectory,
        setup.input
      )
    ).rejects.toThrow(/引用/);
    await expect(
      setup.projectStore.readChapterImage(setup.created.projectDirectory, {
        ...setup.input,
        bookId: "longbook_other"
      })
    ).rejects.toThrow(/作品/);
    await expect(
      setup.projectStore.readChapterImage(setup.created.projectDirectory, {
        ...setup.input,
        chapterCardId: "chapter_missing"
      })
    ).rejects.toThrow(/正文/);
    expect(await readFile(setup.targetPath)).toEqual(setup.original);
  });

  it.each(["symlink", "hardlink", "parent-symlink"])(
    "rejects %s targets for reads and replacements",
    async (kind) => {
      const setup = await fixture();
      const external = join(setup.parent, "external.png");
      await writeFile(external, setup.original);
      await unlink(setup.targetPath);
      if (kind === "symlink") await symlink(external, setup.targetPath);
      else if (kind === "hardlink") await link(external, setup.targetPath);
      else {
        await unlink(setup.targetPath).catch(() => undefined);
        const { rm } = await import("node:fs/promises");
        await rm(dirname(setup.targetPath), { recursive: true });
        const outsideImages = join(setup.parent, "outside-images");
        await mkdir(outsideImages);
        await writeFile(
          join(outsideImages, setup.input.filename),
          setup.original
        );
        await symlink(outsideImages, dirname(setup.targetPath));
      }
      await expect(
        setup.projectStore.readChapterImage(
          setup.created.projectDirectory,
          setup.input
        )
      ).rejects.toThrow(/链接|普通文件/);
      await expect(
        setup.projectStore.replaceChapterImage(setup.created.projectDirectory, {
          ...setup.input,
          pngDataUrl: dataUrl(await image("png", 100)),
          expectedRevision: projectTransactionContentSha256(setup.original)
        })
      ).rejects.toThrow(/链接|普通文件/);
      expect(await readFile(external)).toEqual(setup.original);
    }
  );

  it("rejects missing and oversized source files", async () => {
    const setup = await fixture();
    await truncate(setup.targetPath, LONG_CHAPTER_IMAGE_MAX_BYTES + 1);
    await expect(
      setup.projectStore.readChapterImage(
        setup.created.projectDirectory,
        setup.input
      )
    ).rejects.toThrow(/大小/);
    await unlink(setup.targetPath);
    await expect(
      setup.projectStore.readChapterImage(
        setup.created.projectDirectory,
        setup.input
      )
    ).rejects.toThrow();
  });

  it.each(["signature-only", "jpeg-as-png", "oversized-dimensions"])(
    "rejects %s clipboard data without touching the original",
    async (kind) => {
      const setup = await fixture();
      let invalid =
        kind === "jpeg-as-png"
          ? await image("jpeg")
          : Buffer.from(setup.original);
      if (kind === "signature-only") invalid = invalid.subarray(0, 32);
      if (kind === "oversized-dimensions") {
        invalid.writeUInt32BE(8000, 16);
        invalid.writeUInt32BE(6000, 20);
        invalid.writeUInt32BE(crc32(invalid.subarray(12, 29)), 29);
      }
      await expect(
        setup.projectStore.replaceChapterImage(setup.created.projectDirectory, {
          ...setup.input,
          pngDataUrl: dataUrl(invalid),
          expectedRevision: projectTransactionContentSha256(setup.original)
        })
      ).rejects.toThrow();
      expect(await readFile(setup.targetPath)).toEqual(setup.original);
    }
  );

  it("rejects an animated PNG replacement while preserving the original", async () => {
    const setup = await fixture();
    const control = Buffer.alloc(20);
    control.writeUInt32BE(8, 0);
    control.write("acTL", 4, "ascii");
    control.writeUInt32BE(2, 8);
    control.writeUInt32BE(crc32(control.subarray(4, 16)), 16);
    const animated = Buffer.concat([
      setup.original.subarray(0, 33),
      control,
      setup.original.subarray(33)
    ]);
    await expect(
      setup.projectStore.replaceChapterImage(setup.created.projectDirectory, {
        ...setup.input,
        pngDataUrl: dataUrl(animated),
        expectedRevision: projectTransactionContentSha256(setup.original)
      })
    ).rejects.toThrow(/单张 PNG/);
    expect(await readFile(setup.targetPath)).toEqual(setup.original);
  });

  it("routes read and replace through a registered Core workspace service", async () => {
    const setup = await fixture();
    const service = new LongWorkspaceService({
      userDataPath: join(await realpath(setup.parent), "user-data")
    });
    await service.openAtPath(setup.created.projectDirectory);
    const read = await handleLongCoreCommand(
      service,
      CommandEnvelopeSchema.parse(
        createEnvelope("long.readChapterImage", setup.input, {
          id: "read-image"
        })
      )
    );
    expect(read).toMatchObject({
      status: "accepted",
      payload: { revision: projectTransactionContentSha256(setup.original) }
    });
    const replace = await handleLongCoreCommand(
      service,
      CommandEnvelopeSchema.parse(
        createEnvelope(
          "long.replaceChapterImage",
          {
            ...setup.input,
            pngDataUrl: dataUrl(await image("png", 200)),
            expectedRevision: projectTransactionContentSha256(setup.original)
          },
          { id: "replace-image" }
        )
      )
    );
    expect(replace).toMatchObject({
      status: "accepted",
      payload: {
        revision: projectTransactionContentSha256(
          await readFile(setup.targetPath)
        )
      }
    });
  });
});
