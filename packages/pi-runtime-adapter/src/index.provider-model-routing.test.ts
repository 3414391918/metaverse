import type { AgentProviderRuntimeConfig } from "./index.test-support";

import {
  PiAgentRuntimeAdapter,
  buildProviderRuntime,
  captureDisabledThinkingPayload,
  captureThinkingPayload,
  describe,
  expect,
  it
} from "./index.test-support";

describe("provider model routes and thinking controls", () => {
  it("uses a provider routing id without replacing the public model id", async () => {
    const config: AgentProviderRuntimeConfig = {
      id: "routed-model",
      label: "Routed model",
      provider: "custom",
      modelId: "public-model-id",
      requestModelId: "provider-route-id",
      api: "openai-completions",
      baseUrl: "https://example.test/v1",
      reasoning: false,
      defaultThinkingLevel: "off",
      thinkingLevelOptions: [
        "minimal",
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      temperatureOptions: [0.1, 0.7, 1],
      apiKey: "test-only"
    };

    const runtime = buildProviderRuntime(config, 0.7, "off");
    expect(runtime.model.id).toBe("provider-route-id");
    expect(new PiAgentRuntimeAdapter().describe(config)).toMatchObject({
      model: "public-model-id",
      configId: config.id
    });
    await expect(captureDisabledThinkingPayload(config)).resolves.toMatchObject(
      {
        model: "provider-route-id"
      }
    );
  });

  it("uses the system role when an official-compatible endpoint disables developer messages", async () => {
    const config: AgentProviderRuntimeConfig = {
      id: "deepwrite-deepseek-v4-flash",
      label: "Official DeepSeek Flash",
      provider: "deepseek-official",
      modelId: "deepseek-v4-flash-202605",
      api: "openai-completions",
      baseUrl: "https://tokenhub.tencentmaas.com.example.test/v1",
      reasoning: true,
      supportsDeveloperRole: false,
      defaultThinkingLevel: "high",
      thinkingLevelOptions: ["low", "high", "max"],
      temperatureOptions: [0.7, 1, 1.5],
      managedBy: "deepwrite-official",
      apiKey: "test-only"
    };

    const payload = await captureDisabledThinkingPayload(config);
    expect(payload.messages).toEqual([
      expect.objectContaining({ role: "system" }),
      expect.objectContaining({ role: "user" })
    ]);
    expect(buildProviderRuntime(config).model.compat).toMatchObject({
      supportsDeveloperRole: false
    });
  });

  it("uses the DeepWrite Kimi K3 runtime catalog for an official gateway route", async () => {
    const config: AgentProviderRuntimeConfig = {
      id: "deepwrite-kimi-k3",
      label: "Kimi K3",
      provider: "deepseek-official",
      modelId: "kimi-k3",
      api: "openai-completions",
      baseUrl: "https://www.moxing.pro.example.test/v1",
      reasoning: true,
      supportsDeveloperRole: false,
      defaultThinkingLevel: "high",
      thinkingLevelOptions: ["low", "high", "max"],
      temperatureOptions: [0.7, 1, 1.5],
      managedBy: "deepwrite-official",
      apiKey: "test-only"
    };

    const high = buildProviderRuntime(config, undefined, "high").model;
    expect(high).toMatchObject({
      id: "kimi-k3",
      provider: "deepseek-official",
      baseUrl: "https://www.moxing.pro.example.test/v1",
      reasoning: true,
      input: ["text", "image"],
      contextWindow: 1_048_576,
      maxTokens: 131_072,
      thinkingLevelMap: {
        off: null,
        low: "low",
        high: "high",
        xhigh: "max"
      },
      compat: {
        supportsStore: false,
        supportsDeveloperRole: false,
        supportsReasoningEffort: true,
        maxTokensField: "max_completion_tokens",
        requiresReasoningContentOnAssistantMessages: true,
        thinkingFormat: "openai",
        supportsStrictMode: true
      }
    });

    expect(
      buildProviderRuntime(config, undefined, "max").model.thinkingLevelMap
    ).toMatchObject({ xhigh: "max" });
    await expect(captureThinkingPayload(config, "high")).resolves.toMatchObject(
      {
        model: "kimi-k3",
        reasoning_effort: "high"
      }
    );
    await expect(captureThinkingPayload(config, "max")).resolves.toMatchObject({
      model: "kimi-k3",
      reasoning_effort: "max"
    });
  });

  it("uses the production DeepSeek V4 Flash metadata for the 0731 gateway route", () => {
    const config: AgentProviderRuntimeConfig = {
      id: "deepwrite-deepseek-v4-flash-0731",
      label: "DeepSeek-V4-Flash-正式版",
      provider: "deepseek-official",
      modelId: "deepseek-v4-flash-0731",
      api: "openai-completions",
      baseUrl: "https://www.moxing.pro.example.test/v1/",
      reasoning: true,
      supportsDeveloperRole: true,
      defaultThinkingLevel: "high",
      thinkingLevelOptions: ["low", "high", "max"],
      temperatureOptions: [0.7, 1, 1.5],
      managedBy: "deepwrite-official",
      apiKey: "test-only"
    };

    expect(buildProviderRuntime(config, undefined, "max").model).toMatchObject({
      id: "deepseek-v4-flash-0731",
      provider: "deepseek-official",
      baseUrl: "https://www.moxing.pro.example.test/v1/",
      contextWindow: 1_000_000,
      maxTokens: 384_000,
      input: ["text"],
      thinkingLevelMap: {
        minimal: null,
        low: null,
        medium: null,
        high: "high",
        xhigh: "max"
      },
      compat: {
        supportsStore: false,
        supportsDeveloperRole: true,
        requiresReasoningContentOnAssistantMessages: true,
        thinkingFormat: "deepseek"
      }
    });
  });

  it.each([
    ["deepseek-v4-pro", "DeepSeek V4 Pro"],
    ["deepseek-v4-flash", "DeepSeek V4 Flash"]
  ] as const)(
    "uses the DeepWrite %s runtime catalog for an official gateway route",
    (modelId, label) => {
      const config: AgentProviderRuntimeConfig = {
        id: `deepwrite-${modelId}`,
        label,
        provider: "deepseek-official",
        modelId,
        api: "openai-completions",
        baseUrl: "https://example.test/v1",
        reasoning: true,
        supportsDeveloperRole: false,
        defaultThinkingLevel: "high",
        thinkingLevelOptions: ["low", "high", "max"],
        temperatureOptions: [0.7, 1, 1.5],
        managedBy: "deepwrite-official",
        apiKey: "test-only"
      };

      expect(
        buildProviderRuntime(config, undefined, "max").model
      ).toMatchObject({
        id: modelId,
        provider: "deepseek-official",
        baseUrl: "https://example.test/v1",
        contextWindow: 1_000_000,
        maxTokens: 384_000,
        input: ["text"],
        thinkingLevelMap: {
          minimal: null,
          low: "high",
          medium: "high",
          high: "high",
          xhigh: "max"
        },
        compat: {
          supportsStore: false,
          supportsDeveloperRole: false,
          supportsReasoningEffort: true,
          maxTokensField: "max_tokens",
          requiresReasoningContentOnAssistantMessages: true,
          thinkingFormat: "deepseek",
          supportsStrictMode: true
        }
      });
    }
  );

  it.each([
    ["glm-5.3", "GLM-5.3", 1_000_000, 131_072, "zai"],
    ["glm-5.2", "GLM-5.2", 1_000_000, 131_072, "zai"],
    ["qwen3.7-plus", "Qwen3.7 Plus", 1_000_000, 131_072, "openai"]
  ] as const)(
    "uses the DeepWrite %s runtime catalog for an official gateway route",
    (modelId, label, contextWindow, maxTokens, thinkingFormat) => {
      const config: AgentProviderRuntimeConfig = {
        id: `deepwrite-${modelId}`,
        label,
        provider: "deepseek-official",
        modelId,
        api: "openai-completions",
        baseUrl: "https://example.test/v1",
        reasoning: true,
        supportsDeveloperRole: false,
        defaultThinkingLevel: "high",
        thinkingLevelOptions: ["low", "high", "max"],
        temperatureOptions: [0.7, 1, 1.5],
        managedBy: "deepwrite-official",
        apiKey: "test-only"
      };

      expect(
        buildProviderRuntime(config, undefined, "max").model
      ).toMatchObject({
        id: modelId,
        provider: "deepseek-official",
        baseUrl: "https://example.test/v1",
        contextWindow,
        maxTokens,
        thinkingLevelMap: {
          low: expect.anything(),
          high: expect.anything(),
          xhigh: expect.anything()
        },
        compat: {
          supportsStore: false,
          supportsDeveloperRole: false,
          supportsReasoningEffort: true,
          maxTokensField: "max_completion_tokens",
          requiresReasoningContentOnAssistantMessages: true,
          thinkingFormat,
          supportsStrictMode: true
        }
      });
    }
  );

  it("keeps GLM-5.3 thinking enabled and maps all supported effort levels", async () => {
    const config: AgentProviderRuntimeConfig = {
      id: "deepwrite-glm-5.3",
      label: "GLM-5.3",
      provider: "deepseek-official",
      modelId: "glm-5.3",
      api: "openai-completions",
      baseUrl: "https://example.test/v1",
      reasoning: true,
      supportsDeveloperRole: false,
      defaultThinkingLevel: "max",
      thinkingLevelOptions: ["low", "high", "max"],
      temperatureOptions: [0.7, 1, 1.5],
      managedBy: "deepwrite-official",
      apiKey: "test-only"
    };

    expect(buildProviderRuntime(config, undefined, "max").model).toMatchObject({
      id: "glm-5.3",
      input: ["text"],
      contextWindow: 1_000_000,
      maxTokens: 131_072,
      thinkingLevelMap: {
        off: null,
        low: "low",
        high: "high",
        xhigh: "max"
      },
      compat: {
        thinkingFormat: "zai",
        supportsReasoningEffort: true,
        zaiToolStream: true
      }
    });

    await expect(captureThinkingPayload(config, "low")).resolves.toMatchObject({
      thinking: { type: "enabled" },
      reasoning_effort: "low"
    });
    await expect(captureThinkingPayload(config, "high")).resolves.toMatchObject(
      {
        thinking: { type: "enabled" },
        reasoning_effort: "high"
      }
    );
    await expect(captureThinkingPayload(config, "max")).resolves.toMatchObject({
      thinking: { type: "enabled" },
      reasoning_effort: "max"
    });
    const disabledPayload = await captureDisabledThinkingPayload(config);
    expect(disabledPayload).toMatchObject({
      thinking: { type: "enabled" },
      reasoning_effort: "low"
    });
    expect(disabledPayload).not.toHaveProperty("temperature");
  });

  it.each([
    ["gpt-5.6-sol", "GPT-5.6 Sol"],
    ["gpt-5.6-terra", "GPT-5.6 Terra"],
    ["gpt-5.6-luna", "GPT-5.6 Luna"]
  ] as const)(
    "uses the DeepWrite %s runtime catalog instead of the generic fallback",
    (modelId, label) => {
      const config: AgentProviderRuntimeConfig = {
        id: `deepwrite-${modelId}`,
        label,
        provider: "openai",
        modelId,
        api: "openai-responses",
        baseUrl: "https://local-model.example.test/v1",
        reasoning: true,
        defaultThinkingLevel: "medium",
        thinkingLevelOptions: ["low", "medium", "high", "xhigh", "max"],
        temperatureOptions: [0.1, 0.7, 1.5],
        apiKey: "test-only"
      };

      expect(buildProviderRuntime(config).model).toMatchObject({
        id: modelId,
        provider: "openai",
        baseUrl: "https://local-model.example.test/v1",
        reasoning: true,
        input: ["text", "image"],
        contextWindow: 272_000,
        maxTokens: 128_000,
        thinkingLevelMap: {
          off: "none",
          minimal: null,
          xhigh: "xhigh",
          max: "max"
        }
      });
    }
  );

  it.each([
    ["qwen3.8-max", "none"],
    ["qwen3.8-max-preview", null]
  ] as const)(
    "uses the DeepWrite %s runtime catalog for an official gateway route",
    async (modelId, offMapping) => {
      const config: AgentProviderRuntimeConfig = {
        id: `deepwrite-${modelId}`,
        label:
          modelId === "qwen3.8-max" ? "Qwen3.8 Max" : "Qwen3.8 Max Preview",
        provider: "deepseek-official",
        modelId,
        api: "openai-completions",
        baseUrl: "https://www.moxing.pro.example.test/v1",
        reasoning: true,
        supportsDeveloperRole: false,
        defaultThinkingLevel: "high",
        thinkingLevelOptions: ["low", "high", "max"],
        temperatureOptions: [0.7, 1, 1.5],
        managedBy: "deepwrite-official",
        apiKey: "test-only"
      };

      const high = buildProviderRuntime(config, undefined, "high").model;
      expect(high).toMatchObject({
        id: modelId,
        provider: "deepseek-official",
        baseUrl: "https://www.moxing.pro.example.test/v1",
        reasoning: true,
        input: ["text", "image"],
        contextWindow: 983_616,
        maxTokens: 131_072,
        thinkingLevelMap: {
          off: offMapping,
          low: "low",
          high: "xhigh",
          xhigh: "xhigh"
        },
        compat: {
          supportsStore: false,
          supportsDeveloperRole: false,
          supportsReasoningEffort: true,
          maxTokensField: "max_completion_tokens",
          requiresReasoningContentOnAssistantMessages: true,
          thinkingFormat: "openai",
          supportsStrictMode: true
        }
      });

      await expect(
        captureThinkingPayload(config, "low")
      ).resolves.toMatchObject({
        model: modelId,
        reasoning_effort: "low"
      });
      await expect(
        captureThinkingPayload(config, "high")
      ).resolves.toMatchObject({
        model: modelId,
        reasoning_effort: "xhigh"
      });
      await expect(
        captureThinkingPayload(config, "max")
      ).resolves.toMatchObject({
        model: modelId,
        reasoning_effort: "max"
      });
      const disabledPayload = await captureDisabledThinkingPayload(config);
      if (offMapping === null) {
        expect(disabledPayload).not.toHaveProperty("reasoning_effort");
        expect(disabledPayload).not.toHaveProperty("temperature");
      } else {
        expect(disabledPayload).toMatchObject({
          reasoning_effort: "none",
          temperature: 1
        });
      }
    }
  );

  it("serializes disabled thinking for supported provider protocols", async () => {
    const baseConfig: AgentProviderRuntimeConfig = {
      id: "writer",
      label: "Writer",
      provider: "deepseek",
      modelId: "deepseek-chat",
      api: "openai-completions",
      baseUrl: "https://api.deepseek.com.example.test/v1",
      reasoning: false,
      defaultThinkingLevel: "off",
      thinkingLevelOptions: ["low", "medium", "high"],
      temperatureOptions: [0.2, 0.6, 1.2],
      apiKey: "test-key"
    };

    await expect(
      captureDisabledThinkingPayload(baseConfig)
    ).resolves.toMatchObject({
      thinking: { type: "disabled" },
      temperature: 0.6
    });

    await expect(
      captureDisabledThinkingPayload({
        ...baseConfig,
        id: "claude-sonnet-4-6",
        label: "Claude Sonnet 4.6",
        provider: "anthropic",
        modelId: "claude-sonnet-4-6",
        api: "anthropic-messages",
        baseUrl: "https://api.anthropic.com.example.test"
      })
    ).resolves.toMatchObject({
      thinking: { type: "disabled" },
      temperature: 0.6
    });

    await expect(
      captureDisabledThinkingPayload({
        ...baseConfig,
        id: "gemini-2.5-flash",
        label: "Gemini 2.5 Flash",
        provider: "google",
        modelId: "gemini-2.5-flash",
        api: "google-generative-ai",
        baseUrl: "https://generativelanguage.googleapis.com.example.test/v1beta"
      })
    ).resolves.toMatchObject({
      config: {
        thinkingConfig: { thinkingBudget: 0 },
        temperature: 0.6
      }
    });

    await expect(
      captureDisabledThinkingPayload({
        ...baseConfig,
        id: "gpt-5.4",
        label: "GPT-5.4",
        provider: "openai",
        modelId: "gpt-5.4",
        api: "openai-responses",
        baseUrl: "https://api.openai.com.example.test/v1"
      })
    ).resolves.toMatchObject({
      reasoning: { effort: "none" },
      temperature: 0.6
    });

    await expect(
      captureDisabledThinkingPayload({
        ...baseConfig,
        id: "qwen-plus",
        label: "Qwen Plus",
        provider: "custom",
        modelId: "qwen-plus",
        api: "openai-completions",
        baseUrl:
          "https://dashscope.aliyuncs.com.example.test/compatible-mode/v1"
      })
    ).resolves.toMatchObject({
      enable_thinking: false,
      temperature: 0.6
    });

    await expect(
      captureDisabledThinkingPayload({
        ...baseConfig,
        id: "glm-4.7",
        label: "GLM-4.7",
        provider: "custom",
        modelId: "glm-4.7",
        api: "openai-completions",
        baseUrl: "https://open.bigmodel.cn.example.test/api/paas/v4"
      })
    ).resolves.toMatchObject({
      thinking: { type: "disabled" },
      temperature: 0.6
    });
  });

  it("omits disabled-thinking controls for catalog models that cannot turn thinking off", async () => {
    const payload = await captureDisabledThinkingPayload({
      id: "gpt-5",
      label: "GPT-5",
      provider: "openai",
      modelId: "gpt-5",
      api: "openai-responses",
      baseUrl: "https://api.openai.com.example.test/v1",
      reasoning: false,
      defaultThinkingLevel: "off",
      thinkingLevelOptions: ["low", "medium", "high"],
      temperatureOptions: [0.2, 0.6, 1.2],
      apiKey: "test-key"
    });

    expect(payload).not.toHaveProperty("reasoning");
    expect(payload).not.toHaveProperty("temperature");
  });
});
