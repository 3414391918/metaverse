import { createPinia, setActivePinia } from "pinia";
import { nextTick } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useConversationStore } from "./conversationStore";
import { conversationHistoryPersistenceKey } from "../utils/conversationPersistenceKeys";
import { useAgentConversation } from "../composables/useAgentConversation";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function settleCheckpoint() {
  await nextTick();
  for (let turn = 0; turn < 12; turn += 1) await Promise.resolve();
}

function harness() {
  vi.useFakeTimers();
  setActivePinia(createPinia());
  const store = useConversationStore();
  const disk = new Map<string, unknown>();
  const key = conversationHistoryPersistenceKey("book:interruption");
  let close!: () => Promise<void>;
  const save = vi.fn(async (key: string, value: unknown) => {
    disk.set(key, structuredClone(value));
  });
  store.configurePersistenceAdapter({
    onBeforeClose(handler) {
      close = handler;
      return () => undefined;
    },
    load: async (loadKey) => disk.get(loadKey),
    save
  });
  const controller = useAgentConversation({
    api: () => undefined,
    onPersistenceChange: () =>
      store.schedulePersistenceFactory(
        key,
        controller.capturePersistenceSnapshot
      )
  });
  store.registerController("book:interruption", "general", controller);
  return { store, controller, disk, key, save, close: () => close() };
}

function runningAssistant(h: ReturnType<typeof harness>) {
  h.controller.messages.value = [
    {
      id: "user-interrupted",
      role: "user",
      content: "请完成这一轮写作",
      createdAt: "2026-09-07T00:00:00.000Z",
      status: "completed"
    },
    {
      id: "message_interrupted",
      role: "assistant",
      runId: "run_interrupted",
      content: "",
      createdAt: "2026-09-07T00:00:01.000Z",
      status: "streaming"
    }
  ];
}

function appendDelta(
  h: ReturnType<typeof harness>,
  chunk: string,
  status: "streaming" | "error" | "stopped" = "streaming"
) {
  const messages = h.controller.messages.value;
  const last = messages.at(-1);
  if (!last || last.role !== "assistant") throw new Error("no assistant");
  last.content = `${last.content}${chunk}`;
  last.status = status;
}

function reopen(h: ReturnType<typeof harness>) {
  return useAgentConversation({
    api: () => undefined,
    initialPersistenceSnapshot: h.disk.get(h.key)
  });
}

describe("conversation persistence during interruption", () => {
  it("checkpoints continuous history updates without waiting for silence", async () => {
    const h = harness();
    runningAssistant(h);
    appendDelta(h, "第一段");
    await vi.advanceTimersByTimeAsync(300);
    await settleCheckpoint();
    const interrupted = reopen(h);
    expect(
      interrupted.messages.value.some((m) => m.content === "请完成这一轮写作")
    ).toBe(true);
    expect(interrupted.messages.value.at(-1)?.content).toContain("第一段");
    interrupted.dispose();

    const writes = h.save.mock.calls.length;
    for (let index = 0; index < 30; index += 1) {
      appendDelta(h, "后续段落");
      await vi.advanceTimersByTimeAsync(100);
    }
    expect(h.save.mock.calls.length).toBeGreaterThan(writes);
    const restored = reopen(h);
    expect(restored.messages.value.at(-1)?.content).toContain("后续段落");
    restored.dispose();
    await h.store.dispose({ flush: false });
  });

  it("recovers a legacy running message as persisted history without any runtime abort", async () => {
    const h = harness();
    runningAssistant(h);
    appendDelta(h, "中断前已经生成的内容");
    await settleCheckpoint();
    await h.store.dispose({ flush: false });
    const restored = reopen(h);
    expect(
      restored.messages.value.some((m) =>
        m.content.includes("中断前已经生成的内容")
      )
    ).toBe(true);
    expect(restored.messages.value.at(-1)?.status).toBe("stopped");
    restored.dispose();
  });

  it("flushes the errored reply state even if the app immediately loses its renderer", async () => {
    const h = harness();
    runningAssistant(h);
    appendDelta(h, "失败前已经生成的内容", "error");
    const sessionId = h.controller.sessionId.value;
    await settleCheckpoint();
    await h.store.dispose({ flush: false });
    const restored = reopen(h);
    expect(restored.sessionId.value).toBe(sessionId);
    expect(
      restored.messages.value.some((m) =>
        m.content.includes("失败前已经生成的内容")
      )
    ).toBe(true);
    expect(restored.messages.value.at(-1)?.status).toBe("error");
    restored.dispose();
  });

  it("waits for the final queued write before acknowledging a normal close", async () => {
    const h = harness();
    runningAssistant(h);
    appendDelta(h, "正常关闭前的内容");
    await vi.advanceTimersByTimeAsync(300);
    appendDelta(h, "最后一段待保存内容", "stopped");
    let finish!: () => void;
    h.save.mockImplementationOnce(async (key, value) => {
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
      h.disk.set(key, structuredClone(value));
    });
    let closed = false;
    const closing = h.close().then(() => {
      closed = true;
    });
    await settleCheckpoint();
    await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
    expect(closed).toBe(false);
    finish();
    await closing;
    const restored = reopen(h);
    expect(
      restored.messages.value.some((m) =>
        m.content.includes("正常关闭前的内容")
      )
    ).toBe(true);
    expect(restored.messages.value.at(-1)?.status).toBe("stopped");
    restored.dispose();
    await h.store.dispose({ flush: false });
  });

  it("keeps failed writes for a later close retry without requiring a new message", async () => {
    const h = harness();
    h.controller.messages.value = [
      {
        id: "sent-first",
        role: "user",
        content: "已发送的消息",
        createdAt: "2026-09-07T00:00:00.000Z"
      }
    ];
    h.controller.draft.value = "必须保留的草稿";
    h.save.mockRejectedValueOnce(new Error("模拟磁盘暂时不可写"));
    await expect(h.close()).rejects.toThrow("模拟磁盘暂时不可写");
    await expect(h.close()).resolves.toBeUndefined();
    const restored = reopen(h);
    expect(restored.draft.value).toBe("必须保留的草稿");
    restored.dispose();
    await h.store.dispose({ flush: false });
  });

  it("includes history still waiting for the next animation frame when closing", async () => {
    const h = harness();
    runningAssistant(h);
    await h.store.flushPersistence();
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn(() => 1)
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    appendDelta(h, "尚未绘制的最后一段");
    await h.close();
    const restored = reopen(h);
    expect(
      restored.messages.value.some((m) =>
        m.content.includes("尚未绘制的最后一段")
      )
    ).toBe(true);
    restored.dispose();
    await h.store.dispose({ flush: false });
  });

  it("loads the final pending snapshot when a conversation is immediately closed and reopened", async () => {
    const h = harness();
    runningAssistant(h);
    appendDelta(h, "关闭前已经保存的内容");
    await h.store.flushPersistence();
    appendDelta(h, "尚在队列中的最新内容");
    h.store.removeController("book:interruption");
    const restored = useAgentConversation({
      api: () => undefined,
      initialPersistenceSnapshot: await h.store.loadPersistence(h.key)
    });
    expect(
      restored.messages.value.some((message) =>
        message.content.includes("尚在队列中的最新内容")
      )
    ).toBe(true);
    restored.dispose();
    await h.store.dispose({ flush: false });
  });
});
