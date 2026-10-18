import {
  CommandEnvelopeSchema,
  DEFAULT_LONG_AGENT_PROFILES,
  LongGetWorkspaceIndexCommandEnvelopeSchema,
  SystemEventEnvelopeSchema,
  createEnvelope,
  longChapterBodyFileId,
  longChapterFilePath,
  type SystemEventEnvelope
} from "@deepwrite/contracts";
import type {
  AgentRunInput,
  AgentRuntimeEvent
} from "@deepwrite/pi-runtime-adapter";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  UtilityCommandHandlerContext,
  UtilityRuntimeOptions
} from "./runtime";

type AgentCommandHandler = NonNullable<UtilityRuntimeOptions["commandHandler"]>;

const captured = vi.hoisted(() => ({
  commandHandler: undefined as AgentCommandHandler | undefined,
  startInputs: [] as AgentRunInput[],
  runtimeEvents: [] as AgentRuntimeEvent[]
}));

vi.mock("./runtime", () => ({
  bootUtility: vi.fn(
    (
      _worker: string,
      options: { commandHandler?: AgentCommandHandler }
    ): void => {
      captured.commandHandler = options.commandHandler;
    }
  )
}));

vi.mock("@deepwrite/pi-runtime-adapter", () => ({
  PiAgentRuntimeAdapter: class {
    describe(): {
      provider: string;
      model: string;
      mode: "local-faux";
    } {
      return {
        provider: "deepwrite",
        model: "deepwrite-writing-faux",
        mode: "local-faux"
      };
    }

    async *start(input: AgentRunInput): AsyncIterable<AgentRuntimeEvent> {
      captured.startInputs.push(input);
      for (const event of captured.runtimeEvents.splice(0)) {
        yield event;
      }
    }

    async testConnection(): Promise<never> {
      throw new Error("Not used by this test.");
    }

    resolveModelCapacity(): never {
      throw new Error("Not used by this test.");
    }

    resolveUserInput(payload: {
      sessionId: string;
      runId: string;
      requestId: string;
    }) {
      return {
        ...payload,
        resolvedAt: "2026-08-22T00:00:00.000Z"
      };
    }
  }
}));

