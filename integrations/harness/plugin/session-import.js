/* global Response */
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { URL } from "node:url";
import { isDeepStrictEqual, TextDecoder } from "node:util";

const MAX_ZIP_BYTES = 100 * 1024 * 1024;
const MAX_UNPACKED_BYTES = 300 * 1024 * 1024;
const MAX_ENTRIES = 2048;
const LOG_NAME = /^session\.v(\d+)\.jsonl$/u;
const CHILD_LOG = /^subagents\/([A-Za-z0-9_-]+)\/(session\.v\d+\.jsonl)$/u;
const IMAGE_EXT = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif"
};
const decoder = new TextDecoder("utf-8", { fatal: true });

export class ImportError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function fail(message) {
  throw new ImportError(message);
}

function safeEntry(name) {
  if (
    name.startsWith("/") ||
    name.includes("\\") ||
    name.split("/").some((part) => part === "" || part === "." || part === "..")
  )
    fail("ZIP 包含无效路径。");
  if (
    !LOG_NAME.test(name) &&
    !CHILD_LOG.test(name) &&
    !/^media\/[A-Za-z0-9:_-]+\.(?:png|jpg|webp|gif)$/u.test(name) &&
    !/^files\/[a-f\d]{2}\/[a-f\d]{64}\/[^/]+$/u.test(name)
  )
    fail(`ZIP 包含不支持的条目：${name}`);
}

/** Stream decompression with explicit compressed and expanded size limits. */
export async function unpackExport(body, fflate, signal) {
  if (!body) fail("请选择 ZIP 会话文件。");
  const entries = new Map();
  let compressed = 0;
  let expanded = 0;
  let problem;
  const unzip = new fflate.Unzip((file) => {
    try {
      safeEntry(file.name);
      if (entries.has(file.name) || entries.size >= MAX_ENTRIES)
        fail("ZIP 中存在重复条目或条目过多。");
      if (file.compression !== 0 && file.compression !== 8)
        fail("ZIP 使用了不支持的压缩格式。");
      if (file.originalSize > MAX_UNPACKED_BYTES)
        fail("ZIP 解压后的内容过大。");
      const parts = [];
      let size = 0;
      file.ondata = (error, chunk, final) => {
        if (error) {
          problem = error;
          return;
        }
        size += chunk.length;
        expanded += chunk.length;
        if (expanded > MAX_UNPACKED_BYTES) {
          problem = new ImportError("ZIP 解压后的内容超过 300 MB。");
          return;
        }
        parts.push(chunk);
        if (final) entries.set(file.name, Buffer.concat(parts, size));
      };
      file.start();
    } catch (error) {
      problem = error;
    }
  });
  unzip.register(fflate.UnzipInflate);
  try {
    for await (const chunk of body) {
      signal?.throwIfAborted();
      compressed += chunk.length;
      if (compressed > MAX_ZIP_BYTES) fail("ZIP 文件不能超过 100 MB。");
      if (problem) throw problem;
      unzip.push(chunk);
      if (problem) throw problem;
    }
    unzip.push(new Uint8Array(), true);
    if (problem) throw problem;
  } catch (error) {
    if (error instanceof ImportError) throw error;
    fail("无法读取 ZIP 文件，请选择本应用导出的会话日志。");
  }
  if (entries.size === 0) fail("ZIP 没有可导入的内容。");
  return entries;
}

