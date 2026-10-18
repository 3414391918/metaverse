import type { AgentProviderRuntimeConfig } from "./index.test-support";

import {
  buildProviderRuntime,
  resolveProviderModelCapacity,
  describe,
  expect,
  it
} from "./index.test-support";

describe("provider model capacity resolution", () => {
  it("keeps model reasoning capability separate from the per-run thinking switch", () => {
    const config: AgentProviderRuntimeConfig = {
      id: "writer",
      label: "Writer",
      provider: "custom",
      modelId: "writer-model",
      api: "openai-completions",
      baseUrl: "https://ollama.example.test/v1",
      reasoning: false,
      defaultThinkingLevel: "off",
      thinkingLevelOptions: ["low", "high"],
      temperatureOptions: [0.2, 0.6, 1.2],
      apiKey: ""
    };

    expect(
      buildProviderRuntime(config, undefined, "high").model.reasoning
    ).toBe(true);
    expect(buildProviderRuntime(config, 0.6, "off").model.reasoning).toBe(true);
    expect(
      buildProviderRuntime({ ...config, reasoning: true }, 0.6, "off").model
        .reasoning
    ).toBe(true);

    const knownNonReasoningConfig: AgentProviderRuntimeConfig = {
      ...config,
      id: "gpt-5-chat-latest",
      label: "GPT-5 Chat",
      provider: "openai",
      modelId: "gpt-5-chat-latest",
      api: "openai-responses",
      baseUrl: "https://api.openai.com.example.test/v1"
    };
    expect(
      buildProviderRuntime(knownNonReasoningConfig, 0.6, "off").model.reasoning
    ).toBe(false);
  });

  it("uses the GPT-5.6 Sol capacity baseline when no model catalog matches", () => {
    const config: AgentProviderRuntimeConfig = {
      id: "unknown-writer",
      label: "Unknown writer",
      provider: "custom",
      modelId: "unknown-writer-model",
      api: "openai-completions",
      baseUrl: "https://example.test/v1",
      reasoning: false,
      defaultThinkingLevel: "off",
      thinkingLevelOptions: ["low", "medium", "high"],
      temperatureOptions: [0.2, 0.7, 1.2],
      apiKey: "test-only"
    };

    expect(buildProviderRuntime(config).model).toMatchObject({
      contextWindow: 272_000,
      maxTokens: 128_000
    });
    expect(resolveProviderModelCapacity(config)).toEqual({
      contextWindow: 272_000,
      maxTokens: 128_000
    });
  });

  it("uses saved custom capacity over the catalog and unknown-model baseline", () => {
    const unknownConfig: AgentProviderRuntimeConfig = {
      id: "unknown-writer",
      label: "Unknown writer",
      provider: "custom",
      modelId: "unknown-writer-model",
      api: "openai-completions",
      baseUrl: "https://example.test/v1",
      reasoning: false,
      defaultThinkingLevel: "off",
      thinkingLevelOptions: ["low", "medium", "high"],
      temperatureOptions: [0.2, 0.7, 1.2],
      apiKey: "test-only",
      contextWindow: 32_000,
      maxTokens: 4_096
    };

    expect(buildProviderRuntime(unknownConfig).model).toMatchObject({
      contextWindow: 32_000,
      maxTokens: 4_096
    });

    const catalogConfig: AgentProviderRuntimeConfig = {
      id: "enterprise-gemini",
      label: "Enterprise Gemini",
      provider: "google",
      modelId: "kdi-gemini-3.1-pro-preview",
      api: "google-generative-ai",
      baseUrl: "https://generativelanguage.googleapis.com.example.test/v1beta",
      reasoning: true,
      defaultThinkingLevel: "high",
      thinkingLevelOptions: ["low", "high"],
      temperatureOptions: [0.1, 0.7, 1],
      apiKey: "test-only",
      contextWindow: 16_000,
      maxTokens: 2_048
    };

    expect(buildProviderRuntime(catalogConfig).model).toMatchObject({
      contextWindow: 16_000,
      maxTokens: 2_048
    });
    expect(resolveProviderModelCapacity(unknownConfig)).toEqual({
      contextWindow: 32_000,
      maxTokens: 4_096
    });
    expect(resolveProviderModelCapacity(catalogConfig)).toEqual({
      contextWindow: 16_000,
      maxTokens: 2_048
    });
  });

  it("matches a provider model when an enterprise route prefixes its catalog id", () => {
    const config: AgentProviderRuntimeConfig = {
      id: "enterprise-gemini",
      label: "Enterprise Gemini",
      provider: "google",
      modelId: "kdi-gemini-3.1-pro-preview",
      api: "google-generative-ai",
      baseUrl: "https://generativelanguage.googleapis.com.example.test/v1beta",
      reasoning: true,
      defaultThinkingLevel: "high",
      thinkingLevelOptions: ["low", "high"],
      temperatureOptions: [0.1, 0.7, 1],
      apiKey: "test-only"
    };

    expect(resolveProviderModelCapacity(config)).toEqual({
      contextWindow: 1_048_576,
      maxTokens: 65_536
    });
    expect(buildProviderRuntime(config).model).toMatchObject({
      id: "kdi-gemini-3.1-pro-preview",
      contextWindow: 1_048_576,
      maxTokens: 65_536,
      thinkingLevelMap: {
        off: null,
        minimal: null,
        low: "LOW",
        medium: null,
        high: "HIGH"
      }
    });
  });
});
