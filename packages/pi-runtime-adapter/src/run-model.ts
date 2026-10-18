import {
  createModels,
  fauxProvider,
  fauxAssistantMessage,
  fauxText,
  fauxThinking,
  type Api,
  type Model
} from "@earendil-works/pi-ai";
import type {
  StreamFn,
  ThinkingLevel as PiThinkingLevel
} from "@earendil-works/pi-agent-core";
import type { AgentRuntimeRef } from "@deepwrite/contracts";
import {
  buildWorkspaceProviderRuntimes,
  toPiThinkingLevel
} from "./provider-runtime";
import { buildLocalThinking, buildLocalWritingResponse } from "./faux-local";
import { analysisFauxResponses } from "./analysis-faux";
import { assertAnalysisRunBudget } from "./analysis-run-budget";
import type { PortableToolSchemaProfile } from "./portable-tool-schema";
import type { AgentRunInput } from "./runtime-types";
export function prepareRunModel(
  input: AgentRunInput,
  runtime: AgentRuntimeRef,
  portableToolSchemaProfile: PortableToolSchemaProfile,
  tokensPerSecond: number
) {
  let model: Model<Api>;
  let streamFn: StreamFn;
  let spawnStreamFn: StreamFn;
  let effectiveThinkingLevel: PiThinkingLevel;

  if (input.runtimeConfig) {
    const configuredThinkingLevel =
      input.thinkingLevel ?? input.runtimeConfig.defaultThinkingLevel;
    const effectiveTemperature =
      configuredThinkingLevel === "off"
        ? (input.temperature ?? input.runtimeConfig.temperatureOptions[1])
        : undefined;
    const providerRuntime = buildWorkspaceProviderRuntimes(
      input.runtimeConfig,
      effectiveTemperature,
      configuredThinkingLevel,
      {
        portableToolSchemaProfile,
        webSearchEnabled: input.webSearchEnabled === true
      }
    );
    model = providerRuntime.model;
    streamFn = providerRuntime.streamFn;
    spawnStreamFn = providerRuntime.spawnStreamFn;
    effectiveThinkingLevel = toPiThinkingLevel(configuredThinkingLevel);
  } else {
    const models = createModels();
    const faux = fauxProvider({
      api: "deepwrite-faux",
      provider: runtime.provider,
      models: [
        {
          id: runtime.model,
          name: "虚拟世界 Local Writing Faux",
          reasoning: true,
          input: ["text"]
        }
      ],
      tokensPerSecond: tokensPerSecond,
      tokenSize: { min: 2, max: 4 }
    });
    models.setProvider(faux.provider);
    const fauxModel = faux.getModel(runtime.model);
    if (!fauxModel) {
      throw new Error("虚拟世界 faux model is unavailable.");
    }
    model = fauxModel;
    streamFn = models.streamSimple.bind(models) as StreamFn;
    spawnStreamFn = streamFn;
    effectiveThinkingLevel = toPiThinkingLevel(input.thinkingLevel ?? "medium");
    const analysisResponses = analysisFauxResponses(input);
    if (analysisResponses) {
      faux.setResponses(analysisResponses);
    } else {
      faux.setResponses([
        fauxAssistantMessage(
          effectiveThinkingLevel === "off"
            ? [fauxText(buildLocalWritingResponse(input))]
            : [
                fauxThinking(buildLocalThinking(input)),
                fauxText(buildLocalWritingResponse(input))
              ]
        )
      ]);
    }
  }

  assertAnalysisRunBudget(input, model);
  const imageAttachments =
    input.attachments?.filter((attachment) => attachment.kind === "image") ??
    [];
  if (imageAttachments.length && !model.input.includes("image")) {
    throw new Error(
      runtime.mode === "local-faux"
        ? "虚拟世界 Faux 不支持图片理解，请先选择支持多模态的真实模型。"
        : `当前模型 ${runtime.model} 不支持图片输入，请更换支持多模态的模型。`
    );
  }
  return { model, streamFn, spawnStreamFn, effectiveThinkingLevel };
}
