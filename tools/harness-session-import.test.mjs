import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";
import {
  importExport,
  prepareExport,
  unpackExport
} from "../integrations/harness/plugin/session-import.js";

const runtime = createRequire(
  new URL("../apps/harness/package.json", import.meta.url)
);
const fflate = runtime("fflate");
const { sessionFormatCatalog } = runtime(
  "@deepseek-ai/dsh-session-format-catalog"
);
const root = "/tmp/metaverse-import-test";

function log(id, parentSession) {
  return Buffer.from(
    `${JSON.stringify({
      type: "session",
      version: 4,
      id,
      createdAt: 1000,
      cwd: "/other/computer",
      isSeeded: false,
      delegationDepth: parentSession ? 1 : 0,
      ...(parentSession ? { parentSession, origin: "subagent" } : {})
    })}\n`
  );
}

function completedTurnLog(imageRef) {
  const rows = [
    { type: "turn/start", data: { turn: 1 } },
    { type: "step/start", data: { turn: 1, step: 1 } },
    {
      type: "request/header",
      data: {
        reason: "initial",
        header: {
          config: { provider: "mock", model: "mock" }
        }
      }
    },
    {
      type: "user/message",
      surfaceOp: "append",
      data: {
        id: "question",
        role: "user",
        source: { kind: "user" },
        content: imageRef
          ? [{ type: "image", attachment: imageRef }]
          : [{ type: "text", text: "继续这个故事" }]
      }
    },
    {
      type: "assistant/message",
      surfaceOp: "append",
      data: {
        turn: 1,
        step: 1,
        stream: [],
        message: {
          id: "answer",
          role: "assistant",
          source: { kind: "model", provider: "mock", model: "mock" },
          content: [{ type: "text", text: "好的" }]
        }
      }
    },
    { type: "step/end", data: { turn: 1, step: 1 } },
    { type: "turn/end", data: { turn: 1, reason: { kind: "completed" } } }
  ].map((row, seq) => ({ ...row, seq, time: 1001 + seq }));
  return Buffer.concat([
    log("conversation"),
    Buffer.from(`${rows.map((row) => JSON.stringify(row)).join("\n")}\n`)
  ]);
}

function archive(entries) {
  return fflate.zipSync(
    Object.fromEntries(
      Object.entries(entries).map(([name, data]) => [
        name,
        new Uint8Array(data)
      ])
    )
  );
}

async function unpack(bytes) {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(bytes.subarray(0, 11));
      controller.enqueue(bytes.subarray(11));
      controller.close();
    }
  });
  return unpackExport(stream, fflate);
}

describe("Harness session ZIP import", () => {
  it("restores a completed turn with its user and assistant messages", async () => {
    const entries = await unpack(
      archive({ "session.v4.jsonl": completedTurnLog() })
    );
    const prepared = prepareExport(entries, sessionFormatCatalog);
    expect(prepared.root.events.map((event) => event.type)).toContain(
      "assistant/message"
    );
    expect(
      prepared.root.events.find((event) => event.type === "user/message")?.data
        .content[0].text
    ).toBe("继续这个故事");
  });

  it("restores a root and child log under the current workspace and opens write handles", async () => {
    const entries = await unpack(
      archive({
        "session.v4.jsonl": log("root"),
        "subagents/child/session.v4.jsonl": log("child", "root")
      })
    );
    const written = [];
    const attachSession = vi.fn(async () => {});
    const ctx = {
      sessionPersistence: {
        stat: async () => undefined,
        create: async (header, options) => {
          written.push({ header, options });
          return {
            append: async () => {},
            flush: async () => {},
            close: async () => {}
          };
        }
      },
      workspaceRegistry: { resolveByPath: async () => ({ attachSession }) },
      attachments: {}
    };
    const result = await importExport(entries, sessionFormatCatalog, ctx, root);
    expect(result).toEqual({ sessionId: "root", childCount: 1 });
    expect(written.map((item) => [item.header.id, item.header.cwd])).toEqual([
      ["root", root],
      ["child", root]
    ]);
    expect(attachSession).toHaveBeenCalledWith("root");
  });

  it("rejects conflicting IDs before any storage write", async () => {
    const entries = await unpack(archive({ "session.v4.jsonl": log("root") }));
    const create = vi.fn();
    await expect(
      importExport(
        entries,
        sessionFormatCatalog,
        {
          sessionPersistence: {
            stat: async () => ({}),
            open: async () => ({
              header: { id: "root", cwd: root, version: 4 },
              inheritedEventCount: 0,
              read: async () => ({ events: [] }),
              close: async () => {}
            }),
            create
          },
          workspaceRegistry: { resolveByPath: async () => ({}) },
          attachments: {}
        },
        root
      )
    ).rejects.toMatchObject({ status: 409 });
    expect(create).not.toHaveBeenCalled();
  });

  it("reopens an identical archived conversation without duplicating its log", async () => {
    const entries = await unpack(archive({ "session.v4.jsonl": log("root") }));
    const artifact = prepareExport(entries, sessionFormatCatalog).root;
    const attachSession = vi.fn(async () => {});
    const unarchiveSession = vi.fn(async () => {});
    const create = vi.fn();
    const result = await importExport(
      entries,
      sessionFormatCatalog,
      {
        sessionPersistence: {
          stat: async () => ({}),
          open: async () => ({
            header: { ...artifact.header, cwd: root },
            inheritedEventCount: 0,
            read: async () => ({ events: artifact.events }),
            close: async () => {}
          }),
          create
        },
        workspaceRegistry: {
          resolveByPath: async () => ({ attachSession }),
          unarchiveSession
        },
        attachments: {}
      },
      root
    );
    expect(result.reused).toBe(true);
    expect(unarchiveSession).toHaveBeenCalledWith("root");
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects a traversal entry and unrelated file", async () => {
    await expect(
      unpack(archive({ "../evil": Buffer.from("x") }))
    ).rejects.toThrow(/无效路径/);
    const entries = await unpack(
      archive({
        "session.v4.jsonl": log("root"),
        "media/unused.png": Buffer.from("x")
      })
    );
    expect(() => prepareExport(entries, sessionFormatCatalog)).toThrow(
      /未被会话引用/
    );
  });

  it("refuses modified content-addressed media before creating a session", () => {
    const actual = Buffer.from("tampered");
    const digest = createHash("sha256")
      .update(Buffer.from("expected"))
      .digest("hex");
    const ref = {
      attachmentId: `sha256:${digest}`,
      mediaType: "image/png",
      bytes: actual.length,
      width: 1,
      height: 1
    };
    const entries = new Map([
      ["session.v4.jsonl", completedTurnLog(ref)],
      [`media/${ref.attachmentId}.png`, actual]
    ]);
    expect(() => prepareExport(entries, sessionFormatCatalog)).toThrow(
      /附件校验失败/
    );
  });
});
