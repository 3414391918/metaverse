import { Check } from "typebox/value";
import { validateToolArguments } from "@earendil-works/pi-ai";
import { describe, expect, it } from "vitest";
import {
  documentExecutor,
  fixtureIndex,
  longTools,
  resultText,
  toolByName
} from "./long-agent-tools.test-support";
import { resolveWritingEditSummary } from "./writing-edit-summary";
import type { AgentTool } from "@earendil-works/pi-agent-core";

function validate(tool: AgentTool, args: Record<string, unknown>) {
  return validateToolArguments(tool, {
    type: "toolCall",
    id: "edit-summary",
    name: tool.name,
    arguments: args
  });
}
describe("long optional edit summary", () => {
  it.each([undefined, "", "   ", "  调整叙述节奏  "])(
    "keeps proposals valid for %j",
    async (summary) => {
      const index = fixtureIndex();
      const tools = longTools({
        index,
        executor: documentExecutor(index),
        autoApproveCrossStageOperations: true
      });
      const edit = toolByName(tools, "edit");
      const result = await edit.execute(
        "write",
        validate(edit, {
          id: "chapter_one",
          document: "body",
          content: "新的正文。",
          ...(summary === undefined ? {} : { summary })
        })
      );
      expect(result.details).toMatchObject({
        summary: summary?.trim() || expect.stringMatching(/^更新《.+》的内容$/u)
      });
    }
  );
  it("handles record metadata and preserves overwrite protection", async () => {
    const index = fixtureIndex();
    const tools = longTools({
      index,
      executor: documentExecutor(index),
      autoApproveCrossStageOperations: true
    });
    const edit = toolByName(tools, "edit");
    const target = { id: "volume_one" };
    index.plot.volumes[0]!.summary = "原有概要。";
    await toolByName(tools, "read").execute("read", target);
    expect(
      resultText(
        await edit.execute(
          "unguarded",
          validate(edit, { ...target, content: "" })
        )
      )
    ).toContain("allow_overwrite_existing=true");
    const cleared = await edit.execute(
      "clear",
      validate(edit, { ...target, content: "", allow_overwrite_existing: true })
    );
    expect(cleared.details).toMatchObject({
      summary: expect.stringMatching(/^清空/u)
    });
    const renamed = await edit.execute(
      "rename",
      validate(edit, { ...target, meta: { title: "新卷名" } })
    );
    expect(renamed.details).toMatchObject({
      summary: expect.stringMatching(/的属性$/u)
    });
  });
  it("rejects invalid types and oversized summaries", () => {
    const index = fixtureIndex();
    const edit = toolByName(
      longTools({ executor: documentExecutor(index) }),
      "edit"
    );
    for (const summary of [null, 123, "x".repeat(1001)]) {
      expect(
        Check(edit.parameters, { id: "book_line", content: "正文", summary })
      ).toBe(false);
    }
  });
});

it("preserves supplied summaries and bounds generated summaries", () => {
  expect(
    resolveWritingEditSummary("  修正时间线  ", "目标", { content: "内容" })
  ).toBe("修正时间线");
  expect(
    resolveWritingEditSummary(undefined, "长标题".repeat(1000), {
      content: "内容",
      meta: {}
    })
  ).toMatch(/内容及属性$/u);
  expect(
    resolveWritingEditSummary(undefined, "长标题".repeat(1000), { content: "" })
      .length
  ).toBeLessThan(1000);
});
