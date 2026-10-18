import type { ModelConfig } from "@deepwrite/contracts";

export function isFreeModelAvailable(
  model: Pick<ModelConfig, "status">
): boolean {
  return model.status !== 1;
}

export function freeModelStatus(
  model: Pick<ModelConfig, "status">
): "可用" | "暂不可用" {
  return isFreeModelAvailable(model) ? "可用" : "暂不可用";
}
