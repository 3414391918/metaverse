import type {
  AgentProviderRuntimeConfig,
  ModelConnectionTestResult
} from "@deepwrite/contracts";
import type { ThinkingLevel as ProviderThinkingLevel } from "@earendil-works/pi-ai";
import { buildProviderRuntime, toPiThinkingLevel } from "./provider-runtime";
import { normalizeUsage } from "./event-mapping";
export async function testModelConnection(
  config: AgentProviderRuntimeConfig
): Promise<ModelConnectionTestResult> {
  const configuredThinkingLevel = config.defaultThinkingLevel;
  const effectiveTemperature =
    configuredThinkingLevel === "off"
      ? config.temperatureOptions[1]
      : undefined;
  const { model, streamFn } = buildProviderRuntime(
    config,
    effectiveTemperature,
    configuredThinkingLevel
  );
  const stream = streamFn(
    model,
    {
      systemPrompt: "You are a connection test. Reply with OK only.",
      messages: [{ role: "user", content: "OK", timestamp: Date.now() }]
    },
    {
      ...(config.apiKey ? { apiKey: config.apiKey } : {}),
      maxTokens: 8,
      maxRetries: 0,
      ...(configuredThinkingLevel === "off"
        ? {}
        : {
            reasoning: toPiThinkingLevel(
              configuredThinkingLevel
            ) as ProviderThinkingLevel
          }),
      timeoutMs: 15_000
    }
  );
  const result = await (await stream).result();
  if (result.stopReason === "error" || result.stopReason === "aborted") {
    throw new Error(result.errorMessage || "模型连接测试失败。");
  }
  const usage = normalizeUsage(result.usage);
  return {
    modelId: config.id,
    ok: true,
    message: "连接成功，模型已返回有效响应。",
    testedAt: new Date().toISOString(),
    contextWindow: model.contextWindow,
    maxTokens: model.maxTokens,
    ...(usage ? { usage } : {})
  };
}
