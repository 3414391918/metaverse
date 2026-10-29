import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import {
  ConversationHistoryBatchSchema,
  ConversationHistoryStageSchema
} from "@deepwrite/contracts";
import { ConversationDatabase } from "./conversation-storage/database";
import { createConversationPersistenceState } from "../renderer/src/stores/conversationPersistenceState";
import { loadConversationHistoryRecord } from "../renderer/src/utils/conversationHistoryRecordLoader";
import { useAgentConversation } from "../renderer/src/composables/useAgentConversation";

const key = "conversation-history:hydration-integration";
const date = "2026-09-11T00:00:00.000Z";
const cleanup = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});

it("holds automatic writes while history hydration is in flight and flushes the complete record on close", async () => {
  const directory = await mkdtemp(join(tmpdir(), "deepwrite-hydration-"));
  cleanup.push(() => rm(directory, { recursive: true, force: true }));
  const database = new ConversationDatabase(join(directory, "history.sqlite"));
  cleanup.push(() => database.close());
  const history = {
    commit: async (batch) =>
      database.commit(ConversationHistoryBatchSchema.parse(batch)),
    stage: async (batch) =>
      database.stage(ConversationHistoryStageSchema.parse(batch)),
    session: async (query) => database.session(query),
    list: async (query) => database.list(query),
    messages: async (query) => database.messages(query),
    detail: async (query) => database.detail(query),
    metadataDetail: async (query) => database.metadataDetail(query),
    turns: async (query) => database.turns(query)
  };
  const state = createConversationPersistenceState();
  let beforeClose;
  state.configurePersistenceAdapter(
    {
      history,
      load: async () => undefined,
      save: async () => {
        throw new Error("Unexpected legacy save");
      },
      onBeforeClose(handler) {
        beforeClose = handler;
        return () => {};
      }
    },
    { debounceMs: 10_000 }
  );
  cleanup.push(() => {
    state.discardPendingPersistence();
    state.disconnect();
  });
  const schedule = vi.fn(() =>
    state.scheduleControllerPersistence(key, controller)
  );
  const controller = useAgentConversation({
    api: () => undefined,
    onPersistenceChange: schedule,
    flushPersistence: async (options) => {
      schedule();
      await state.flushPersistence(key, options);
    }
  });
  cleanup.push(() => controller.dispose());
  const sessionId = controller.sessionId.value;
  controller.holdPersistenceEmits();
  controller.draft.value = "历史读取期间输入的问题";
  controller.messages.value.push({
    id: "hydration-user",
    role: "user",
    content: "历史读取期间输入的问题",
    createdAt: date,
    status: "completed"
  });
  controller.messages.value.push({
    id: "hydration-answer",
    role: "assistant",
    content: "历史仍在读取时返回的完整回复",
    createdAt: date,
    status: "completed"
  });
  controller.draft.value = "回复之后继续输入的草稿";
  expect(controller.messages.value).toHaveLength(2);
  // Held emits defer the automatic debounced writer: the session is not even
  // present in the database before the close handler resolves the queue.
  expect(() => database.messages({ key, sessionId })).toThrow(
    "Conversation session is missing."
  );
  // Held emits suppress the hot-path notification entirely until released.
  expect(schedule).not.toHaveBeenCalled();

  // A late initial read cannot replace the already acknowledged local session.
  expect(
    await controller.restorePersistenceHistory({
      activeSessionId: "earlier-session",
      items: []
    })
  ).toBe(false);
  controller.releasePersistenceEmits();
  expect(schedule).toHaveBeenCalledTimes(1);
  expect(state.persistenceBusy.value).toBe(true);
  await beforeClose();
  expect(state.persistenceBusy.value).toBe(false);
  const restored = await loadConversationHistoryRecord(history, key, sessionId);
  expect(restored.messages.map((message) => message.content)).toEqual([
    "历史读取期间输入的问题",
    "历史仍在读取时返回的完整回复"
  ]);
  expect(restored.draft).toBe("回复之后继续输入的草稿");
  expect(controller.capturePersistenceChanges().conversations).toEqual([]);
});
