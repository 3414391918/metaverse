import {
  isDeepSeekWebSearchCompatible,
  type ModelApi
} from "@deepwrite/contracts/renderer";

export const WORKSPACE_WEB_SEARCH_DISABLED_REASON =
  "仅支持 Provider 为 DeepSeek，且 API 类型为 OpenAI Responses 或 Anthropic Messages 的模型";

export const WORKSPACE_WEB_SEARCH_AUTO_DISABLED_MESSAGE =
  "联网已关闭：仅 DeepSeek 的 Responses 或 Anthropic API 模型支持此功能";

type WebSearchModel =
  | {
      provider: string;
      api: ModelApi;
    }
  | null
  | undefined;

export function isWorkspaceWebSearchAvailable(model: WebSearchModel): boolean {
  return isDeepSeekWebSearchCompatible(model);
}

export function resolveWorkspaceWebSearchEnabled(
  model: WebSearchModel,
  requested: boolean | undefined
): boolean {
  return requested === true && isDeepSeekWebSearchCompatible(model);
}

export function workspaceWebSearchAfterModelChange(
  model: WebSearchModel,
  currentlyEnabled: boolean
): { enabled: boolean; autoDisabled: boolean } {
  if (!currentlyEnabled) {
    return { enabled: false, autoDisabled: false };
  }
  if (isDeepSeekWebSearchCompatible(model)) {
    return { enabled: true, autoDisabled: false };
  }
  return { enabled: false, autoDisabled: true };
}

export function workspaceWebSearchPromptFields(enabled: boolean): {
  webSearchEnabled?: true;
} {
  return enabled ? { webSearchEnabled: true } : {};
}
