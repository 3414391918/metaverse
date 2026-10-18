import { DEFAULT_REVISION_METHOD } from "./revision-analysis-defaults";
import { assertRevisionAnalysisBudget } from "./revision-analysis-budget";
import { describe, expect, it } from "vitest";
import {
  RevisionAnalysisInputSchema,
  RevisionAnalysisSkillDraftSchema,
  RevisionAnalysisResultSchema
} from "./revision-analysis";
import { WorkspaceRuntimeContextSchema } from "./session/runtime";
const input = {
  beforeText: "原文",
  afterText: "改文",
  changes: [
    {
      id: "change",
      before: "原文",
      after: "改文",
      beforeStart: 1,
      afterStart: 1,
      reason: "",
      coarse: false
    }
  ],
  overallReason: "",
  systemPrompt: DEFAULT_REVISION_METHOD
};
describe("revision analysis contracts", () => {
  it("accepts optional empty reasons and preserves input whitespace", () => {
    expect(
      RevisionAnalysisInputSchema.parse({ ...input, beforeText: " 原文 " })
        .beforeText
    ).toBe(" 原文 ");
    expect(RevisionAnalysisInputSchema.safeParse(input).success).toBe(true);
  });
  it("rejects missing documents, duplicate identifiers and empty structured results", () => {
    expect(
      RevisionAnalysisInputSchema.safeParse({ ...input, beforeText: " " })
        .success
    ).toBe(false);
    expect(
      RevisionAnalysisInputSchema.safeParse({
        ...input,
        changes: [...input.changes, ...input.changes]
      }).success
    ).toBe(false);
    expect(
      RevisionAnalysisResultSchema.safeParse({
        report: "",
        title: " ",
        description: "用于修订文稿。",
        body: "规则"
      }).success
    ).toBe(false);
  });
  it("accepts a draft before a report and validates all three draft fields", () => {
    const draft = {
      title: "技能",
      description: "用于修订",
      content: "执行规则"
    };
    expect(RevisionAnalysisSkillDraftSchema.parse(draft)).toEqual(draft);
    for (const field of ["title", "description", "content"]) {
      expect(
        RevisionAnalysisSkillDraftSchema.safeParse({ ...draft, [field]: " " })
          .success
      ).toBe(false);
      expect(
        RevisionAnalysisSkillDraftSchema.safeParse({
          ...draft,
          [field]: undefined
        }).success
      ).toBe(false);
    }
    expect(
      RevisionAnalysisResultSchema.parse({
        report: "",
        title: draft.title,
        description: draft.description,
        body: draft.content
      }).report
    ).toBe("");
  });
  it("requires a nonempty skill description within the length limit", () => {
    const draft = { report: "报告", title: "技能", body: "规则" };
    for (const description of [undefined, " ", "字".repeat(4001)]) {
      expect(
        RevisionAnalysisResultSchema.safeParse({ ...draft, description })
          .success
      ).toBe(false);
    }
    expect(
      RevisionAnalysisResultSchema.parse({
        ...draft,
        description: " 用于修订文稿。 "
      }).description
    ).toBe("用于修订文稿。");
  });
  it("is an isolated workspace mode and checks the whole payload budget", () => {
    const revisionAnalysis = { ...input, jobId: "job" };
    expect(
      WorkspaceRuntimeContextSchema.safeParse({ revisionAnalysis }).success
    ).toBe(true);
    expect(
      WorkspaceRuntimeContextSchema.safeParse({
        revisionAnalysis,
        styleComparison: {
          referenceText: "甲",
          comparisonText: "乙",
          method: ""
        }
      }).success
    ).toBe(false);
    expect(() =>
      assertRevisionAnalysisBudget(
        { ...input, beforeText: "字".repeat(100_000) },
        { contextWindow: 32_000, maxTokens: 4000 }
      )
    ).toThrow("不会被截断");
  });
});