describe("Agent Utility prompt forwarding", () => {
  beforeEach(() => {
    captured.startInputs.length = 0;
    captured.runtimeEvents.length = 0;
  });

  it("forwards web search for a chat-assistant prompt", async () => {
    await import("./agent-entry");
    const command = CommandEnvelopeSchema.parse(
      createEnvelope(
        "agent.prompt",
        {
          sessionId: "session-chat-web-search",
          message: "查询今天的行业动态",
          conversationHistory: [
            {
              role: "user" as const,
              content: "先聊聊出版趋势",
              createdAt: "2026-08-17T07:58:00.000Z"
            },
            {
              role: "assistant" as const,
              content: "可以先比较纸书与电子书市场。",
              createdAt: "2026-08-17T07:59:00.000Z"
            }
          ],
          conversationHistoryMode: "replace" as const,
          mode: "chat-assistant" as const,
          chatAssistant: {
            mode: "normal" as const,
            webSearchEnabled: true
          },
          chatAssistantRuntimeContext: { mode: "normal" as const }
        },
        {
          id: "command-chat-web-search",
          context: {
            correlationId: "correlation-chat-web-search",
            sessionId: "session-chat-web-search"
          }
        }
      )
    );

    await expect(
      captured.commandHandler!(command, vi.fn())
    ).resolves.toMatchObject({
      status: "accepted"
    });
    await vi.waitFor(() => expect(captured.startInputs).toHaveLength(1));

    expect(captured.startInputs[0]).toMatchObject({
      mode: "chat-assistant",
      conversationHistory: [
        { role: "user", content: "先聊聊出版趋势" },
        { role: "assistant", content: "可以先比较纸书与电子书市场。" }
      ],
      conversationHistoryMode: "replace",
      webSearchEnabled: true
    });
    expect(captured.startInputs[0]?.subagentRuntimeConfigs).toBeUndefined();
  });

  it("forwards workspace web search from the command payload", async () => {
    await import("./agent-entry");
    const command = CommandEnvelopeSchema.parse(
      createEnvelope(
        "agent.prompt",
        {
          sessionId: "session-workspace-web-search",
          message: "查一下近期同类题材",
          webSearchEnabled: true
        },
        {
          id: "command-workspace-web-search",
          context: {
            correlationId: "correlation-workspace-web-search",
            sessionId: "session-workspace-web-search"
          }
        }
      )
    );

    await expect(
      captured.commandHandler!(command, vi.fn())
    ).resolves.toMatchObject({
      status: "accepted"
    });
    await vi.waitFor(() => expect(captured.startInputs).toHaveLength(1));

    expect(captured.startInputs[0]).toMatchObject({
      webSearchEnabled: true
    });
  });

  it("forwards the isolated longAgentProfile and navigation context", async () => {
    await import("./agent-entry");
    const longAgentProfile = DEFAULT_LONG_AGENT_PROFILES.find(
      (profile) => profile.id === "long"
    )!;
    const command = CommandEnvelopeSchema.parse(
      createEnvelope(
        "agent.prompt",
        {
          sessionId: "session-long-forwarding",
          message: "检查世界规则",
          longAgentProfile,
          workspaceContext: {
            longWorkspace: {
              bookId: "longbook_forwarding",
              title: "长篇测试",
              activeRoot: "worldbuilding",
              activeAgentId: "long",
              navigation: {
                schemaVersion: 1,
                bookId: "longbook_forwarding",
                updatedAt: "2026-07-26T10:00:00.000Z",
                counts: {
                  worldbuildingCategories: 0,
                  characters: 0,
                  volumes: 1,
                  arcs: 0,
                  chapterCards: 0,
                  storyEvents: 0,
                  storyPlots: 0,
                  foreshadowingThreads: 0,
                  committedChapters: 0
                },
                worldbuilding: [],
                characters: [],
                volumes: [{ id: "volume_default", title: "第一卷", order: 1 }],
                arcs: [],
                chapterCards: [],
                committedThroughChapterId: null
              }
            }
          }
        },
        {
          id: "command-long-forwarding",
          context: {
            correlationId: "correlation-long-forwarding",
            sessionId: "session-long-forwarding"
          }
        }
      )
    );

    const requestInternalCommand = vi.fn<
      UtilityCommandHandlerContext["requestInternalCommand"]
    >(async (_target, internalCommand) => ({
      status: "accepted",
      requestId: internalCommand.id,
      payload: { forwarded: true }
    }));
    const utilityContext: UtilityCommandHandlerContext = {
      worker: "agent",
      requestId: command.id,
      requestInternalCommand
    };
    const result = await captured.commandHandler!(
      command,
      () => undefined,
      utilityContext
    );
    expect(result.status).toBe("accepted");
    await vi.waitFor(() => expect(captured.startInputs).toHaveLength(1));
    expect(captured.startInputs[0]).toMatchObject({
      longAgentProfile: { id: "long" },
      workspaceContext: {
        longWorkspace: {
          bookId: "longbook_forwarding",
          activeRoot: "worldbuilding"
        }
      }
    });
    expect(captured.startInputs[0]).not.toHaveProperty("agentProfile");
    expect(captured.startInputs[0]).not.toHaveProperty("scriptAgentProfile");
    expect(captured.startInputs[0]?.longCommandExecutor).toBeTypeOf("function");

    const queryCommand = LongGetWorkspaceIndexCommandEnvelopeSchema.parse(
      createEnvelope(
        "long.getWorkspaceIndex",
        { bookId: "longbook_forwarding" },
        {
          id: "query-long-forwarding",
          context: {
            correlationId: "correlation-long-forwarding",
            sessionId: "session-long-forwarding",
            runId: "run-long-forwarding",
            resourceId: "longbook_forwarding"
          }
        }
      )
    );
    const querySignal = new AbortController();
    await expect(
      captured.startInputs[0]!.longCommandExecutor!(
        queryCommand,
        querySignal.signal
      )
    ).resolves.toMatchObject({
      status: "accepted",
      requestId: "query-long-forwarding"
    });
    expect(requestInternalCommand).toHaveBeenCalledWith("core", queryCommand, {
      timeoutMs: 60_000
    });

    const aborted = new AbortController();
    aborted.abort();
    await expect(
      captured.startInputs[0]!.longCommandExecutor!(
        queryCommand,
        aborted.signal
      )
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(requestInternalCommand).toHaveBeenCalledTimes(1);
  });

  it("forwards internal usage observations to Main as validated envelopes", async () => {
    await import("./agent-entry");
    captured.runtimeEvents.push({
      type: "agent.usage_observed",
      runId: "run-usage-envelope",
      sessionId: "session-usage-envelope",
      payload: {
        observationId: "run-usage-envelope:turn:1:attempt:1",
        observedAt: "2026-07-29T10:00:00.000Z",
        messageId: "run-usage-envelope_assistant",
        turnId: "run-usage-envelope:turn:1",
        attempt: 1,
        status: "completed",
        hadToolCall: false,
        usage: {
          inputTokens: 10,
          outputTokens: 4,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          totalTokens: 14
        },
        runtime: {
          provider: "openai",
          model: "writer",
          mode: "provider",
          configId: "writer-config"
        }
      }
    });
    const command = CommandEnvelopeSchema.parse(
      createEnvelope(
        "agent.prompt",
        {
          sessionId: "session-usage-envelope",
          message: "记录用量"
        },
        {
          id: "command-usage-envelope",
          context: {
            correlationId: "correlation-usage-envelope",
            sessionId: "session-usage-envelope"
          }
        }
      )
    );
    const emitted: SystemEventEnvelope[] = [];

    await expect(
      captured.commandHandler!(command, (event) => emitted.push(event))
    ).resolves.toMatchObject({ status: "accepted" });
    await vi.waitFor(() => expect(emitted).toHaveLength(1));

    expect(SystemEventEnvelopeSchema.parse(emitted[0]).type).toBe(
      "agent.usage_observed"
    );
    expect(emitted[0]).toMatchObject({
      payload: {
        observationId: "run-usage-envelope:turn:1:attempt:1",
        runtime: { configId: "writer-config" }
      }
    });
  });

  it("maps a runtime user-input request to a validated system event", async () => {
    await import("./agent-entry");
    captured.runtimeEvents.push({
      type: "agent.user_input_requested",
      runId: "run-user-input",
      sessionId: "session-user-input",
      payload: {
        requestId: "request-tone",
        toolCallId: "ask-tone",
        source: "ask_user_question",
        questions: [
          {
            id: "tone",
            question: "选择叙事语气",
            options: [
              { id: "restrained", label: "克制" },
              { id: "intense", label: "强烈" }
            ]
          }
        ],
        runtime: {
          provider: "deepwrite",
          model: "proposal-test",
          mode: "local-faux"
        }
      }
    });
    const command = CommandEnvelopeSchema.parse(
      createEnvelope(
        "agent.prompt",
        { sessionId: "session-user-input", message: "先确认语气" },
        {
          id: "command-user-input",
          context: {
            correlationId: "correlation-user-input",
            sessionId: "session-user-input"
          }
        }
      )
    );
    const emitted: SystemEventEnvelope[] = [];

    await expect(
      captured.commandHandler!(command, (event) => emitted.push(event))
    ).resolves.toMatchObject({ status: "accepted" });
    await vi.waitFor(() => expect(emitted).toHaveLength(1));

    expect(SystemEventEnvelopeSchema.parse(emitted[0])).toMatchObject({
      type: "agent.user_input_requested",
      payload: {
        sessionId: "session-user-input",
        runId: expect.any(String),
        requestId: "request-tone",
        toolCallId: "ask-tone",
        source: "ask_user_question"
      }
    });
  });

  it("maps all long proposal runtime events to validated system envelopes", async () => {
    await import("./agent-entry");
    const eventBase = {
      runId: "run-long-proposals",
      sessionId: "session-long-proposals"
    };
    const payloadBase = {
      toolCallId: "tool-long-proposal",
      bookId: "longbook_proposals",
      summary: "等待审阅。",
      runtime: {
        provider: "deepwrite",
        model: "proposal-test",
        mode: "local-faux" as const
      }
    };
    captured.runtimeEvents.push(
      {
        ...eventBase,
        type: "long.mutation_proposal",
        payload: {
          ...payloadBase,
          agentId: "long",
          batch: {
            updatedAt: "2026-07-26T12:00:00.000Z",
            operations: [
              {
                type: "worldbuilding.update",
                id: "world_rules",
                patch: { title: "硬规则" }
              }
            ],
            documentWrites: []
          }
        }
      },
      {
        ...eventBase,
        type: "long.worldbuilding_file_proposal",
        payload: {
          ...payloadBase,
          agentId: "long",
          batch: {
            updatedAt: "2026-07-26T12:00:00.000Z",
            operations: [
              {
                type: "worldbuildingItem.create",
                categoryId: "world_rules",
                item: {
                  id: "worlditem_memory",
                  title: "记忆代价",
                  order: 1,
                  file: {
                    id: "file_worlditem_memory:content",
                    path: "long/worldbuilding/world_rules/items/worlditem_memory.md",
                    updatedAt: "2026-07-26T12:00:00.000Z"
                  }
                }
              }
            ],
            documentWrites: []
          },
          files: [
            {
              categoryId: "world_rules",
              itemId: "worlditem_memory",
              fileId: "file_worlditem_memory:content",
              filePath:
                "long/worldbuilding/world_rules/items/worlditem_memory.md",
              title: "记忆代价",
              operation: "create",
              beforeText: "",
              afterText: ""
            }
          ]
        }
      },
      {
        ...eventBase,
        type: "long.chapter_write_proposal",
        payload: {
          ...payloadBase,
          agentId: "long",
          batch: {
            updatedAt: "2026-07-26T12:00:00.000Z",
            operations: [],
            documentWrites: [
              {
                proposalId: "proposal_chapter_one",
                fileId: longChapterBodyFileId("chapter_one"),
                content: "正文",
                mode: "replace",
                updatedAt: "2026-07-26T12:00:00.000Z",
                reason: "完成第一章"
              }
            ]
          },
          file: {
            chapterCardId: "chapter_one",
            chapterTitle: "第一章",
            fileId: longChapterBodyFileId("chapter_one"),
            filePath: longChapterFilePath("chapter_one", "body.md"),
            operation: "create",
            beforeText: "",
            afterText: "正文"
          }
        }
      },
      {
        ...eventBase,
        type: "long.ledger_commit_proposal",
        payload: {
          ...payloadBase,
          agentId: "long",
          input: {
            mode: "structured",
            bookId: "longbook_proposals",
            chapterCardId: "chapter_one",
            commitMessage: "提交第一章连续性",
            chapterSummary: {
              timeline: "第一天。",
              characterStates: "人物状态已核对。",
              factionStates: "势力状态无变化。",
              realmStates: "境界状态无变化。",
              foreshadowingStates: "伏笔状态已核对。",
              continuityNotes: "下一章继续。"
            },
            placementDecisions: {},
            foreshadowingBeatDecisions: {},
            fileUpdates: [],
            coverage: {
              character: {
                status: "unchanged",
                note: "人物状态已核验。"
              },
              plot: {
                status: "unchanged",
                note: "剧情推进已核验。"
              },
              foreshadowing: {
                status: "unchanged",
                note: "伏笔状态已核验。"
              },
              world: {
                status: "unchanged",
                note: "世界状态已核验。"
              },
              knowledge: {
                status: "unchanged",
                note: "知识边界已核验。"
              },
              openLoops: {
                status: "unchanged",
                note: "开放事项已核验。"
              }
            },
            factMutations: [],
            knowledgeMutations: [],
            openLoopMutations: [],
            chapterOutputs: {
              characterState: "第一章章末人物状态。",
              handoff: {
                summary: "下一章继续。",
                mustCarry: [],
                nextChapterConstraints: [],
                openLoops: []
              }
            }
          }
        }
      }
    );
    const command = CommandEnvelopeSchema.parse(
      createEnvelope(
        "agent.prompt",
        {
          sessionId: "session-long-proposals",
          message: "生成三类长篇提案"
        },
        {
          id: "command-long-proposals",
          context: {
            correlationId: "correlation-long-proposals",
            sessionId: "session-long-proposals"
          }
        }
      )
    );
    const emitted: SystemEventEnvelope[] = [];

    await expect(
      captured.commandHandler!(command, (event) => emitted.push(event))
    ).resolves.toMatchObject({ status: "accepted" });
    await vi.waitFor(() => expect(emitted).toHaveLength(4));

    expect(
      emitted.map((event) => SystemEventEnvelopeSchema.parse(event).type)
    ).toEqual([
      "long.mutation_proposal",
      "long.worldbuilding_file_proposal",
      "long.chapter_write_proposal",
      "long.ledger_commit_proposal"
    ]);
    expect(emitted[0]).toMatchObject({
      type: "long.mutation_proposal",
      payload: {
        sessionId: "session-long-proposals",
        runId: "run-long-proposals",
        bookId: "longbook_proposals"
      }
    });
  });
});
