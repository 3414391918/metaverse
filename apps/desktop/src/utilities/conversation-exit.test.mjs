import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPinia, setActivePinia } from "pinia";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  TestRendererStateStore as RendererStateStore,
  closeRendererStateTestStores
} from "./renderer-state-store.test-support.ts";
import { createConversationPersistenceAdapter } from "../renderer/src/utils/conversationPersistence.ts";
import { conversationHistoryPersistenceKey } from "../renderer/src/utils/conversationPersistenceKeys.ts";
import { useConversationStore } from "../renderer/src/stores/conversationStore.ts";
import { useAgentConversation } from "../renderer/src/composables/useAgentConversation.test-support.ts";

const cleanups = [];
afterEach(async () => {
  await closeRendererStateTestStores();
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
  vi.restoreAllMocks();
});

async function harness() {
  const directory = await mkdtemp(join(tmpdir(), "deepwrite-child-close-"));
  cleanups.push(() => rm(directory, { recursive: true, force: true }));
  const disk = new RendererStateStore(directory);
  setActivePinia(createPinia());
  const store = useConversationStore();
  let close;
  store.configurePersistenceAdapter(
    createConversationPersistenceAdapter({
      onBeforeClose(handler) {
        close = handler;
        return () => undefined;
      },
      load: (key) => disk.load(key),
      save: (key, value) => disk.save(key, value),
      remove: (key) => disk.remove(key),
      migrateHistory: (input) => disk.migrateHistory(input),
      listHistoryKeys: () => disk.listHistoryKeys()
    })
  );
  cleanups.push(() => store.dispose());
  const key = conversationHistoryPersistenceKey("book:child-close");
  const conversation = useAgentConversation({
    // Execution lives in the external assistant harness: the desktop
    // controller only loads, displays and persists the conversation.
    api: () => undefined,
    initialMessages: Array.from({ length: 25 }, (_, index) => [
      {
        id: `user-${index}`,
        role: "user",
        content: `第 ${index + 1} 轮问题`,
        createdAt: "2026-09-10T00:00:00.000Z"
      },
      {
        id: `assistant-${index}`,
        role: "assistant",
        content: `第 ${index + 1} 轮回复`,
        status: "completed",
        createdAt: "2026-09-10T00:00:01.000Z"
      }
    ]).flat(),
    onPersistenceChange: () =>
      store.schedulePersistenceFactory(
        key,
        conversation.capturePersistenceSnapshot
      )
  });
  store.registerController("book:child-close", "general", conversation);
  conversation.draft.value = "建立世界观";
  conversation.messages.value.push({
    id: "late-user",
    role: "user",
    content: "关闭前最后一条提问",
    createdAt: "2026-09-10T00:00:02.000Z"
  });
  return {
    conversation,
    close: () => close(),
    directory,
    key,
    store
  };
}

describe("closing and reopening a persisted conversation", () => {
  it("flushes pending conversation persistence through the close handler", async () => {
    const h = await harness();
    expect(h.conversation.messages.value).toHaveLength(51);
    await h.close();
    const saved = await new RendererStateStore(h.directory).load(h.key);
    expect(saved.conversations).toHaveLength(1);
    expect(saved.conversations[0].messages).toHaveLength(51);
    expect(saved.conversations[0].draft).toBe("建立世界观");
  });

  it("reloads the complete conversation from disk after a normal exit", async () => {
    const h = await harness();
    await h.close();
    const restored = useAgentConversation({
      api: () => undefined,
      initialPersistenceSnapshot: await new RendererStateStore(
        h.directory
      ).load(h.key)
    });
    cleanups.push(async () => restored.dispose());
    expect(restored.messages.value).toHaveLength(51);
    expect(restored.messages.value[0]?.content).toBe("第 1 轮问题");
    expect(restored.messages.value[49]?.content).toBe("第 25 轮回复");
    expect(restored.messages.value[50]?.content).toBe("关闭前最后一条提问");
    expect(restored.draft.value).toBe("建立世界观");
  });
});
