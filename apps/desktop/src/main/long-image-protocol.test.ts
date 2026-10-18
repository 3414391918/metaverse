import { readFileSync } from "node:fs";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createLongImageProtocolHandler,
  registerLongImageScheme
} from "./long-image-protocol";

const roots: string[] = [];
const bookId = "longbook_example";
const chapter = "a".repeat(32);
const url = `deepwrite-image://book/${bookId}/${chapter}/001.png`;

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
  );
});

async function fixture(chapterDirectory = chapter): Promise<{
  userData: string;
  imageDirectory: string;
}> {
  const root = await mkdtemp(join(tmpdir(), "deepwrite-long-image-"));
  roots.push(root);
  const userData = join(root, "user-data");
  const book = join(root, "book");
  const imageDirectory = join(
    book,
    "long",
    "chapters",
    chapterDirectory,
    "images"
  );
  await mkdir(userData);
  await mkdir(imageDirectory, { recursive: true });
  await writeFile(
    join(userData, "long-project-registry.json"),
    JSON.stringify({ projects: [{ bookId, projectDirectory: book }] })
  );
  await writeFile(
    join(book, "long", "index.json"),
    JSON.stringify({
      bookId,
      chapters: [
        { body: { path: `long/chapters/${chapterDirectory}/body.md` } }
      ]
    })
  );
  await writeFile(
    join(imageDirectory, "001.png"),
    Buffer.from([137, 80, 78, 71])
  );
  return { userData, imageDirectory };
}

describe("long image protocol", () => {
  it("is installed before rendering and allowed only in image CSP", () => {
    const main = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
    const html = readFileSync(
      new URL("../renderer/index.html", import.meta.url),
      "utf8"
    );
    expect(main).toContain("registerLongImageScheme();");
    expect(main).toContain("installLongImageProtocolHandler(userDataPath);");
    expect(html).toContain("img-src 'self' data: deepwrite-image:;");
  });

  it("registers a secure local image scheme", () => {
    const registerSchemesAsPrivileged = vi.fn();
    registerLongImageScheme({ registerSchemesAsPrivileged });
    expect(registerSchemesAsPrivileged).toHaveBeenCalledWith([
      {
        scheme: "deepwrite-image",
        privileges: {
          standard: true,
          secure: true,
          corsEnabled: true,
          supportFetchAPI: true,
          stream: true
        }
      }
    ]);
  });

  it("streams only a registered chapter image with an image content type", async () => {
    const { userData } = await fixture();
    const result = await createLongImageProtocolHandler(userData)(
      new Request(url)
    );
    expect(result.status).toBe(200);
    expect(result.headers.get("Content-Type")).toBe("image/png");
    expect(result.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(Buffer.from(await result.arrayBuffer())).toEqual(
      Buffer.from([137, 80, 78, 71])
    );
  });
  it("streams an image from an indexed chapter-id directory", async () => {
    const chapterDirectory = "chapter_071894ed";
    const { userData } = await fixture(chapterDirectory);
    const response = await createLongImageProtocolHandler(userData)(
      new Request(
        `deepwrite-image://book/${bookId}/${chapterDirectory}/001.png`
      )
    );
    expect(response.status).toBe(200);
    expect(Buffer.from(await response.arrayBuffer())).toEqual(
      Buffer.from([137, 80, 78, 71])
    );
  });
  it("allows a single content revision for immediate reload and rejects arbitrary queries", async () => {
    const { userData } = await fixture();
    const handler = createLongImageProtocolHandler(userData);
    const result = await handler(new Request(`${url}?v=${"b".repeat(64)}`));
    expect(result.status).toBe(200);
    await result.arrayBuffer();
    for (const query of [
      "v=bad",
      `v=${"a".repeat(64)}&path=secret`,
      `v=${"a".repeat(64)}&v=${"b".repeat(64)}`
    ]) {
      expect((await handler(new Request(`${url}?${query}`))).status).toBe(400);
    }
  });

  it("rejects unregistered chapters, traversal, SVG, and symlinked assets", async () => {
    const { userData, imageDirectory } = await fixture();
    const handler = createLongImageProtocolHandler(userData);
    await symlink(
      join(imageDirectory, "001.png"),
      join(imageDirectory, "link.png")
    );

    expect(
      (await handler(new Request(url.replace(chapter, "b".repeat(32))))).status
    ).toBe(404);
    expect(
      (
        await handler(
          new Request(url.replace("001.png", "%2E%2E%2Fsecret.png"))
        )
      ).status
    ).not.toBe(200);
    expect(
      (await handler(new Request(url.replace("001.png", "image.svg")))).status
    ).not.toBe(200);
    expect(
      (await handler(new Request(url.replace("001.png", "link.png")))).status
    ).toBe(404);
    expect((await handler(new Request(url, { method: "POST" }))).status).toBe(
      405
    );
  });
});
