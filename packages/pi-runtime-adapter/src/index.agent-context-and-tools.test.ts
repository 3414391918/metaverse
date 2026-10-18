import { profile, workspace } from "./long-agent-tools.test-support";
import {
  DEFAULT_LIBRARY_AGENT_PROFILES,
  PiAgentRuntimeAdapter,
  createShortWorkspaceContentRevision,
  describe,
  expect,
  it,
  providerRuntime,
  toRuntimeEvents
} from "./index.test-support";

describe("DeepWrite Pi runtime adapter: agent-context-and-tools", () => {
  it("uses the same permanent-context transcript for skill-library agents", async () => {
    const profile = DEFAULT_LIBRARY_AGENT_PROFILES.find(
      ({ domain }) => domain === "skill"
    )!;
    const libraryWorkspace = {
      domain: "skill" as const,
      libraryId: "skill-library-history",
      title: "悬疑写作技能",
      libraryType: "short" as const,
      kind: "general" as const,
      overviewDocumentId: "skill-overview-history",
      overview: "沉淀悬疑写作检查方法",
      overviewRevision:
        createShortWorkspaceContentRevision("沉淀悬疑写作检查方法"),
      readOnly: false,
      projectRevision: 1,
      entries: []
    };
    const runtime = new PiAgentRuntimeAdapter({ tokensPerSecond: 0 });

    for (const [index, prompt] of [
      "先检查技能结构",
      "继续补充验收标准"
    ].entries()) {
      for await (const _event of runtime.start({
        runId: `run_skill_library_history_${index}`,
        sessionId: "session_skill_library_history",
        prompt,
        thinkingLevel: "off",
        libraryAgentProfile: profile,
        workspaceContext: { libraryWorkspace }
      })) {
        // Consume both turns before inspecting the skill-library transcript.
      }
    }

    const cache = (
      runtime as unknown as {
        conversationAgents: Map<
          string,
          { state: { messages: Array<{ role?: string; content?: unknown }> } }
        >;
      }
    ).conversationAgents;
    const agent = cache.get(
      "session_skill_library_history:library:skill:skill-library-history"
    );
    const userMessages = agent?.state.messages.filter(
      (message) => message.role === "user"
    );

    expect(userMessages).toHaveLength(2);
    expect(String(userMessages?.[0]?.content)).toContain(
      "【本次智能体会话固定上下文】"
    );
    expect(String(userMessages?.[0]?.content)).toContain(
      "当前资料库: 《悬疑写作技能》"
    );
    expect(String(userMessages?.[0]?.content)).toContain("先检查技能结构");
    expect(userMessages?.[1]?.content).toBe("继续补充验收标准");
  });

  it("injects spawn_subagent only when the active creation agent has enabled definitions", async () => {
    const longAgentProfile = profile("long");
    const longWorkspace = workspace("long", "character_design");
    const runtime = new PiAgentRuntimeAdapter({ tokensPerSecond: 0 });

    for await (const _event of runtime.start({
      runId: "run_with_subagent",
      sessionId: "session_with_subagent",
      prompt: "检查人物",
      thinkingLevel: "off",
      longAgentProfile,
      subagentDefinitions: [
        {
          id: "character_reviewer",
          name: "人物审校",
          description: "检查人物设定冲突。",
          systemPrompt: "只做人物一致性检查。",
          enabled: true,
          modelMode: "inherit"
        }
      ],
      workspaceContext: { longWorkspace }
    })) {
      // Consume before reading the parent agent's current tool set.
    }
    for await (const _event of runtime.start({
      runId: "run_without_subagent",
      sessionId: "session_without_subagent",
      prompt: "检查人物",
      thinkingLevel: "off",
      longAgentProfile,
      subagentDefinitions: [
        {
          id: "disabled_reviewer",
          name: "停用审校",
          description: "当前停用。",
          systemPrompt: "不要执行。",
          enabled: false,
          modelMode: "inherit"
        }
      ],
      workspaceContext: { longWorkspace }
    })) {
      // Consume before reading the second parent agent's current tool set.
    }

    const cache = (
      runtime as unknown as {
        conversationAgents: Map<
          string,
          { state: { tools: Array<{ name: string }> } }
        >;
      }
    ).conversationAgents;
    expect(
      cache
        .get("session_with_subagent:long:long:longbook_tools")
        ?.state.tools.map(({ name }) => name)
    ).toContain("spawn_subagent");
    expect(
      cache
        .get("session_without_subagent:long:long:longbook_tools")
        ?.state.tools.map(({ name }) => name)
    ).not.toContain("spawn_subagent");
  });

  it("projects all child long-form proposals onto the parent approval chain", () => {
    const proposals = [
      {
        toolName: "propose_long_mutation",
        eventType: "long.mutation_proposal",
        details: {
          kind: "long-mutation-proposal",
          bookId: "longbook-child",
          agentId: "long",
          batch: {
            updatedAt: "2026-07-26T12:00:00.000Z",
            operations: [],
            documentWrites: []
          },
          summary: "更新世界规则"
        }
      },
      {
        toolName: "write_worldbuilding_file",
        eventType: "long.worldbuilding_file_proposal",
        details: {
          kind: "long-worldbuilding-file-proposal",
          bookId: "longbook-child",
          agentId: "long",
          batch: {
            updatedAt: "2026-07-26T12:00:00.000Z",
            operations: [],
            documentWrites: [
              {
                proposalId: "proposal_world_rules",
                fileId: "long.worldbuilding.world_rules",
                content: "新规则",
                mode: "replace",
                updatedAt: "2026-07-26T12:00:00.000Z",
                reason: "更新世界规则文件"
              }
            ]
          },
          summary: "更新世界规则文件",
          files: [
            {
              categoryId: "world_rules",
              fileId: "long.worldbuilding.world_rules",
              filePath: "long/worldbuilding/world_rules/content.md",
              title: "世界规则",
              operation: "edit",
              beforeText: "旧规则",
              afterText: "新规则"
            }
          ]
        }
      },
      {
        toolName: "write_continuity_file",
        eventType: "long.continuity_file_proposal",
        details: {
          kind: "long-continuity-file-proposal",
          bookId: "longbook-child",
          agentId: "long",
          batch: {
            updatedAt: "2026-07-26T12:00:00.000Z",
            operations: [],
            documentWrites: [
              {
                proposalId: "proposal_continuity_foreshadowing",
                fileId: "file_chapter_one:continuity:foreshadowing-changes",
                content: "蜡封伏笔已种下。",
                mode: "replace",
                updatedAt: "2026-07-26T12:00:00.000Z",
                reason: "记录伏笔变化"
              }
            ]
          },
          summary: "记录伏笔变化",
          files: [
            {
              chapterCardId: "chapter_one",
              role: "foreshadowing_changes",
              characterId: null,
              fileId: "file_chapter_one:continuity:foreshadowing-changes",
              filePath:
                "long/continuity/chapters/chapter_one/foreshadowing-changes.md",
              title: "第一章 / 伏笔变化",
              operation: "edit",
              beforeText: "无变化。",
              afterText: "蜡封伏笔已种下。"
            }
          ]
        }
      },
      {
        toolName: "propose_long_chapter_write",
        eventType: "long.chapter_write_proposal",
        details: {
          kind: "long-chapter-write-proposal",
          bookId: "longbook-child",
          agentId: "long",
          batch: {
            updatedAt: "2026-07-26T12:00:00.000Z",
            operations: [],
            documentWrites: [
              {
                proposalId: "proposal_chapter_one",
                fileId: "file_chapter_one:body",
                content: "正文",
                mode: "replace",
                updatedAt: "2026-07-26T12:00:00.000Z",
                reason: "写入第一章"
              }
            ]
          },
          file: {
            chapterCardId: "chapter_one",
            chapterTitle: "第一章",
            fileId: "file_chapter_one:body",
            filePath: "long/chapters/chapter_one/body.md",
            operation: "create",
            beforeText: "",
            afterText: "正文"
          },
          summary: "写入第一章"
        }
      },
      {
        toolName: "propose_long_ledger_commit",
        eventType: "long.ledger_commit_proposal",
        details: {
          kind: "long-ledger-commit-proposal",
          bookId: "longbook-child",
          agentId: "long",
          input: {
            bookId: "longbook-child",
            chapterCardId: "chapter_one",
            commitMessage: "提交第一章",
            chapterSummary: {
              timeline: "时间线",
              characterStates: "人物状态",
              factionStates: "势力状态",
              realmStates: "境界状态",
              foreshadowingStates: "伏笔状态",
              continuityNotes: "连续性说明"
            },
            placementDecisions: {},
            foreshadowingBeatDecisions: {},
            fileUpdates: [],
            coverage: {
              character: { status: "changed", note: "人物状态已核验。" },
              plot: { status: "changed", note: "剧情推进已核验。" },
              foreshadowing: { status: "unchanged", note: "伏笔状态已核验。" },
              world: { status: "unchanged", note: "世界状态已核验。" },
              knowledge: { status: "changed", note: "知识边界已核验。" },
              openLoops: { status: "changed", note: "开放环已核验。" }
            },
            factMutations: [
              {
                factId: "fact_alice_location",
                domain: "character",
                subjectId: "character_alice",
                field: "location",
                value: "北门",
                evidence: "正文写明林岚抵达北门。"
              }
            ],
            knowledgeMutations: [
              {
                factId: "fact_alice_location",
                audienceType: "reader",
                audienceId: null,
                level: "knows",
                evidence: "正文直接呈现。"
              }
            ],
            openLoopMutations: [
              {
                loopId: "loop_alice_return",
                kind: "character",
                status: "open",
                detail: "林岚能否安全返回。",
                subjectId: "character_alice",
                factId: "fact_alice_location",
                evidence: "章末仍有追兵。"
              }
            ],
            chapterOutputs: {
              characterState: "林岚已抵达北门。",
              handoff: {
                summary: "下一章从北门继续。",
                mustCarry: ["林岚位于北门。"],
                nextChapterConstraints: ["追兵仍在场。"],
                openLoops: ["loop_alice_return"]
              }
            }
          },
          summary: "提交第一章连续性"
        }
      }
    ] as const;

    const events = proposals.flatMap((proposal, index) =>
      toRuntimeEvents(
        {
          type: "tool_execution_update",
          toolCallId: "parent-long-spawn",
          toolName: "spawn_subagent",
          args: {},
          partialResult: {
            content: [{ type: "text", text: "子工具结果已同步" }],
            details: {
              kind: "subagent-progress",
              progress: {
                type: "child_tool_details",
                parentToolCallId: "parent-long-spawn",
                subagentRunId: "subrun-long",
                subagentId: "long_reviewer",
                name: "长篇子智能体",
                toolCallId: `subrun-long:child-${index + 1}`,
                toolName: proposal.toolName,
                isError: false,
                result: {
                  content: [{ type: "text", text: "等待审阅" }],
                  details: proposal.details
                }
              }
            }
          }
        } as never,
        {
          runId: "parent-long-run",
          sessionId: "parent-long-session",
          prompt: "委派长篇修改"
        },
        providerRuntime,
        "parent-long-assistant"
      )
    );

    expect(events.map((event) => event.type)).toEqual(
      proposals.map(({ eventType }) => eventType)
    );
    expect(
      events.map((event) => ({
        runId: event.runId,
        sessionId: event.sessionId,
        toolCallId:
          "toolCallId" in event.payload ? event.payload.toolCallId : undefined
      }))
    ).toEqual(
      proposals.map((_, index) => ({
        runId: "parent-long-run",
        sessionId: "parent-long-session",
        toolCallId: `subrun-long:child-${index + 1}`
      }))
    );
    expect(
      events.every((event) => event.payload.runtime === providerRuntime)
    ).toBe(true);
  });
});
