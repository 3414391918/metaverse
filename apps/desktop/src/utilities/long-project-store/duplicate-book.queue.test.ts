import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { duplicateBook } from "./duplicate-book";
import { readDocument } from "./documents";
import { createBook } from "./lifecycle";
import { createLongProjectStoreContext } from "./store-context";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
  );
});
async function fixture() {
  const parent = await realpath(
    await mkdtemp(join(tmpdir(), "deepwrite-duplicate-queue-"))
  );
  roots.push(parent);
  const ctx = createLongProjectStoreContext({
    now: () => "2026-10-01T00:00:00.000Z"
  });
  const source = await createBook(ctx, parent, {
    title: "临时原稿",
    genre: "悬疑"
  });
  return { parent, ctx, source };
}

it("waits for an in-flight source mutation and copies its completed disk content", async () => {
  const { parent, ctx, source } = await fixture();
  const body = source.book.workspaceIndex.chapters[0]!.body;
  let entered!: () => void;
  let release!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const writing = ctx.runExclusive(source.projectDirectory, async () => {
    entered();
    await gate;
    // A real disk mutation under the same queue used by profile and asset writers.
    await writeFile(
      join(source.projectDirectory, body.path),
      "排队写入的新版本",
      "utf8"
    );
  });
  await started;
  const writerTail = ctx.queues.get(source.projectDirectory);
  const duplicating = duplicateBook(
    ctx,
    parent,
    source.projectDirectory,
    "等待写入的副本"
  );
  try {
    await vi.waitFor(() => {
      expect(ctx.queues.get(source.projectDirectory)).not.toBe(writerTail);
    });
  } finally {
    release();
    await writing;
    await duplicating;
  }
  const copy = await duplicating;
  expect(
    await readDocument(ctx, copy.projectDirectory, { fileId: body.id })
  ).toMatchObject({ content: "排队写入的新版本" });
});

it("handles identical source and destination directory queue keys without deadlock", async () => {
  const { ctx, source } = await fixture();
  const copy = await duplicateBook(
    ctx,
    source.projectDirectory,
    source.projectDirectory,
    "同目录副本"
  );
  expect(copy.book.title).toBe("同目录副本");
  expect(copy.projectDirectory).toBe(
    join(source.projectDirectory, copy.book.id)
  );
  expect(ctx.queues.size).toBe(0);
});
