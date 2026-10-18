import type {
  AgentTool,
  AgentToolResult,
  StreamFn
} from "@earendil-works/pi-agent-core";
import {
  createModels,
  fauxProvider,
  type Api,
  type Context,
  type Model
} from "@earendil-works/pi-ai";
import { Type } from "typebox";

import {
  buildSpawnSubagentTool,
  isSubagentToolProgressDetails,
  type BuildSpawnSubagentToolInput,
  type SubagentToolDetails,
  type SubagentToolProgress
} from "./subagent-runtime";

const enabledDefinition = {
  id: "continuity_checker",
  name: "连续性检查员",
  description: "检查情节与人物状态连续性。",
  systemPrompt: "只检查连续性，并给出简洁证据。",
  enabled: true,
  modelMode: "inherit" as const
};

function childTool(): AgentTool {
  const parameters = Type.Object({ text: Type.String() });
  return {
    name: "echo_child_context",
    label: "回显子任务",
    description: "测试子智能体工具。",
    parameters,
    execute: async (_toolCallId, params) => ({
      content: [
        {
          type: "text",
          text: `已检查：${String((params as { text?: unknown }).text)}`
        }
      ],
      details: { kind: "none" }
    })
  };
}

function makeHarness(options: {
  tokensPerSecond?: number;
  responses?: Parameters<ReturnType<typeof fauxProvider>["setResponses"]>[0];
  definitions?: BuildSpawnSubagentToolInput["definitions"];
  subagentRuntimeConfigs?: BuildSpawnSubagentToolInput["subagentRuntimeConfigs"];
  buildCustomModelRuntime?: BuildSpawnSubagentToolInput["buildCustomModelRuntime"];
  depth?: number;
  createRunId?: () => string;
  onContext?: (context: Context) => void;
  onModel?: (model: Model<Api>) => void;
  onStreamOptions?: (options: Parameters<StreamFn>[2]) => void;
  buildChildTools?: () => AgentTool[];
  toolExecutionHooks?: BuildSpawnSubagentToolInput["toolExecutionHooks"];
  retryPolicy?: BuildSpawnSubagentToolInput["retryPolicy"];
  systemPromptRequirements?: string;
  timeoutMs?: number;
}) {
  const faux = fauxProvider({
    api: `subagent-test-${Math.random()}`,
    provider: `subagent-test-${Math.random()}`,
    models: [{ id: "subagent-model", name: "Subagent Model", reasoning: true }],
    tokensPerSecond: options.tokensPerSecond ?? 0
  });
  const models = createModels();
  models.setProvider(faux.provider);
  if (options.responses) faux.setResponses(options.responses);
  const model = faux.getModel("subagent-model") as Model<Api>;
  const sourceStream = models.streamSimple.bind(models) as StreamFn;
  const streamFn: StreamFn = (requestModel, context, streamOptions) => {
    options.onModel?.(requestModel);
    options.onContext?.(context);
    options.onStreamOptions?.(streamOptions);
    return sourceStream(requestModel, context, streamOptions);
  };
  const tool = buildSpawnSubagentTool({
    parentSessionId: "parent-session",
    model,
    thinkingLevel: "medium",
    streamFn,
    definitions: options.definitions ?? [enabledDefinition],
    ...(options.subagentRuntimeConfigs
      ? { subagentRuntimeConfigs: options.subagentRuntimeConfigs }
      : {}),
    ...(options.buildCustomModelRuntime
      ? { buildCustomModelRuntime: options.buildCustomModelRuntime }
      : {}),
    buildChildTools: options.buildChildTools ?? (() => [childTool()]),
    ...(options.toolExecutionHooks
      ? { toolExecutionHooks: options.toolExecutionHooks }
      : {}),
    ...(options.retryPolicy ? { retryPolicy: options.retryPolicy } : {}),
    ...(options.systemPromptRequirements
      ? { systemPromptRequirements: options.systemPromptRequirements }
      : {}),
    ...(options.timeoutMs === undefined
      ? {}
      : { timeoutMs: options.timeoutMs }),
    ...(options.depth === undefined ? {} : { depth: options.depth }),
    ...(options.createRunId ? { createRunId: options.createRunId } : {})
  });
  return { tool, faux, parentModel: model };
}

function progressFrom(
  updates: AgentToolResult<SubagentToolDetails>[]
): SubagentToolProgress[] {
  return updates.flatMap((update) =>
    isSubagentToolProgressDetails(update.details)
      ? [update.details.progress]
      : []
  );
}

export { enabledDefinition, childTool, makeHarness, progressFrom };
