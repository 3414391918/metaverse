import { describe, expect, it } from "vitest";
import { WorkspaceRuntimeContextSchema } from "./session/runtime";
import { CommandEnvelopeSchema } from "./system";
import { createEnvelope } from "./envelope";

describe("unified creation runtime boundary", () => {
  it.each([
    "shortWorkspace",
    "scriptWorkspace",
    "learningImitation",
    "shortBookAnalysis",
    "longBookAnalysis",
    "styleComparison"
  ])(
    "rejects the retired %s context instead of silently dropping it",
    (key) => {
      expect(
        WorkspaceRuntimeContextSchema.safeParse({ [key]: undefined }).success
      ).toBe(false);
    }
  );

  it.each([
    "learningImitationSettings.list",
    "longBookAnalysisSettings.list",
    "shortBookAnalysisSettings.list",
    "bookTemplates.list",
    "workspaceAgents.list",
    "catalog.createShortBook",
    "catalog.createScriptBook",
    "manuscript.exportShort",
    "deviceSync.workspace.list"
  ])("does not expose the retired %s command", (type) => {
    expect(
      CommandEnvelopeSchema.safeParse(
        createEnvelope(
          type,
          {},
          { id: "retired_command", correlationId: "retired_command" }
        )
      ).success
    ).toBe(false);
  });

  it("keeps explicit attached resources usable for the shared library workflow", () => {
    expect(
      WorkspaceRuntimeContextSchema.safeParse({
        attachedSkills: [
          {
            id: "method",
            title: "写作方法",
            source: "attached-skill",
            kind: "general",
            content: "关注人物动机。"
          }
        ]
      }).success
    ).toBe(true);
  });
});
