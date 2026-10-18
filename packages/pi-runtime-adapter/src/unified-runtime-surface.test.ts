import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (name: string) =>
  readFileSync(new URL(`./${name}`, import.meta.url), "utf8");

describe("unified creation runtime surface", () => {
  it("does not route retired workspaces into executable tools or prompts", () => {
    const entryPoints = ["run-tools.ts", "prompts.ts", "prompts-system.ts"];
    for (const file of entryPoints) {
      expect(source(file), file).not.toMatch(
        /shortWorkspace|scriptWorkspace|learningImitation|shortBookAnalysis|longBookAnalysis|styleComparison/
      );
    }
  });

  it("does not expose retired creation proposals or analysis events", () => {
    expect(
      source("runtime-types.ts") + source("runtime-events.ts")
    ).not.toMatch(
      /workspace\.editor_mutation|workspace\.stage_selection|short-agent-tools|ShortWorkspaceAgentProfile|ScriptWorkspaceAgentProfile/
    );
    expect(source("analysis-tool-events.ts")).not.toMatch(
      /short_book_analysis|long_book_analysis|short-book-analysis|long-book-analysis/
    );
  });
});
