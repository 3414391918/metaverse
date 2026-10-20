import { dirname } from "node:path";
import {
  createFixture,
  describe,
  expect,
  it,
  join,
  readFile,
  readdir,
  writeFile
} from "./long-project-store.test-support";

const mp4 = Buffer.concat([
  Buffer.from([0, 0, 0, 16]),
  Buffer.from("ftyp", "ascii"),
  Buffer.from("isom0000", "ascii")
]);
const secondMp4 = Buffer.concat([mp4, Buffer.from("replacement")]);

async function fixture(suffix: string) {
  const setup = await createFixture(`video-${suffix}`);
  const chapter = setup.created.book.workspaceIndex.chapters[0]!;
  const content = "第一段。\n\n第二段。";
  await setup.projectStore.writeDocument(setup.created.projectDirectory, {
    fileId: chapter.body.id,
    content
  });
  const bodyPath = join(setup.created.projectDirectory, chapter.body.path);
  return {
    ...setup,
    chapter,
    content,
    bodyPath,
    videos: join(dirname(bodyPath), "videos"),
    input: {
      bookId: setup.created.book.id,
      chapterCardId: chapter.chapterCardId,
      content,
      expectedContent: content,
      offset: 4,
      videoDataUrl: `data:video/mp4;base64,${mp4.toString("base64")}`
    }
  };
}

describe("chapter videos", () => {
  it("saves a numbered video and its inline reference atomically, then replaces and deletes it", async () => {
    const setup = await fixture("lifecycle");
    const added = await setup.projectStore.addChapterVideo(
      setup.created.projectDirectory,
      setup.input
    );
    expect(added.filename).toBe("001.mp4");
    expect(added.content).toBe(
      "第一段。\n\n!video[](videos/001.mp4)\n\n第二段。"
    );
    expect(await readFile(setup.bodyPath, "utf8")).toBe(added.content);
    expect(await readFile(join(setup.videos, added.filename))).toEqual(mp4);
    const target = {
      bookId: setup.input.bookId,
      chapterCardId: setup.input.chapterCardId,
      filename: added.filename
    };
    const read = await setup.projectStore.readChapterVideo(
      setup.created.projectDirectory,
      target
    );
    const replaced = await setup.projectStore.replaceChapterVideo(
      setup.created.projectDirectory,
      {
        ...target,
        expectedRevision: read.revision,
        videoDataUrl: `data:video/mp4;base64,${secondMp4.toString("base64")}`
      }
    );
    expect(replaced.revision).not.toBe(read.revision);
    expect(await readFile(join(setup.videos, added.filename))).toEqual(
      secondMp4
    );
    const deleted = await setup.projectStore.deleteChapterVideo(
      setup.created.projectDirectory,
      {
        ...target,
        expectedContent: added.content,
        expectedRevision: replaced.revision,
        offset: added.content.indexOf("!video")
      }
    );
    expect(deleted.fileDeleted).toBe(true);
    expect(await readFile(setup.bodyPath, "utf8")).toBe(deleted.content);
    expect(await readdir(setup.videos)).toEqual([]);
  });

  it("rejects stale body and stale video revisions", async () => {
    const setup = await fixture("stale");
    await writeFile(setup.bodyPath, "外部修改。");
    await expect(
      setup.projectStore.addChapterVideo(
        setup.created.projectDirectory,
        setup.input
      )
    ).rejects.toThrow();
    await expect(readdir(setup.videos)).rejects.toMatchObject({
      code: "ENOENT"
    });
    await writeFile(setup.bodyPath, setup.content);
    const added = await setup.projectStore.addChapterVideo(
      setup.created.projectDirectory,
      setup.input
    );
    await expect(
      setup.projectStore.replaceChapterVideo(setup.created.projectDirectory, {
        bookId: setup.input.bookId,
        chapterCardId: setup.input.chapterCardId,
        filename: added.filename,
        expectedRevision: "0".repeat(64),
        videoDataUrl: setup.input.videoDataUrl
      })
    ).rejects.toThrow();
  });
});
