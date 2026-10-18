import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommandEnvelopeSchema, createEnvelope } from "@deepwrite/contracts";
import { ChatAssistantProjectConfigStore } from "./chat-assistant-project-config-store";
import {
  resolveChatAssistantRuntimeContext,
  type ChatAssistantRuntimeContextDeps
} from "./chat-assistant-runtime-context";
import { handleChatAssistantConfigCommands } from "./ipc/chat-assistant-config-commands";
import type { UtilitySupervisor } from "./supervisor";
const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
  );
});
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "deepwrite-roleplay-"));
  roots.push(root);
  return { root, store: new ChatAssistantProjectConfigStore(root) };
}
describe("roleplay configuration and context", () => {
  it("persists edits and concurrent saves without changing another character", async () => {
    const { root, store } = await fixture();
    const a = { id: "a", name: "守望者", systemPrompt: "你是守望者。" };
    const b = { id: "b", name: "旅人", systemPrompt: "你是旅人。" };
    await Promise.all([store.roleplay.save(a), store.roleplay.save(b)]);
    await store.roleplay.save({ ...a, systemPrompt: " 新的人物定义。 " });
    const restored = new ChatAssistantProjectConfigStore(root);
    expect(await restored.roleplay.list()).toEqual([
      { ...a, systemPrompt: "新的人物定义。" },
      b
    ]);
    await expect(
      store.roleplay.save({ ...a, systemPrompt: " " })
    ).rejects.toThrow();
    expect(
      JSON.parse(
        await readFile(
          join(root, "config/chat-assistant-roleplay.json"),
          "utf8"
        )
      )
    ).toHaveLength(2);
    await expect(store.roleplay.get("missing")).rejects.toThrow("不存在");
  });
  it("routes validated roleplay config commands and resolves only the saved character", async () => {
    const { store } = await fixture();
    const config = { id: "a", name: "守望者", systemPrompt: "你是守望者。" };
    const ctx = { requireChatAssistantProjectConfigStore: () => store };
    const save = CommandEnvelopeSchema.parse(
      createEnvelope("chatAssistantRoleplay.save", config, { id: "save" })
    );
    expect(await handleChatAssistantConfigCommands(ctx, save)).toMatchObject({
      status: "accepted",
      payload: config
    });
    const list = CommandEnvelopeSchema.parse(
      createEnvelope("chatAssistantRoleplay.list", {}, { id: "list" })
    );
    expect(await handleChatAssistantConfigCommands(ctx, list)).toMatchObject({
      status: "accepted",
      payload: [config]
    });
    const unexpected = vi.fn(() => {
      throw new Error("Unexpected context access");
    });
    const supervisor = {
      requestCommand: unexpected
    } as unknown as UtilitySupervisor;
    const deps: ChatAssistantRuntimeContextDeps = {
      ...ctx,
      requireModelConfigStore: unexpected,
      requireModelUsageStore: unexpected,
      getAppVersion: unexpected
    };
    const request = {
      sessionId: "session",
      message: "你好",
      mode: "chat-assistant" as const,
      chatAssistant: { mode: "roleplay" as const, roleId: "a" }
    };
    expect(
      await resolveChatAssistantRuntimeContext(supervisor, request, deps)
    ).toEqual({
      mode: "roleplay",
      roleId: "a",
      systemPrompt: config.systemPrompt
    });
    expect(unexpected).not.toHaveBeenCalled();
  });
});
