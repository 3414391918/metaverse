import { describe, expect, it } from "vitest";
import {
  CHAT_ASSISTANT_ROLEPLAY_PROMPT_SUFFIX,
  AgentPromptCommandPayloadSchema,
  SessionPromptCommandPayloadSchema
} from "@deepwrite/contracts";
import { PiAgentRuntimeAdapter } from "./index";
import { buildChatAssistantSystemPrompt } from "./chat-assistant";
import { buildChatAssistantTools } from "./chat-assistant-tools";
const context = {
  mode: "roleplay" as const,
  roleId: "character-a",
  systemPrompt: "你是住在海边的灯塔守望者。"
};
const request = {
  sessionId: "roleplay-session",
  message: "你好",
  mode: "chat-assistant" as const,
  chatAssistant: { mode: "roleplay" as const, roleId: context.roleId }
};
describe("roleplay request boundary", () => {
  it("adds exactly the requested suffix without software context or tools", () => {
    expect(buildChatAssistantSystemPrompt(context, true)).toBe(
      `${context.systemPrompt}\n\n${CHAT_ASSISTANT_ROLEPLAY_PROMPT_SUFFIX}`
    );
    expect(
      buildChatAssistantTools({ runId: "run", sessionId: "session", context })
    ).toEqual([]);
  });
  it("rejects search, workspace context and mismatched characters", () => {
    expect(SessionPromptCommandPayloadSchema.safeParse(request).success).toBe(
      true
    );
    for (const extra of [
      { webSearchEnabled: true },
      { project: { projectType: "short", projectId: "book" } },
      { systemPrompt: "untrusted override" }
    ]) {
      expect(
        SessionPromptCommandPayloadSchema.safeParse({
          ...request,
          chatAssistant: { ...request.chatAssistant, ...extra }
        }).success
      ).toBe(false);
    }
    expect(
      SessionPromptCommandPayloadSchema.safeParse({
        ...request,
        workspaceContext: {}
      }).success
    ).toBe(false);
    expect(
      AgentPromptCommandPayloadSchema.safeParse({
        ...request,
        chatAssistantRuntimeContext: context
      }).success
    ).toBe(true);
    expect(
      AgentPromptCommandPayloadSchema.safeParse({
        ...request,
        chatAssistantRuntimeContext: { ...context, roleId: "other" }
      }).success
    ).toBe(false);
    expect(
      AgentPromptCommandPayloadSchema.safeParse({
        ...request,
        chatAssistantRuntimeContext: { ...context, catalog: {} }
      }).success
    ).toBe(false);
  });
  it("keeps character histories separate and refreshes an edited prompt on the next turn", async () => {
    const runtime = new PiAgentRuntimeAdapter({ tokensPerSecond: 0 });
    for (const [roleId, systemPrompt, prompt] of [
      ["character-a", "你是灯塔守望者。", "灯塔你好"],
      ["character-b", "你是山间旅人。", "旅人你好"],
      ["character-a", "你是爱讲故事的灯塔守望者。", "继续讲故事"]
    ]) {
      for await (const _event of runtime.start({
        runId: `run-${prompt}`,
        sessionId: "shared-session",
        mode: "chat-assistant",
        prompt: prompt!,
        thinkingLevel: "off",
        chatAssistantRuntimeContext: {
          ...context,
          roleId: roleId!,
          systemPrompt: systemPrompt!
        }
      })) {
        /* Consume complete turn. */
      }
    }
    const cache = (
      runtime as unknown as {
        conversationAgents: Map<
          string,
          {
            state: {
              systemPrompt: string;
              tools: unknown[];
              messages: { role: string; content: unknown }[];
            };
          }
        >;
      }
    ).conversationAgents;
    const first = cache.get(
      "shared-session:chat-assistant:roleplay:character-a"
    )!.state;
    const second = cache.get(
      "shared-session:chat-assistant:roleplay:character-b"
    )!.state;
    expect(first.systemPrompt).toBe(
      `你是爱讲故事的灯塔守望者。\n\n${CHAT_ASSISTANT_ROLEPLAY_PROMPT_SUFFIX}`
    );
    expect(first.tools).toEqual([]);
    expect(second.tools).toEqual([]);
    expect(
      first.messages.filter((m) => m.role === "user").map((m) => m.content)
    ).toEqual(["灯塔你好", "继续讲故事"]);
    expect(
      second.messages.filter((m) => m.role === "user").map((m) => m.content)
    ).toEqual(["旅人你好"]);
  });
});
