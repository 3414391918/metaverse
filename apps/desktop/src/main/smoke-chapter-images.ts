import { app, clipboard, nativeImage, type BrowserWindow } from "electron";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { crc32, deflateSync } from "node:zlib";
import {
  CommandEnvelopeSchema,
  createEnvelope,
  LongOpenBookResultSchema
} from "@deepwrite/contracts";
import type { UtilitySupervisor } from "./supervisor";
import { workspaceDataPath } from "./workspace-data-path";

const SMOKE_IMAGE_WIDTH = 3072;
const SMOKE_IMAGE_HEIGHT = 2048;

function largeSmokePng(seed: number, width = SMOKE_IMAGE_WIDTH) {
  const chunk = (type: string, data: Buffer) => {
    const value = Buffer.alloc(data.length + 12);
    value.writeUInt32BE(data.length);
    value.write(type, 4);
    data.copy(value, 8);
    value.writeUInt32BE(
      crc32(value.subarray(4, 8 + data.length)),
      8 + data.length
    );
    return value;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width);
  header.writeUInt32BE(SMOKE_IMAGE_HEIGHT, 4);
  header[8] = 8;
  header[9] = 2;
  // Deterministic RGB noise stays around 18 MB after compression, reproducing
  // real chapter-image sizes instead of only exercising one-pixel payloads.
  const stride = width * 3 + 1;
  const pixels = Buffer.alloc(stride * SMOKE_IMAGE_HEIGHT);
  let state = seed;
  for (let row = 0; row < SMOKE_IMAGE_HEIGHT; row++) {
    for (let offset = row * stride + 1; offset < (row + 1) * stride; offset++) {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      pixels[offset] = state & 255;
    }
  }
  return Buffer.concat([
    Buffer.from("89504e470d0a1a0a", "hex"),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(pixels)),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

/** Disposable smoke profile only; runs actual Renderer → Preload → Main → Core → disk. */
export async function runChapterImageSmoke(
  supervisor: UtilitySupervisor,
  window: BrowserWindow
) {
  const profile = app.getPath("userData");
  if (
    process.env.DEEPWRITE_SMOKE !== "1" ||
    !profile.includes("deepwrite-electron-smoke-")
  )
    throw new Error("Image smoke requires the disposable profile.");
  const result = await supervisor.requestCommand(
    "core",
    CommandEnvelopeSchema.parse(
      createEnvelope(
        "long.createBookAtPath",
        {
          parentDirectory: join(profile, "workspace"),
          input: { title: "图片冒烟测试", genre: "悬疑" }
        },
        { id: "cmd_image_smoke_create" }
      )
    )
  );
  if (result.status === "rejected") throw new Error(result.error.message);
  const { book, summary } = LongOpenBookResultSchema.parse(result.payload);
  const registry = JSON.parse(
    await readFile(
      join(await workspaceDataPath(profile), "long-project-registry.json"),
      "utf8"
    )
  ) as { projects: { bookId: string; projectDirectory: string }[] };
  const project = registry.projects.find(
    (item) => item.bookId === book.id
  )?.projectDirectory;
  if (!project || relative(profile, project).startsWith(".."))
    throw new Error("Image smoke project escaped its profile.");
  const chapter = book.workspaceIndex.chapters[0]!;
  const target = {
    bookId: book.id,
    chapterCardId: chapter.chapterCardId,
    filename: "sample.png"
  };
  const body = join(project, chapter.body.path);
  const file = join(dirname(body), "images", target.filename);
  await mkdir(dirname(file));
  await writeFile(
    body,
    "# 测试正文\n\n![测试图](images/sample.png)\n\n" +
      "用于检查预览位置保留的测试段落。\n\n".repeat(300) +
      "唯一查找锚点\n"
  );
  const original = largeSmokePng(20, SMOKE_IMAGE_WIDTH + 1);
  if (original.length < 8 * 1024 * 1024)
    throw new Error("Image smoke fixture must exercise multi-megabyte data");
  await writeFile(file, original);
  const stable = await Promise.all([
    readFile(body),
    readFile(join(project, "long/index.json"))
  ]);
  const previous = {
    text: clipboard.readText(),
    html: clipboard.readHTML(),
    rtf: clipboard.readRTF(),
    image: clipboard.readImage()
  };
  try {
    clipboard.writeImage(nativeImage.createFromBuffer(largeSmokePng(200)));
    const moduleUrl = process.env.DEEPWRITE_SMOKE_CHAPTER_IMAGE_MODULE;
    if (!moduleUrl) throw new Error("Renderer image smoke module unavailable");
    const hash = chapter.body.path.split("/")[2]!;
    const baseUrl = `deepwrite-image://book/${book.id}/${hash}/sample.png`;
    const checked = (await window.webContents.executeJavaScript(
      `(async () => { try { const smoke = await import(${JSON.stringify(moduleUrl)}); return await smoke.runChapterImageRendererSmoke(${JSON.stringify(target)}, ${JSON.stringify(baseUrl)}); } catch (error) { return { smokeError: String(error) }; } })()`
    )) as {
      status: string;
      revision: string;
      filePasteDecoded: boolean;
      previewReopened: boolean;
      smokeError?: string;
    };
    if (checked.smokeError) throw new Error(checked.smokeError);
    const saved = await readFile(file);
    const files = await readdir(dirname(file));
    const transactions = await readdir(
      join(project, ".deepwrite", "transactions")
    );
    if (
      files.length !== 1 ||
      files[0] !== target.filename ||
      transactions.length
    )
      throw new Error("Image replacement left old files in the workspace");
    if (nativeImage.createFromBuffer(saved).isEmpty())
      throw new Error("Saved image is not decodable");
    const copied = clipboard.readImage().toBitmap();
    if (!copied.equals(nativeImage.createFromBuffer(saved).toBitmap()))
      throw new Error("System clipboard differs from the saved image");
    const after = await Promise.all([
      readFile(body),
      readFile(join(project, "long/index.json"))
    ]);
    if (stable.some((value, index) => !value.equals(after[index]!)))
      throw new Error("Replacement changed Markdown or index");
    const url = `${baseUrl}?v=${checked.revision}`;
    const loaded = await window.webContents.executeJavaScript(
      `(async () => { const image = new Image(); image.src = ${JSON.stringify(url)}; await image.decode(); return image.naturalWidth === ${SMOKE_IMAGE_WIDTH} && image.naturalHeight === ${SMOKE_IMAGE_HEIGHT}; })()`
    );
    if (!loaded)
      throw new Error("Replacement did not render through the image protocol");
    const preview = (await window.webContents.executeJavaScript(
      `(async () => { try { const smoke = await import(${JSON.stringify(moduleUrl)}); return await smoke.runLongEditorPreviewSmoke(${JSON.stringify(summary)}, ${JSON.stringify(book.workspaceIndex)}); } catch (error) { return { smokeError: String(error) }; } })()`
    )) as {
      focusPreserved: boolean;
      reopenPreserved: boolean;
      smokeError?: string;
    };
    if (preview.smokeError) throw new Error(preview.smokeError);
    const onIllustrationProgress = ({ message }: { message: string }) => {
      if (message.startsWith("ILLUSTRATION_SMOKE ")) console.info(message);
    };
    window.webContents.on("console-message", onIllustrationProgress);
    let illustration: unknown;
    try {
      illustration = await window.webContents.executeJavaScript(
        `(async () => { const smoke = await import(${JSON.stringify(moduleUrl)}); return await smoke.runChapterIllustrationRendererSmoke(${JSON.stringify(summary)}, ${JSON.stringify(book.workspaceIndex)}); })()`
      );
    } finally {
      window.webContents.off("console-message", onIllustrationProgress);
    }
    const insertedFiles = (await readdir(dirname(file))).sort();
    if (insertedFiles.join(",") !== "001.png,002.png,sample.png")
      throw new Error(
        "Illustration creation changed existing image files or numbering"
      );
    const insertedBody = await readFile(body, "utf8");
    if (
      !insertedBody.includes("![](images/001.png)") ||
      !insertedBody.includes("![](images/002.png)")
    )
      throw new Error(
        "Illustration references were not persisted to the original body"
      );
    return {
      status: "ok",
      copied: true,
      replaced: true,
      reopened: true,
      referenceUnchanged: true,
      rendered: true,
      staleRejected: true,
      imageBytes: saved.length,
      filePasteDecoded: checked.filePasteDecoded,
      previewReopened: checked.previewReopened,
      ...preview,
      illustration
    };
  } finally {
    clipboard.write({
      text: previous.text,
      html: previous.html,
      rtf: previous.rtf,
      ...(!previous.image.isEmpty() ? { image: previous.image } : {})
    });
  }
}
