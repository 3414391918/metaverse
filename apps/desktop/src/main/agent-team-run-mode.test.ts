import { describe, expect, it, vi } from "vitest";
import type {
  AgentProviderRuntimeConfig,
  ShortAgentSubagentDefinition
} from "@deepwrite/contracts";
import { resolveAgentTeamRuntime } from "./agent-team-run-mode";

const inheritedMember: ShortAgentSubagentDefinition = {
  id: "researcher",
  name: "资料员",
  description: "查找资料",
  systemPrompt: "只整理与任务有关的资料。",
  enabled: true,
  modelMode: "inherit"
};

const runtimeConfig: AgentProviderRuntimeConfig = {
  id: "reviewer-model",
  label: "Reviewer",
  provider: "custom",
  modelId: "reviewer-model",
  api: "openai-responses",
  baseUrl: "https://api.example.test/v1",
  reasoning: true,
  defaultThinkingLevel: "medium",
  thinkingLevelOptions: ["low", "medium", "high"],
  temperatureOptions: [0.2, 0.7, 1.2],
  apiKey: "invalid-test-key"
};

describe("agent team run mode", () => {
  it.each(["short", "script"])(
    "rejects discontinued %s targets before resolving members",
    async (workspaceType) => {
      const resolveDefinitions = vi.fn(async () => [inheritedMember]);
      await expect(
        resolveAgentTeamRuntime(
          "team",
          { workspaceType, parentAgentId: workspaceType } as never,
          { resolveDefinitions, resolveModel: async () => undefined }
        )
      ).rejects.toThrow("主智能体");
      expect(resolveDefinitions).not.toHaveBeenCalled();
    }
  );
  it("does not resolve team configuration in normal mode", async () => {
    const resolveDefinitions = vi.fn(async () => [inheritedMember]);
    const resolveModel = vi.fn(async () => runtimeConfig);

    await expect(
      resolveAgentTeamRuntime(
        "normal",
        { workspaceType: "long", parentAgentId: "long" },
        { resolveDefinitions, resolveModel }
      )
    ).resolves.toEqual({ subagentRuntimeConfigs: {} });
    expect(resolveDefinitions).not.toHaveBeenCalled();
    expect(resolveModel).not.toHaveBeenCalled();
  });

  it("resolves enabled members and custom model runtimes in team mode", async () => {
    const customMember: ShortAgentSubagentDefinition = {
      ...inheritedMember,
      id: "reviewer",
      name: "审阅员",
      modelMode: "custom",
      modelId: runtimeConfig.id,
      thinkingLevel: "high"
    };
    const resolveDefinitions = vi.fn(async () => [
      inheritedMember,
      customMember
    ]);
    const resolveModel = vi.fn(async () => runtimeConfig);

    await expect(
      resolveAgentTeamRuntime(
        "team",
        { workspaceType: "long", parentAgentId: "long" },
        { resolveDefinitions, resolveModel }
      )
    ).resolves.toEqual({
      subagentDefinitions: [inheritedMember, customMember],
      subagentRuntimeConfigs: { [runtimeConfig.id]: runtimeConfig }
    });
    expect(resolveDefinitions).toHaveBeenCalledWith("long", "long");
    expect(resolveModel).toHaveBeenCalledWith(runtimeConfig.id);
  });

  it("rejects team mode when the current agent has no enabled members", async () => {
    await expect(
      resolveAgentTeamRuntime(
        "team",
        { workspaceType: "long", parentAgentId: "long" },
        {
          resolveDefinitions: async () => [],
          resolveModel: async () => undefined
        }
      )
    ).rejects.toThrow("没有已启用且含可用成员的团队");
  });
});
