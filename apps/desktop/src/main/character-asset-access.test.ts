import { mkdtemp, mkdir, writeFile, rm, symlink, link } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import {
  readCharacterAsset,
  characterAssetImageResponse
} from "./character-asset-access";
const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
  );
});
async function fixture(characterDirectory = "a".repeat(32)) {
  const root = await mkdtemp(join(tmpdir(), "character-access-"));
  roots.push(root);
  const book = join(root, "book"),
    user = join(root, "user"),
    dir = join(book, "long/characters", characterDirectory);
  await mkdir(join(dir, "assets"), { recursive: true });
  await mkdir(user);
  const assetId = "b".repeat(32),
    characterId = "character_example",
    bookId = "longbook_example",
    filename = assetId + ".png";
  await writeFile(
    join(user, "long-project-registry.json"),
    JSON.stringify({ projects: [{ bookId, projectDirectory: book }] })
  );
  await writeFile(
    join(book, "long/index.json"),
    JSON.stringify({
      bookId,
      characters: [{ id: characterId }],
      characterFiles: [
        {
          characterId,
          coreProfile: {
            path: `long/characters/${characterDirectory}/core-profile.md`
          }
        }
      ]
    })
  );
  await writeFile(
    join(dir, "assets.json"),
    JSON.stringify({
      version: 1,
      assets: [{ id: assetId, appearanceId: "look_a", label: "正面", filename }]
    })
  );
  await writeFile(
    join(dir, "assets", filename),
    Buffer.from([137, 80, 78, 71])
  );
  return { user, dir, bookId, characterId, assetId, filename };
}
it("reads only a registered labelled character asset", async () => {
  const f = await fixture();
  const bytes = await readCharacterAsset(f.user, f);
  expect(bytes).toEqual(Buffer.from([137, 80, 78, 71]));
  const response = await characterAssetImageResponse(
    f.user,
    new URL(
      `deepwrite-image://book/${f.bookId}/character/${f.characterId}/${f.filename}`
    )
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Type")).toBe("image/png");
});
it("denies unlisted assets, symlinks and paths outside the character", async () => {
  const f = await fixture();
  await expect(
    readCharacterAsset(f.user, { ...f, assetId: "c".repeat(32) })
  ).rejects.toThrow();
  await rm(join(f.dir, "assets", f.filename));
  await symlink(join(f.dir, "assets.json"), join(f.dir, "assets", f.filename));
  await expect(readCharacterAsset(f.user, f)).rejects.toThrow();
  const response = await characterAssetImageResponse(
    f.user,
    new URL(
      `deepwrite-image://book/${f.bookId}/character/${f.characterId}/%2e%2e%2fassets.json`
    )
  );
  expect(response.status).not.toBe(200);
});
it("denies hardlinked images and indexes", async () => {
  const f = await fixture();
  const source = join(f.dir, "outside.txt");
  await writeFile(source, "external bytes");
  await rm(join(f.dir, "assets", f.filename));
  await link(source, join(f.dir, "assets", f.filename));
  await expect(readCharacterAsset(f.user, f)).rejects.toThrow();
  const response = await characterAssetImageResponse(
    f.user,
    new URL(
      `deepwrite-image://book/${f.bookId}/character/${f.characterId}/${f.filename}`
    )
  );
  expect(response.status).toBe(404);
  await rm(join(f.dir, "assets", f.filename));
  await writeFile(
    join(f.dir, "assets", f.filename),
    Buffer.from([137, 80, 78, 71])
  );
  await link(join(f.dir, "assets.json"), join(f.dir, "manifest-copy.json"));
  await expect(readCharacterAsset(f.user, f)).rejects.toThrow();
});
it("supports compatible character directory names", async () => {
  const f = await fixture("character_securityreview");
  expect(await readCharacterAsset(f.user, f)).toEqual(
    Buffer.from([137, 80, 78, 71])
  );
  const response = await characterAssetImageResponse(
    f.user,
    new URL(
      `deepwrite-image://book/${f.bookId}/character/${f.characterId}/${f.filename}`
    )
  );
  expect(response.status).toBe(200);
  expect(Buffer.from(await response.arrayBuffer())).toEqual(
    Buffer.from([137, 80, 78, 71])
  );
});

async function nestAsset(
  f: Awaited<ReturnType<typeof fixture>>,
  directory = "look_a"
) {
  await mkdir(join(f.dir, "assets", directory));
  await writeFile(
    join(f.dir, "assets", directory, f.filename),
    Buffer.from([137, 80, 78, 71])
  );
  await rm(join(f.dir, "assets", f.filename));
  await writeFile(
    join(f.dir, "assets.json"),
    JSON.stringify({
      version: 1,
      assets: [
        {
          id: f.assetId,
          appearanceId: "look_a",
          directory,
          label: "正面",
          filename: f.filename
        }
      ]
    })
  );
}

it("reads a nested appearance image using the same asset URL", async () => {
  const f = await fixture();
  await nestAsset(f);
  expect(await readCharacterAsset(f.user, f)).toEqual(
    Buffer.from([137, 80, 78, 71])
  );
  const response = await characterAssetImageResponse(
    f.user,
    new URL(
      `deepwrite-image://book/${f.bookId}/character/${f.characterId}/${f.filename}`
    )
  );
  expect(response.status).toBe(200);
  expect(Buffer.from(await response.arrayBuffer())).toEqual(
    Buffer.from([137, 80, 78, 71])
  );
});

it("rejects another appearance's directory or a redirected nested directory", async () => {
  const f = await fixture();
  await nestAsset(f, "look_other");
  await expect(readCharacterAsset(f.user, f)).rejects.toThrow();
  await writeFile(
    join(f.dir, "assets.json"),
    JSON.stringify({
      version: 1,
      assets: [
        {
          id: f.assetId,
          appearanceId: "look_a",
          directory: "look_a",
          label: "正面",
          filename: f.filename
        }
      ]
    })
  );
  await symlink(
    join(f.dir, "assets", "look_other"),
    join(f.dir, "assets", "look_a")
  );
  await expect(readCharacterAsset(f.user, f)).rejects.toThrow();
});
