import type { AgentToolResult, StreamFn } from "@earendil-works/pi-agent-core";
import {
  createModels,
  fauxAssistantMessage,
  fauxProvider,
  fauxText,
  type Api,
  type Model
} from "@earendil-works/pi-ai";

import { describe, expect, it } from "vitest";

import { type SubagentToolDetails } from "./subagent-runtime";
import {
  enabledDefinition,
  makeHarness,
  progressFrom
} from "./subagent-runtime.test-support";

describe("subagent model configuration", () => {
  it("uses a custom model runtime when the subagent is configured separately", async () => {
    const customFaux = fauxProvider({
      api: `custom-subagent-${Math.random()}`,
      provider: `custom-subagent-${Math.random()}`,
      models: [
        { id: "custom-child-model", name: "Custom Child", reasoning: true }
      ],
      tokensPerSecond: 0
    });
    const customModels = createModels();
    customModels.setProvider(customFaux.provider);
    customFaux.setResponses([
      fauxAssistantMessage(fauxText("自定义模型交接完成。"))
    ]);
    const customModel = customFaux.getModel("custom-child-model") as Model<Api>;
    const customSourceStream = customModels.streamSimple.bind(
      customModels
    ) as StreamFn;
    const seenModels: Model<Api>[] = [];

    const { tool, parentModel } = makeHarness({
      definitions: [
        {
          ...enabledDefinition,
          modelMode: "custom",
          modelId: "cfg-custom-1",
          thinkingLevel: "low"
        }
      ],
      subagentRuntimeConfigs: {
        "cfg-custom-1": {
          id: "cfg-custom-1",
          label: "自定义子模型",
          provider: "openai-compatible",
          api: "openai-completions",
          modelId: "custom-child-model",
          baseUrl: "https://example.test/v1",
          reasoning: true,
          thinkingLevelOptions: ["low", "medium", "high"],
          defaultThinkingLevel: "medium",
          temperatureOptions: [0, 0.7, 1],
          apiKey: "test-key"
        }
      },
      buildCustomModelRuntime: (_config, options) => {
        expect(options?.thinkingLevel).toBe("low");
        return {
          model: customModel,
          streamFn: (requestModel, context, streamOptions) => {
            seenModels.push(requestModel);
            return customSourceStream(requestModel, context, streamOptions);
          },
          thinkingLevel: "low"
        };
      },
      responses: [fauxAssistantMessage(fauxText("不应使用父模型。"))]
    });
    if (!tool) throw new Error("spawn_subagent was not built");
    const updates: AgentToolResult<SubagentToolDetails>[] = [];

    const result = await tool.execute(
      "parent-custom-model",
      { subagent_id: "continuity_checker", task: "用单独模型执行" } as never,
      undefined,
      (update) => updates.push(update as AgentToolResult<SubagentToolDetails>)
    );

    expect(seenModels[0]?.id).toBe("custom-child-model");
    expect(seenModels[0]?.id).not.toBe(parentModel.id);
    expect(
      progressFrom(updates).find((item) => item.type === "usage_observed")
    ).toMatchObject({
      runtime: {
        provider: "openai-compatible",
        model: "custom-child-model",
        mode: "provider",
        configId: "cfg-custom-1"
      }
    });
    expect(result.content[0]).toMatchObject({
      type: "text",
      text: "自定义模型交接完成。"
    });
  });

  it("passes temperature into custom runtime when thinking is off", async () => {
    const customFaux = fauxProvider({
      api: `custom-temp-${Math.random()}`,
      provider: `custom-temp-${Math.random()}`,
      models: [
        { id: "custom-temp-model", name: "Custom Temp", reasoning: false }
      ],
      tokensPerSecond: 0
    });
    const customModels = createModels();
    customModels.setProvider(customFaux.provider);
    customFaux.setResponses([
      fauxAssistantMessage(fauxText("关闭思考后的温度执行完成。"))
    ]);
    const customModel = customFaux.getModel("custom-temp-model") as Model<Api>;
    let seenTemperature: number | undefined;

    const { tool } = makeHarness({
      definitions: [
        {
          ...enabledDefinition,
          modelMode: "custom",
          modelId: "cfg-temp-1",
          thinkingLevel: "off",
          temperature: 1
        }
      ],
      subagentRuntimeConfigs: {
        "cfg-temp-1": {
          id: "cfg-temp-1",
          label: "温度模型",
          provider: "openai-compatible",
          api: "openai-completions",
          modelId: "custom-temp-model",
          baseUrl: "https://example.test/v1",
          reasoning: false,
          thinkingLevelOptions: ["low", "medium", "high"],
          defaultThinkingLevel: "off",
          temperatureOptions: [0, 0.7, 1],
          apiKey: "test-key"
        }
      },
      buildCustomModelRuntime: (_config, options) => {
        seenTemperature = options?.temperature;
        return {
          model: customModel,
          streamFn: customModels.streamSimple.bind(customModels) as StreamFn,
          thinkingLevel: "off"
        };
      }
    });
    if (!tool) throw new Error("spawn_subagent was not built");

    const result = await tool.execute("parent-temp-model", {
      subagent_id: "continuity_checker",
      task: "验证温度"
    } as never);

    expect(seenTemperature).toBe(1);
    expect(result.content[0]).toMatchObject({
      type: "text",
      text: "关闭思考后的温度执行完成。"
    });
  });

  it("fails clearly when a custom model config is missing at spawn time", async () => {
    const { tool } = makeHarness({
      definitions: [
        {
          ...enabledDefinition,
          modelMode: "custom",
          modelId: "missing-model"
        }
      ]
    });
    if (!tool) throw new Error("spawn_subagent was not built");
    const updates: AgentToolResult<SubagentToolDetails>[] = [];

    const result = await tool.execute(
      "parent-missing-model",
      { subagent_id: "continuity_checker", task: "缺少模型" } as never,
      undefined,
      (update) => updates.push(update as AgentToolResult<SubagentToolDetails>)
    );

    expect(progressFrom(updates).at(-1)).toMatchObject({
      status: "error",
      errorMessage: expect.stringContaining("模型不可用")
    });
    expect(result.content[0]).toMatchObject({
      type: "text",
      text: expect.stringContaining("模型不可用")
    });
  });
});
