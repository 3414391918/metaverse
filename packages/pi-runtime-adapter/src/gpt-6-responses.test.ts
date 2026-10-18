import type { AgentProviderRuntimeConfig } from "@deepwrite/contracts";
import { describe, expect, it } from "vitest";
import { buildProviderRuntime } from "./provider-runtime";
import {
  resultText,
  fixtureIndex,
  documentExecutor,
  longTools,
  toolByName
} from "./long-agent-tools.test-support";

function modelConfig(
  provider = "openai",
  modelId = "gpt-6-astra"
): AgentProviderRuntimeConfig {
  return {
    id: "gpt-6-test",
    label: "GPT-6 test",
    provider,
    modelId,
    api: "openai-responses",
    baseUrl: "https://models.example.test/v1",
    apiKey: "invalid-test-key",
    reasoning: true,
    defaultThinkingLevel: "high",
    thinkingLevelOptions: ["low", "medium", "high", "xhigh", "max"],
    temperatureOptions: [0.2, 0.7, 1.2]
  };
}

describe("GPT-6 Responses compatibility", () => {
  it.each([
    ["openai", "gpt-6-astra"],
    ["openai", "gpt-6-sol"],
    ["openai", "gpt-6-luna"],
    ["custom", "gpt-6-astra"],
    ["custom", "gpt-6-astra-routed"],
    ["custom", "gateway-gpt-6-astra"],
    ["custom", "gpt-6-sol-routed"],
    ["custom", "gateway-gpt-6-luna"]
  ])("keeps read arguments optional for %s/%s", async (provider, modelId) => {
    const read = toolByName(
      longTools({ executor: documentExecutor(fixtureIndex()) }),
      "read"
    );
    const originalParameters = structuredClone(read.parameters);
    const { model, streamFn } = buildProviderRuntime(
      modelConfig(provider, modelId)
    );
    let payload: unknown;
    const stream = await streamFn(
      model,
      {
        messages: [
          {
            role: "user",
            content: "Read the character overview.",
            timestamp: 0
          }
        ],
        tools: [read]
      },
      {
        reasoning: "high",
        onPayload(value) {
          payload = value;
          throw new Error("Test captured payload before network request.");
        }
      }
    );
    await stream.result();

    expect(payload).toMatchObject({
      model: modelId,
      tools: [
        {
          name: "read",
          strict: false,
          parameters: { required: ["id"] }
        }
      ],
      reasoning: { effort: "high" }
    });
    expect(read.parameters).toEqual(originalParameters);
    expect(
      resultText(
        await read.execute("read-overview", {
          id: "character_overview"
        })
      )
    ).toContain("character_overview");
  });

  it.each(["gpt-6-astra", "gpt-6-sol", "gpt-6-luna"])(
    "uses Astra-equivalent capacity and reasoning metadata for %s while preserving overrides",
    (modelId) => {
      const config = modelConfig("custom", modelId);
      expect(buildProviderRuntime(config).model).toMatchObject({
        contextWindow: 272_000,
        maxTokens: 128_000,
        input: ["text", "image"],
        compat: { supportsStrictMode: true },
        thinkingLevelMap: {
          off: null,
          minimal: null,
          low: "low",
          medium: "medium",
          high: "high",
          xhigh: "xhigh",
          max: "max"
        }
      });
      expect(
        buildProviderRuntime({
          ...config,
          contextWindow: 500_000,
          maxTokens: 64_000
        }).model
      ).toMatchObject({ contextWindow: 500_000, maxTokens: 64_000 });
    }
  );
});
