import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, expect, it } from "vitest";
import { commitProjectTransaction } from "./project-transaction";
import { commitLongProjectTransaction } from "./long-project-store/io";
const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
  );
});
it("commits exact binary bytes together with JSON in the long project transaction", async () => {
  const root = await mkdtemp(join(tmpdir(), "deepwrite-binary-transaction-"));
  roots.push(root);
  const bytes = Uint8Array.from([0, 255, 254, 128, 13, 10]);
  await commitLongProjectTransaction({
    projectRoot: root,
    operations: [
      {
        path: "long/characters/character_test/assets/abcdef0123456789abcdef0123456789.png",
        content: bytes
      },
      {
        path: "long/characters/character_test/assets.json",
        content: '{"version":1,"assets":[]}'
      }
    ]
  });
  expect(
    await readFile(
      join(
        root,
        "long/characters/character_test/assets/abcdef0123456789abcdef0123456789.png"
      )
    )
  ).toEqual(Buffer.from(bytes));
  await expect(
    commitProjectTransaction({
      projectRoot: root,
      maxFileBytes: 3,
      operations: [{ path: "too-big.png", content: bytes }]
    })
  ).rejects.toThrow(/大小/);
});
