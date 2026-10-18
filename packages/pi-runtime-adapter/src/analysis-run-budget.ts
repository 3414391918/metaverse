import { assertRevisionAnalysisBudget } from "@deepwrite/contracts";
import type { AgentRunInput } from "./runtime-types";
export function assertAnalysisRunBudget(
  input: AgentRunInput,
  model: { contextWindow?: number; maxTokens?: number }
) {
  if (input.workspaceContext?.revisionAnalysis)
    assertRevisionAnalysisBudget(
      input.workspaceContext.revisionAnalysis,
      model
    );
}
