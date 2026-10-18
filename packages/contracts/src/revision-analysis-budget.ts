import type { RevisionAnalysisInput } from "./revision-analysis";
function estimateTokens(text: string): number {
  let count = 0;
  for (const char of text) count += char.codePointAt(0)! > 127 ? 1.5 : 0.25;
  return Math.ceil(count);
}
export function assertRevisionAnalysisBudget(
  input: RevisionAnalysisInput,
  model: { contextWindow?: number | undefined; maxTokens?: number | undefined }
) {
  const available = Math.floor(
    ((model.contextWindow ?? 272_000) - (model.maxTokens ?? 16_000) - 8_000) *
      0.6
  );
  if (estimateTokens(JSON.stringify(input)) > available)
    throw new Error(
      "完整正文与修改理由超过当前模型上下文，请缩短正文或选择更大上下文的模型。内容不会被截断。"
    );
}
