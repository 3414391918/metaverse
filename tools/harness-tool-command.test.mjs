import { describe, expect, it, vi } from "vitest";
import {
  beginToolCommand,
  createToolClaim,
  createToolRestoreSource,
  parseToolRequest
} from "../integrations/harness/plugin/tool-command.js";

describe("assistant tool command", () => {
  const tool = {
    name: "创作工具",
    directory: "/workspace/tools/writing",
    entryFile: "SKILL.md"
  };

  it("submits the current Session face and preserves the user's task", async () => {
    const face = { beginSubmission: vi.fn() };
    const sessions = { binding: vi.fn(() => ({ session: face })) };
    const conversation = {
      sendSession: vi.fn(async () => ({ kind: "success" }))
    };
    const claim = createToolClaim(tool, "session-1", sessions, conversation);
    await expect(
      claim.submit("扩写第六章，保留已有对白。", {})
    ).resolves.toEqual({
      kind: "success"
    });
    expect(conversation.sendSession).toHaveBeenCalledWith(
      face,
      expect.stringContaining("扩写第六章，保留已有对白。"),
      [],
      "queue"
    );
  });

  it("switches an old Venice session to the working default before a tool request", async () => {
    const face = {
      projections: {
        faceOf: () => ({
          getSnapshot: () => ({
            next: { provider: "venice", model: "venice-uncensored-1-2" }
          })
        })
      }
    };
    const sessions = { binding: () => ({ session: face }) };
    const conversation = {
      sendSession: vi.fn(async () => ({ kind: "success" }))
    };
    const remoteSession = {
      selectModel: vi.fn(async () => ({ ok: true, value: {} }))
    };
    const claim = createToolClaim(
      tool,
      "session-1",
      sessions,
      conversation,
      remoteSession
    );
    await claim.submit("扩写第六章", {});
    expect(remoteSession.selectModel).toHaveBeenCalledWith({
      sessionId: "session-1",
      provider: "venice",
      model: "qwen-3-6-plus"
    });
    expect(remoteSession.selectModel.mock.invocationCallOrder[0]).toBeLessThan(
      conversation.sendSession.mock.invocationCallOrder[0]
    );
  });

  it("inserts a tool chip without consuming an existing prompt or slash path", () => {
    const beginCommand = vi.fn(() => true);
    const input = {
      state: {
        getSnapshot: () => ({
          draft: "/Users/project 扩写第六章",
          draftRev: 4
        })
      },
      beginCommand
    };
    expect(beginToolCommand(input, { name: "tool", token: "/创作工具 " })).toBe(
      true
    );
    expect(beginCommand).toHaveBeenCalledWith(expect.anything(), {
      start: 0,
      end: 0,
      draftRev: 4
    });
  });

  it("replaces only the typed /tool trigger before the task", () => {
    const beginCommand = vi.fn(() => true);
    const input = {
      state: {
        getSnapshot: () => ({ draft: "/tool 扩写第六章", draftRev: 2 })
      },
      beginCommand
    };
    beginToolCommand(input, { name: "tool", token: "/创作工具 " });
    expect(beginCommand).toHaveBeenCalledWith(expect.anything(), {
      start: 0,
      end: 6,
      draftRev: 2
    });
  });

  it("consumes the bare slash left by the add menu", () => {
    const beginCommand = vi.fn(() => true);
    beginToolCommand({
      state: { getSnapshot: () => ({ draft: "/", draftRev: 3 }) },
      beginCommand
    }, { name: "tool", token: "/创作工具 " });
    expect(beginCommand).toHaveBeenCalledWith(expect.anything(), {
      start: 0, end: 1, draftRev: 3
    });
  });

  it("moves the caret after the tool and existing task once the picker closes", () => {
    const claim = { name: "tool", token: "/创作工具 " };
    let snapshot = { draft: "/", draftRev: 1 };
    const insertText = vi.fn(() => true);
    const focus = vi.fn();
    let afterPicker;
    const input = {
      state: { getSnapshot: () => snapshot },
      beginCommand: vi.fn(() => {
        snapshot = {
          draft: "/创作工具 扩写",
          draftRev: 2,
          claim: { name: "tool", token: claim.token },
          occurrences: []
        };
        return true;
      }),
      actions: { insertText },
      editor: { focus }
    };
    expect(beginToolCommand(input, claim, (callback) => { afterPicker = callback; })).toBe(true);
    expect(insertText).not.toHaveBeenCalled();
    afterPicker();
    expect(insertText).toHaveBeenCalledWith("", {
      start: 4, end: 4, draftRev: 2
    });
    expect(focus).toHaveBeenCalledOnce();
  });

  it("does not move the caret after the user continues typing", () => {
    const claim = { name: "tool", token: "/创作工具 " };
    let snapshot = { draft: "/", draftRev: 1 };
    const insertText = vi.fn(() => true);
    let afterPicker;
    const input = {
      state: { getSnapshot: () => snapshot },
      beginCommand: () => {
        snapshot = { draft: "/创作工具 ", draftRev: 2, claim: { name: "tool", token: claim.token } };
        return true;
      },
      actions: { insertText },
      editor: { focus: vi.fn() }
    };
    beginToolCommand(input, claim, (callback) => { afterPicker = callback; });
    snapshot = { ...snapshot, draft: "/创作工具 新输入", draftRev: 3 };
    afterPicker();
    expect(insertText).not.toHaveBeenCalled();
  });

  it("parses the model-facing instruction for compact user-bubble rendering", () => {
    const request = '请使用元宇宙工具「创作工具」完成下面的任务。先读取工具入口 "/workspace/tools/writing/SKILL.md"，再按工具说明执行。\n\n扩写第六章';
    expect(parseToolRequest(request)).toEqual({ name: "创作工具", task: "扩写第六章" });
  });

  it("restores a saved tool chip from its visible token", async () => {
    const sessions = { binding: () => ({ session: {} }) };
    const conversation = { sendSession: vi.fn() };
    const source = createToolRestoreSource(async () => [tool], sessions, conversation);
    const claim = await source.matchClaim({ sessionId: "s1" }, "/创作工具", new AbortController().signal);
    expect(claim?.token).toBe("/创作工具 ");
    expect(await source.matchClaim({ sessionId: "s1" }, "/不存在", new AbortController().signal)).toBeUndefined();
  });
});
