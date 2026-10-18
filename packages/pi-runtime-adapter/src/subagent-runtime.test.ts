import type { AgentToolResult, StreamFn } from "@earendil-works/pi-agent-core";
import {
  fauxAssistantMessage,
  fauxText,
  fauxToolCall,
  type Context
} from "@earendil-works/pi-ai";

import { describe, expect, it, vi } from "vitest";
import {
  fixtureIndex,
  documentExecutor,
  longTools,
  LONG_BOOK_LINE_FILE_ID
} from "./long-agent-tools.test-support";
import {
  buildSubagentSystemPrompt,
  type SubagentToolDetails
} from "./subagent-runtime";
import {
  enabledDefinition,
  childTool,
  makeHarness,
  progressFrom
} from "./subagent-runtime.test-support";

describe("subagent prompts and permissions", () => {
  it("disables provider SDK retries for child model requests", async () => {
    const streamOptions: Array<Parameters<StreamFn>[2]> = [];
    const { tool } = makeHarness({
      responses: [fauxAssistantMessage("child done")],
      onStreamOptions: (options) => streamOptions.push(options)
    });
    if (!tool) throw new Error("spawn_subagent was not built");

    await tool.execute("parent-sdk-retry-call", {
      subagent_id: "continuity_checker",
      task: "检查 SDK 重试配置"
    } as never);

    expect(streamOptions).toHaveLength(1);
    expect(streamOptions[0]?.maxRetries).toBe(0);
  });

  it("keeps the child role prompt and appends runtime facts without a write policy", () => {
    const prompt = buildSubagentSystemPrompt(
      {
        ...enabledDefinition,
        systemPrompt: "你是章节写手，负责把委派任务写成章节正文。"
      },
      [
        {
          ...childTool(),
          name: "write_draft_section",
          label: "写入章节正文"
        },
        {
          ...childTool(),
          name: "replace_draft_section_text",
          label: "替换正文章节文本"
        }
      ]
    );

    expect(prompt).toContain("你是章节写手，负责把委派任务写成章节正文。");
    expect(prompt).toContain(
      "【当前子智能体：连续性检查员 / continuity_checker】"
    );
    expect(prompt).toContain("write_draft_section（写入章节正文）");
    expect(prompt).toContain("replace_draft_section_text（替换正文章节文本）");
    expect(prompt).toContain("不继承主对话历史");
    expect(prompt).toContain("你不能创建或调用其它子智能体。");
    expect(prompt).toContain("不要整段粘贴文件原文");
    expect(prompt).not.toContain("你是短篇正文主智能体");
  });

  it("appends runtime-owned creation requirements after the editable child prompt", () => {
    const requirements = [
      "只能为当前 bookId 生成提案。",
      "章节正文不得包含分析标题或写作说明。"
    ].join("\n");
    const prompt = buildSubagentSystemPrompt(
      {
        ...enabledDefinition,
        systemPrompt: "用户可编辑的子智能体提示词。"
      },
      [{ ...childTool(), name: "write_draft_section", label: "写入章节正文" }],
      requirements
    );

    expect(prompt).toContain("用户可编辑的子智能体提示词。");
    expect(prompt).toContain("【本轮不可编辑的写作约束】");
    expect(prompt).toContain(requirements);
    expect(prompt.indexOf(requirements)).toBeGreaterThan(
      prompt.indexOf("用户可编辑的子智能体提示词。")
    );
  });

  it("keeps runtime-owned creation requirements in the executed child context", async () => {
    const contexts: Context[] = [];
    const requirements = "章节正文写入须先读取目标内容并形成提案。";
    const { tool } = makeHarness({
      systemPromptRequirements: requirements,
      onContext: (context) => contexts.push(context),
      responses: [fauxAssistantMessage(fauxText("创作边界检查完成。"))]
    });
    if (!tool) throw new Error("spawn_subagent was not built");

    await tool.execute("parent-screenplay-call", {
      subagent_id: "continuity_checker",
      task: "检查第一集格式"
    } as never);

    expect(contexts[0]?.systemPrompt).toContain("【本轮不可编辑的写作约束】");
    expect(contexts[0]?.systemPrompt).toContain(requirements);
  });

  it("leaves the write-versus-handoff decision to the definition prompt", () => {
    const prompt = buildSubagentSystemPrompt(
      {
        ...enabledDefinition,
        systemPrompt: "你只做一致性审阅，把问题清单交回主智能体，不要写文件。"
      },
      [{ ...childTool(), name: "write_draft_section", label: "写入章节正文" }]
    );

    expect(prompt).toContain("你只做一致性审阅");
    expect(prompt).not.toContain("必须通过这些工具完成");
    expect(prompt).not.toContain("先用读取工具核对目标");
    expect(prompt).not.toContain("代替工具调用");
  });

  it("only exposes spawn for enabled definitions and never at child depth", () => {
    expect(makeHarness({ definitions: [] }).tool).toBeUndefined();
    expect(
      makeHarness({
        definitions: [{ ...enabledDefinition, enabled: false }]
      }).tool
    ).toBeUndefined();
    expect(makeHarness({ depth: 1 }).tool).toBeUndefined();

    const tool = makeHarness({
      definitions: [
        enabledDefinition,
        {
          id: "disabled_writer",
          name: "停用写手",
          description: "不应暴露。",
          systemPrompt: "不要运行。",
          enabled: false,
          modelMode: "inherit"
        }
      ]
    }).tool;
    expect(tool?.name).toBe("spawn_subagent");
    expect(tool?.executionMode).toBe("sequential");
    expect(tool?.description).toContain("continuity_checker");
    expect(tool?.description).not.toContain("disabled_writer");
  });

  it("lets child tools inherit cross-stage auto approval", async () => {
    const requestUserInput = vi.fn(async () => {
      throw new Error("cross-stage input should have been auto-approved");
    });
    const { tool } = makeHarness({
      buildChildTools: () =>
        longTools({
          index: fixtureIndex(),
          executor: documentExecutor(fixtureIndex(), {
            [LONG_BOOK_LINE_FILE_ID]: "唯一片段"
          }),
          autoApproveCrossStageOperations: true,
          requestUserInput
        }),
      responses: [
        fauxAssistantMessage(
          fauxToolCall("read", { id: "book_line" }, { id: "child-read-plot" }),
          { stopReason: "toolUse" }
        ),
        fauxAssistantMessage(
          fauxToolCall(
            "edit",
            {
              id: "book_line",
              replacements: [
                { original_text: "唯一片段", new_text: "子智能体自动允许" }
              ],
              summary: "子智能体跨阶段修改"
            },
            { id: "child-edit-plot" }
          ),
          { stopReason: "toolUse" }
        ),
        fauxAssistantMessage(fauxText("子智能体修改提案已生成。"))
      ]
    });
    if (!tool) throw new Error("spawn_subagent was not built");
    const updates: AgentToolResult<SubagentToolDetails>[] = [];

    await tool.execute(
      "parent-auto-approve-call",
      {
        subagent_id: "continuity_checker",
        task: "跨阶段修改剧情"
      } as never,
      undefined,
      (update) => updates.push(update as AgentToolResult<SubagentToolDetails>)
    );

    expect(requestUserInput).not.toHaveBeenCalled();
    expect(progressFrom(updates)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "child_tool_details",
          toolName: "edit",
          result: expect.objectContaining({
            details: expect.objectContaining({
              kind: "long-mutation-proposal",
              summary: "子智能体跨阶段修改"
            })
          })
        })
      ])
    );
  });
});
