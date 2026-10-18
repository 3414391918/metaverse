import type { AgentProviderRuntimeConfig } from "./index.test-support";
import { StringEnum } from "@earendil-works/pi-ai";
import {
  Type,
  captureToolPayload,
  describe,
  expect,
  it,
  ollamaGrammarRegressionTool,
  toolWithParameters
} from "./index.test-support";

describe("provider tool schema routing", () => {
  it.each(["openai-completions", "openai-responses"] as const)(
    "rejects object-union tool roots before an %s request",
    async (api) => {
      const config: AgentProviderRuntimeConfig = {
        id: `schema-${api}`,
        label: `Schema ${api}`,
        provider: "custom",
        modelId: "schema-test-model",
        api,
        baseUrl: "https://schema.example.test/v1",
        reasoning: false,
        defaultThinkingLevel: "off",
        thinkingLevelOptions: ["off"],
        temperatureOptions: [0.2, 0.7, 1.2],
        apiKey: "test-only"
      };
      const parameters = Type.Union([
        Type.Object({ domain: Type.Literal("worldbuilding") }),
        Type.Object({ domain: Type.Literal("character") })
      ]);
      await expect(
        captureToolPayload(
          config,
          toolWithParameters("list_setting_regression", parameters)
        )
      ).rejects.toThrow('根节点必须声明 type: "object"');
      expect(parameters).not.toHaveProperty("type");
    }
  );

  it("publishes portable string enums to Anthropic-compatible models", async () => {
    const config: AgentProviderRuntimeConfig = {
      id: "anthropic-schema",
      label: "Anthropic Schema",
      provider: "custom",
      modelId: "schema-test-model",
      api: "anthropic-messages",
      baseUrl: "https://schema.example.test",
      reasoning: false,
      defaultThinkingLevel: "off",
      thinkingLevelOptions: ["off"],
      temperatureOptions: [0.2, 0.7, 1.2],
      apiKey: "test-only"
    };
    const parameters = Type.Object({
      kind: Type.Optional(
        StringEnum(["book_line", "chapter", "placement"] as const)
      )
    });
    const payload = await captureToolPayload(
      config,
      toolWithParameters("list_plot_design", parameters)
    );
    const inputSchema = (
      payload.tools as Array<{
        input_schema: {
          properties: Record<string, Record<string, unknown>>;
        };
      }>
    )[0]!.input_schema;

    expect(inputSchema.properties.kind).toEqual({
      type: "string",
      enum: ["book_line", "chapter", "placement"]
    });
    expect(parameters.properties.kind).toHaveProperty("enum");
    expect(parameters.properties.kind).not.toHaveProperty("anyOf");
  });

  it("rejects a non-object tool root before sending a provider request", async () => {
    const config: AgentProviderRuntimeConfig = {
      id: "invalid-schema",
      label: "Invalid schema",
      provider: "custom",
      modelId: "schema-test-model",
      api: "openai-completions",
      baseUrl: "https://schema.example.test/v1",
      reasoning: false,
      defaultThinkingLevel: "off",
      thinkingLevelOptions: ["off"],
      temperatureOptions: [0.2, 0.7, 1.2],
      apiKey: "test-only"
    };

    await expect(
      captureToolPayload(
        config,
        toolWithParameters("invalid_text_tool", Type.String())
      )
    ).rejects.toThrow(/invalid_text_tool.*type: "object"/u);
  });

  it("sanitizes only Ollama transport schemas without weakening local validation", async () => {
    const baseConfig: AgentProviderRuntimeConfig = {
      id: "local-writer",
      label: "Local writer",
      provider: "ollama",
      modelId: "qwen3",
      api: "openai-completions",
      baseUrl: "https://ollama.example.test/v1",
      reasoning: false,
      defaultThinkingLevel: "off",
      thinkingLevelOptions: ["low", "medium", "high"],
      temperatureOptions: [0.2, 0.7, 1.2],
      apiKey: ""
    };
    const tool = ollamaGrammarRegressionTool();
    const ollamaPayload = await captureToolPayload(baseConfig, tool);
    const ollamaParameters = (
      ollamaPayload.tools as Array<{
        function: { parameters: Record<string, unknown> };
      }>
    )[0]!.function.parameters;

    expect(ollamaParameters).toMatchObject({
      properties: {
        direct_text: { type: "string", maxLength: 200_000 },
        replacements: {
          items: {
            properties: {
              original_text: { type: "string", minLength: 1 },
              new_text: { type: "string" }
            }
          }
        }
      }
    });
    const ollamaNested = (
      (ollamaParameters.properties as Record<string, unknown>).replacements as {
        items: { properties: Record<string, Record<string, unknown>> };
      }
    ).items.properties;
    expect(ollamaNested.original_text).not.toHaveProperty("maxLength");
    expect(ollamaNested.new_text).not.toHaveProperty("maxLength");

    const originalParameters = tool.parameters as unknown as {
      properties: Record<string, unknown>;
    };
    const originalNested = (
      originalParameters.properties.replacements as {
        items: { properties: Record<string, Record<string, unknown>> };
      }
    ).items.properties;
    expect(originalNested.original_text).toHaveProperty("maxLength", 2_400);
    expect(originalNested.new_text).toHaveProperty("maxLength", 20_000);

    const customPayload = await captureToolPayload(
      { ...baseConfig, provider: "custom", apiKey: "test-only" },
      tool
    );
    const customParameters = (
      customPayload.tools as Array<{
        function: { parameters: Record<string, unknown> };
      }>
    )[0]!.function.parameters;
    const customNested = (
      (customParameters.properties as Record<string, unknown>).replacements as {
        items: { properties: Record<string, Record<string, unknown>> };
      }
    ).items.properties;
    expect(customNested.original_text).toHaveProperty("maxLength", 2_400);
    expect(customNested.new_text).toHaveProperty("maxLength", 20_000);
  });
});
