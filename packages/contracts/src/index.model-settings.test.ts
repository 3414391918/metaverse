import {
  CommandEnvelopeSchema,
  ModelSettingsInputSchema,
  ModelSettingsSchema,
  createEnvelope,
  describe,
  expect,
  it
} from "./index.test-support";
import {
  isDeepSeekWebSearchCompatible,
  ModelConnectionTestResultSchema
} from "./models";

describe("desktop contracts: model settings", () => {
  it("restricts DeepSeek web search to the two server-tool APIs", () => {
    expect(
      isDeepSeekWebSearchCompatible({
        provider: " DeepSeek ",
        api: "openai-responses"
      })
    ).toBe(true);
    expect(
      isDeepSeekWebSearchCompatible({
        provider: "DEEPSEEK",
        api: "anthropic-messages"
      })
    ).toBe(true);
    expect(
      isDeepSeekWebSearchCompatible({
        provider: "deepseek",
        api: "openai-completions"
      })
    ).toBe(false);
    expect(
      isDeepSeekWebSearchCompatible({
        provider: "deepseek-official",
        api: "openai-responses"
      })
    ).toBe(false);
  });

  it("normalizes public model settings without exposing API keys", () => {
    const settings = ModelSettingsSchema.parse({
      defaultModelId: "deepseek",
      models: [
        {
          id: "deepseek",
          label: "DeepSeek",
          provider: "deepseek",
          modelId: "deepseek-chat",
          api: "openai-completions",
          baseUrl: "https://api.deepseek.com.example.test/v1",
          reasoning: true,
          defaultThinkingLevel: "xhigh",
          hasApiKey: true,
          apiKey: "must-not-cross-the-boundary"
        }
      ]
    });

    expect(settings.models[0]?.defaultThinkingLevel).toBe("xhigh");
    expect(settings.models[0]?.thinkingLevelOptions).toEqual([
      "minimal",
      "low",
      "medium",
      "high",
      "xhigh",
      "max"
    ]);
    expect(settings.models[0]?.temperatureOptions).toEqual([0.1, 0.7, 1]);
    expect("apiKey" in (settings.models[0] ?? {})).toBe(false);
  });

  it("accepts current, enabled, and deprecated free-model state", () => {
    const freeModel = {
      id: "deepwrite-free-writer",
      label: "Free Writer",
      provider: "deepwrite",
      modelId: "writer-v1",
      api: "openai-completions" as const,
      baseUrl: "https://models.example.test/v1",
      reasoning: false,
      defaultThinkingLevel: "off" as const,
      managedBy: "deepwrite-free" as const,
      hasApiKey: true
    };
    const deprecatedModel = {
      ...freeModel,
      id: "deepwrite-free-retired",
      label: "Retired Writer",
      modelId: "writer-retired",
      hasApiKey: false
    };

    const settings = ModelSettingsSchema.parse({
      models: [freeModel],
      defaultModelId: freeModel.id,
      deepwriteFreeModels: [freeModel],
      deepwriteFreeEnabledModelIds: [freeModel.id],
      deepwriteFreeDeprecatedModels: [deprecatedModel]
    });

    expect(settings.deepwriteFreeEnabledModelIds).toEqual([freeModel.id]);
    expect(settings.deepwriteFreeDeprecatedModels).toEqual([
      expect.objectContaining({
        id: deprecatedModel.id,
        managedBy: "deepwrite-free",
        hasApiKey: false
      })
    ]);
    expect(settings.deepwriteFreeDeprecatedModels?.[0]).not.toHaveProperty(
      "apiKey"
    );
  });

  it("validates free-model enablement commands", () => {
    const command = createEnvelope(
      "models.setFreeModelEnabled",
      { modelId: " deepwrite-free-writer ", enabled: true },
      { id: "cmd_enable_free_model" }
    );

    expect(CommandEnvelopeSchema.parse(command)).toMatchObject({
      type: "models.setFreeModelEnabled",
      payload: {
        modelId: "deepwrite-free-writer",
        enabled: true
      }
    });
    expect(() =>
      CommandEnvelopeSchema.parse({
        ...command,
        payload: { modelId: " ", enabled: true }
      })
    ).toThrow();
  });

  it("accepts max and one custom provider thinking level", () => {
    const settings = ModelSettingsInputSchema.parse({
      defaultModelId: "writer",
      models: [
        {
          id: "writer",
          label: "Writer",
          provider: "custom",
          modelId: "writer-model",
          api: "openai-responses",
          baseUrl: "https://ollama.example.test/v1",
          reasoning: true,
          defaultThinkingLevel: "ultra",
          thinkingLevelOptions: [
            "low",
            "medium",
            "high",
            "xhigh",
            "max",
            "ultra"
          ],
          temperatureOptions: [0.1, 0.7, 1]
        }
      ]
    });

    expect(settings.models[0]?.thinkingLevelOptions).toContain("max");
    expect(settings.models[0]?.defaultThinkingLevel).toBe("ultra");
  });

  it("accepts optional custom model context window and max output tokens together", () => {
    const settings = ModelSettingsInputSchema.parse({
      defaultModelId: "writer",
      models: [
        {
          id: "writer",
          label: "Writer",
          provider: "custom",
          modelId: "writer-model",
          api: "openai-completions",
          baseUrl: "https://ollama.example.test/v1",
          reasoning: false,
          defaultThinkingLevel: "off",
          contextWindow: 32_000,
          maxTokens: 4_096
        }
      ]
    });

    expect(settings.models[0]).toMatchObject({
      contextWindow: 32_000,
      maxTokens: 4_096
    });
  });

  it("rejects incomplete or inverted custom model capacity", () => {
    const model = {
      id: "writer",
      label: "Writer",
      provider: "custom",
      modelId: "writer-model",
      api: "openai-completions" as const,
      baseUrl: "https://ollama.example.test/v1",
      reasoning: false,
      defaultThinkingLevel: "off" as const
    };

    expect(() =>
      ModelSettingsInputSchema.parse({
        models: [{ ...model, contextWindow: 32_000 }],
        defaultModelId: "writer"
      })
    ).toThrow();
    expect(() =>
      ModelSettingsInputSchema.parse({
        models: [{ ...model, maxTokens: 4_096 }],
        defaultModelId: "writer"
      })
    ).toThrow();
    expect(() =>
      ModelSettingsInputSchema.parse({
        models: [{ ...model, contextWindow: 4_096, maxTokens: 32_000 }],
        defaultModelId: "writer"
      })
    ).toThrow();
    expect(() =>
      ModelSettingsInputSchema.parse({
        models: [{ ...model, contextWindow: 10, maxTokens: 8 }],
        defaultModelId: "writer"
      })
    ).toThrow();
  });

  it("requires resolved capacity on a successful model connection test", () => {
    const result = ModelConnectionTestResultSchema.parse({
      modelId: "writer",
      ok: true,
      message: "连接成功，模型已返回有效响应。",
      testedAt: "2026-08-25T00:00:00.000Z",
      contextWindow: 272_000,
      maxTokens: 128_000
    });

    expect(result).toMatchObject({
      contextWindow: 272_000,
      maxTokens: 128_000
    });
    expect(() =>
      ModelConnectionTestResultSchema.parse({
        modelId: "writer",
        ok: true,
        message: "连接成功，模型已返回有效响应。",
        testedAt: "2026-08-25T00:00:00.000Z"
      })
    ).toThrow();
  });

  it("rejects invalid model defaults and reasoning defaults", () => {
    const model = {
      id: "plain",
      label: "Plain model",
      provider: "custom",
      modelId: "plain-model",
      api: "openai-completions" as const,
      baseUrl: "https://ollama.example.test/v1",
      reasoning: false,
      defaultThinkingLevel: "high" as const
    };

    expect(() =>
      ModelSettingsInputSchema.parse({
        models: [model],
        defaultModelId: "plain"
      })
    ).toThrow();
    expect(() =>
      ModelSettingsInputSchema.parse({
        models: [{ ...model, reasoning: true, defaultThinkingLevel: "medium" }],
        defaultModelId: "missing"
      })
    ).toThrow();
    expect(() =>
      ModelSettingsInputSchema.parse({
        models: [
          {
            ...model,
            reasoning: true,
            defaultThinkingLevel: "high",
            thinkingLevelOptions: ["low", "medium"]
          }
        ],
        defaultModelId: "plain"
      })
    ).toThrow();
    expect(() =>
      ModelSettingsInputSchema.parse({
        models: [
          {
            ...model,
            defaultThinkingLevel: "off",
            temperatureOptions: [0.7, 0.7, 1]
          }
        ],
        defaultModelId: "plain"
      })
    ).toThrow();
  });

  it("accepts an unsaved model draft for a connection test", () => {
    const envelope = createEnvelope(
      "models.test",
      {
        model: {
          id: "draft-model",
          label: "Draft model",
          provider: "custom",
          modelId: "draft-v1",
          api: "openai-completions" as const,
          baseUrl: "https://ollama.example.test/v1",
          reasoning: false,
          defaultThinkingLevel: "off" as const,
          apiKey: "not-yet-saved"
        }
      },
      { id: "cmd_test_draft" }
    );

    expect(CommandEnvelopeSchema.parse(envelope).type).toBe("models.test");
  });

  it("accepts a model capacity lookup for an unsaved draft", () => {
    const envelope = createEnvelope(
      "models.resolveCapacity",
      {
        model: {
          id: "draft-model",
          label: "Draft model",
          provider: "custom",
          modelId: "draft-v1",
          api: "openai-completions" as const,
          baseUrl: "https://ollama.example.test/v1",
          reasoning: false,
          defaultThinkingLevel: "off" as const,
          apiKey: "not-yet-saved"
        }
      },
      { id: "cmd_resolve_capacity" }
    );

    expect(CommandEnvelopeSchema.parse(envelope).type).toBe(
      "models.resolveCapacity"
    );
  });

  it("accepts a remote model list request from an unsaved draft", () => {
    const envelope = createEnvelope(
      "models.listRemote",
      {
        id: "draft-model",
        provider: "custom",
        api: "openai-completions" as const,
        baseUrl: "https://api.example.test/v1",
        apiKey: "not-a-real-key"
      },
      { id: "cmd_list_remote" }
    );

    expect(CommandEnvelopeSchema.parse(envelope).type).toBe(
      "models.listRemote"
    );
  });
});
