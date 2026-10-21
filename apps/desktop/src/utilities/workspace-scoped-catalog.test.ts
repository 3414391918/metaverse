import { mkdtemp, mkdir, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  CatalogSnapshotSchema,
  CommandEnvelopeSchema,
  LongListBooksResultSchema,
  createEnvelope
} from "@deepwrite/contracts";
import { WorkspaceDirectoryStore } from "../main/workspace-directory-store";
import { FolderCatalogStore } from "./folder-catalog-store";
import { LongWorkspaceService } from "./long-workspace-service";
import { createWorkspaceScopedCatalog } from "./workspace-scoped-catalog";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
  );
});

describe("workspace-scoped catalog", () => {
  it("discovers projects only in the selected directory and restores the previous directory", async () => {
    const root = await realpath(
      await mkdtemp(join(tmpdir(), "metaverse-scope-"))
    );
    roots.push(root);
    const first = join(root, "first");
    const second = join(root, "second");
    const profile = join(root, "profile");
    await Promise.all([
      mkdir(join(first, "books"), { recursive: true }),
      mkdir(join(first, "materials"), { recursive: true }),
      mkdir(join(first, "skills"), { recursive: true }),
      mkdir(second)
    ]);
    const directory = new WorkspaceDirectoryStore(profile);
    await directory.save(first);
    const book = await new LongWorkspaceService({
      userDataPath: join(root, "old-registration")
    }).create(join(first, "books"), { title: "旧目录中的书", genre: "仙侠" });
    await new FolderCatalogStore({
      userDataPath: join(root, "old-catalog")
    }).createLibrary({
      domain: "material",
      name: "旧目录素材",
      libraryType: "long",
      materialKind: "character",
      parentDirectory: join(first, "materials")
    });
    await new FolderCatalogStore({
      userDataPath: join(root, "old-skill-catalog")
    }).createLibrary({
      domain: "skill",
      name: "旧目录技能",
      libraryType: "long",
      skillKind: "general",
      parentDirectory: join(first, "skills")
    });
    const handle = createWorkspaceScopedCatalog(profile);
    const request = (type: "long.list" | "catalog.snapshot") =>
      handle(
        CommandEnvelopeSchema.parse(
          createEnvelope(type, {}, { id: `${type}_${Date.now()}` })
        )
      );
    const list = async () => {
      const result = await request("long.list");
      if (result.status !== "accepted") throw new Error(result.error.message);
      return LongListBooksResultSchema.parse(result.payload).books;
    };
    const snapshot = async () => {
      const result = await request("catalog.snapshot");
      if (result.status !== "accepted") throw new Error(result.error.message);
      return CatalogSnapshotSchema.parse(result.payload);
    };
    expect((await list()).map(({ id }) => id)).toContain(book.book.id);
    expect((await snapshot()).materials).toHaveLength(1);
    expect((await snapshot()).skills).toHaveLength(1);
    await directory.save(second);
    expect(await list()).toHaveLength(0);
    expect((await snapshot()).materials).toHaveLength(0);
    expect((await snapshot()).skills).toHaveLength(0);
    const secondBook = await new LongWorkspaceService({
      userDataPath: join(root, "second-registration")
    }).create(join(second, "books"), {
      title: "第二目录中的书",
      genre: "仙侠"
    });
    await directory.restore();
    expect((await list()).map(({ id }) => id)).toContain(book.book.id);
    expect((await snapshot()).materials).toHaveLength(1);
    expect((await snapshot()).skills).toHaveLength(1);
    await directory.migrate();
    expect((await list()).map(({ id }) => id)).toEqual(
      expect.arrayContaining([book.book.id, secondBook.book.id])
    );
  });
});