function parseLog(bytes, catalog, name) {
  let lines;
  try {
    lines = decoder.decode(bytes).trimEnd().split("\n");
  } catch {
    fail(`日志 ${name} 不是有效的 UTF-8 文件。`);
  }
  if (lines.length < 1 || lines.length > 1_000_000)
    fail(`日志 ${name} 无效或过长。`);
  let header;
  try {
    header = JSON.parse(lines[0]);
  } catch {
    fail(`日志 ${name} 的会话头无效。`);
  }
  if (
    !header ||
    header.type !== "session" ||
    !Number.isInteger(header.version) ||
    name.split("/").at(-1) !== `session.v${header.version}.jsonl`
  )
    fail(`日志 ${name} 的格式版本不匹配。`);
  try {
    const restore = catalog.createRestore(header, {
      recovery: "strict",
      validation: "current"
    });
    for (const line of lines.slice(1)) {
      if (!line) fail(`日志 ${name} 包含空记录。`);
      restore.decodeRow(JSON.parse(line));
    }
    return restore.finish();
  } catch (error) {
    fail(
      `日志 ${name} 无法恢复：${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function fileName(ref) {
  const digest = String(ref.attachmentId).replace(/^sha256:/u, "");
  const name = ref.name.replace(/[\\/\u0000-\u001f\u007f]/gu, "_");
  return `files/${digest.slice(0, 2)}/${digest}/${["", ".", ".."].includes(name) ? "file" : name}`;
}

function referencePaths(artifacts) {
  const refs = new Map();
  const collect = (content) => {
    if (!Array.isArray(content)) return;
    for (const block of content) {
      if (
        !block ||
        (block.type !== "image" && block.type !== "file") ||
        !block.attachment
      )
        continue;
      const ref = block.attachment;
      if (typeof ref.attachmentId !== "string" || typeof ref.bytes !== "number")
        fail("日志中包含无效的附件引用。");
      const path =
        block.type === "image"
          ? `media/${ref.attachmentId}.${IMAGE_EXT[ref.mediaType] ?? "invalid"}`
          : typeof ref.name === "string"
            ? fileName(ref)
            : null;
      if (!path || path.endsWith(".invalid"))
        fail("日志中包含不支持的附件引用。");
      refs.set(path, { kind: block.type, ref });
    }
  };
  for (const artifact of artifacts)
    for (const event of artifact.events) {
      const data = event.data;
      if (!data || typeof data !== "object") continue;
      switch (event.type) {
        case "user/message":
        case "tool/ptc-dispatch":
          collect(data.content);
          break;
        case "system/message":
        case "developer/message":
        case "tool/result":
        case "team/message/queued":
          collect(data.message?.content);
          break;
        case "agent/inbox/spliced":
          if (Array.isArray(data.inserted))
            for (const message of data.inserted) collect(message?.content);
          break;
        case "compaction/summary":
          collect(data.summary);
          collect(data.rawOutput);
          break;
        case "assistant/message":
          collect(data.message?.content);
        // fall through: completed stream blocks can also reference attachments.
        case "assistant/attempt":
          if (Array.isArray(data.stream))
            for (const record of data.stream)
              if (
                record?.type === "chunk" &&
                record.chunk?.type === "block-end"
              )
                collect([record.chunk.block]);
          break;
        default:
          break;
      }
    }
  return refs;
}

export function prepareExport(entries, catalog) {
  const logs = [...entries.keys()].filter(
    (path) => LOG_NAME.test(path) || CHILD_LOG.test(path)
  );
  const roots = logs.filter((path) => LOG_NAME.test(path));
  if (roots.length !== 1) fail("ZIP 必须包含一份根会话日志。");
  const root = parseLog(entries.get(roots[0]), catalog, roots[0]);
  if (root.header.parentSession || root.header.origin === "subagent")
    fail("ZIP 的根日志不是主会话。");
  const artifacts = [root];
  const ids = new Set([root.header.id]);
  for (const path of logs.filter((item) => item !== roots[0])) {
    const artifact = parseLog(entries.get(path), catalog, path);
    if (!artifact.header.parentSession || ids.has(artifact.header.id))
      fail("子会话关系无效或会话 ID 重复。");
    ids.add(artifact.header.id);
    artifacts.push(artifact);
  }
  for (const artifact of artifacts.slice(1))
    if (!ids.has(artifact.header.parentSession))
      fail("ZIP 缺少子会话的父会话。");
  const refs = referencePaths(artifacts);
  for (const [path, { ref }] of refs) {
    const bytes = entries.get(path);
    if (!bytes || bytes.length !== ref.bytes)
      fail(`ZIP 缺少或损坏了附件：${path}`);
    const digest = createHash("sha256").update(bytes).digest("hex");
    if (String(ref.attachmentId).replace(/^sha256:/u, "") !== digest)
      fail(`ZIP 的附件校验失败：${path}`);
  }
  for (const path of entries.keys())
    if (!logs.includes(path) && !refs.has(path))
      fail(`ZIP 包含未被会话引用的文件：${path}`);
  return { root, artifacts, refs };
}

async function restoreAttachments(entries, refs, store) {
  for (const [path, { kind, ref }] of refs) {
    const bytes = entries.get(path);
    const stored =
      kind === "image"
        ? await store.saveImage({
            data: bytes,
            mediaType: ref.mediaType,
            name: ref.name
          })
        : await store.saveFile({ data: bytes, name: ref.name });
    if (
      stored.attachmentId !== ref.attachmentId ||
      stored.bytes !== ref.bytes ||
      (kind === "image" &&
        (stored.mediaType !== ref.mediaType ||
          stored.width !== ref.width ||
          stored.height !== ref.height))
    )
      fail(`附件恢复后与原引用不一致：${path}`);
  }
}

export async function importExport(entries, catalog, ctx, workspaceRoot) {
  const prepared = prepareExport(entries, catalog);
  const { root, artifacts, refs } = prepared;
  const existing = await Promise.all(
    artifacts.map((artifact) => ctx.sessionPersistence.stat(artifact.header.id))
  );
  const workspace = await ctx.workspaceRegistry.resolveByPath(workspaceRoot);
  if (!workspace) throw new ImportError("当前工作区不可用。", 503);
  if (existing.some(Boolean)) {
    if (existing.some((item) => !item))
      throw new ImportError("会话 ID 与现有数据冲突，无法完整导入。", 409);
    for (const artifact of artifacts) {
      const handle = await ctx.sessionPersistence.open(
        artifact.header.id,
        "read"
      );
      try {
        const expectedHeader = { ...artifact.header, cwd: workspaceRoot };
        const actualHeader = {
          ...handle.header,
          delegationDepth: handle.header.delegationDepth ?? 0
        };
        const { events } = await handle.read();
        if (
          !isDeepStrictEqual(actualHeader, expectedHeader) ||
          handle.inheritedEventCount !== artifact.inheritedEventCount ||
          !isDeepStrictEqual(events, artifact.events)
        )
          throw new ImportError(
            "同 ID 会话已存在且内容不同，请切换到另一工作目录导入。",
            409
          );
      } finally {
        await handle.close();
      }
    }
    await restoreAttachments(entries, refs, ctx.attachments);
    await workspace.attachSession(root.header.id);
    await ctx.workspaceRegistry.unarchiveSession(root.header.id);
    return {
      sessionId: root.header.id,
      childCount: artifacts.length - 1,
      reused: true
    };
  }
  await restoreAttachments(entries, refs, ctx.attachments);
  const remaining = [...artifacts];
  const written = new Set();
  while (remaining.length) {
    const index = remaining.findIndex(
      (item) =>
        !item.header.parentSession || written.has(item.header.parentSession)
    );
    if (index < 0) fail("子会话之间存在循环引用。");
    const [artifact] = remaining.splice(index, 1);
    const header = { ...artifact.header, cwd: workspaceRoot };
    const handle = await ctx.sessionPersistence.create(header, {
      ...(header.isSeeded
        ? { inheritedEventCount: artifact.inheritedEventCount }
        : {})
    });
    try {
      for (let index = 0; index < artifact.events.length; index += 1000)
        await handle.append(artifact.events.slice(index, index + 1000));
      await handle.flush();
    } finally {
      await handle.close();
    }
    written.add(header.id);
  }
  await workspace.attachSession(root.header.id);
  return { sessionId: root.header.id, childCount: artifacts.length - 1 };
}

export async function registerSessionImport(ctx, workspaceRoot) {
  const requireRuntime = createRequire(
    new URL("../runtime/launch.mjs", import.meta.url)
  );
  const { Unzip, UnzipInflate } = requireRuntime("fflate");
  const { sessionFormatCatalog } = requireRuntime(
    "@deepseek-ai/dsh-session-format-catalog"
  );
  return ctx.connection.fetch.register({
    path: "/api/metaverse.session.import",
    methods: ["POST"],
    requestBody: "streaming",
    fetch: async (request) => {
      try {
        const entries = await unpackExport(
          request.body,
          { Unzip, UnzipInflate },
          request.signal
        );
        return Response.json(
          await importExport(entries, sessionFormatCatalog, ctx, workspaceRoot)
        );
      } catch (error) {
        const expected = error instanceof ImportError;
        if (!expected)
          ctx.logger.error("metaverse: session import failed", error);
        return Response.json(
          {
            error: expected
              ? error.message
              : "导入会话失败，请检查 ZIP 文件和应用日志。"
          },
          {
            status: expected ? error.status : 500
          }
        );
      }
    }
  });
}
