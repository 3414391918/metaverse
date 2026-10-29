import type { AgentConversationPersistenceSnapshot } from "./useAgentConversation.test-support";
import {
  createEditProposal,
  createMemoryStorage,
  describe,
  document,
  expect,
  it,
  storedConversation,
  useAgentConversation
} from "./useAgentConversation.test-support";

describe("agent conversation controller: snapshot-persistence", () => {
  it("restores top-level model identity and real usage for context display", () => {
    const snapshot: AgentConversationPersistenceSnapshot = {
      version: 1,
      activeSessionId: "session-context-usage",
      conversations: [
        {
          ...storedConversation(
            "session-context-usage",
            "2026-08-28T08:00:00.000Z",
            "继续写"
          ),
          messages: [
            {
              id: "assistant-context-usage",
              role: "assistant",
              content: "已完成。",
              createdAt: "2026-08-28T08:01:00.000Z",
              status: "completed",
              runtime: {
                provider: "example",
                model: "writer-1",
                mode: "provider",
                configId: "model-config-1"
              },
              usage: {
                inputTokens: 12_000,
                outputTokens: 345,
                cacheReadTokens: 0,
                cacheWriteTokens: 0,
                totalTokens: 12_345
              }
            }
          ]
        }
      ]
    };

    const controller = useAgentConversation({
      api: () => undefined,
      initialPersistenceSnapshot: snapshot
    });

    expect(controller.messages.value[0]?.runtime).toEqual({
      provider: "example",
      model: "writer-1",
      mode: "provider",
      configId: "model-config-1"
    });
    expect(controller.messages.value[0]?.usage).toEqual({
      inputTokens: 12_000,
      outputTokens: 345,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      totalTokens: 12_345
    });
    controller.dispose();
  });

  it("adds and replaces edit proposals with deep-cloned diff state", () => {
    const controller = useAgentConversation({ api: () => undefined });
    controller.messages.value = [
      {
        id: "run_edit_1_assistant",
        role: "assistant",
        content: "已生成修改建议",
        createdAt: "2026-07-19T11:00:00.000Z",
        runId: "run_edit_1",
        status: "completed"
      }
    ];
    const proposal = createEditProposal();

    controller.upsertEditProposal("run_edit_1", proposal);
    proposal.toolCallIds.push("mutated_outside");
    proposal.hunks[0]!.lines[0]!.text = "外部改写";

    const storedProposal = controller.getEditProposal(
      "run_edit_1",
      "proposal_1"
    );
    expect(storedProposal).toMatchObject({
      summary: "调整雨夜相遇的因果关系",
      toolCallIds: ["tool_edit_1"]
    });
    expect(storedProposal?.hunks[0]?.lines[0]?.text).toBe("旧句");

    controller.upsertEditProposal(
      "run_edit_1",
      createEditProposal({
        summary: "更新后的修改摘要",
        additions: 2,
        updatedAt: "2026-07-19T11:02:00.000Z"
      })
    );

    expect(controller.messages.value[0]?.editProposals).toHaveLength(1);
    expect(
      controller.getEditProposal("run_edit_1", "proposal_1")
    ).toMatchObject({
      summary: "更新后的修改摘要",
      additions: 2,
      updatedAt: "2026-07-19T11:02:00.000Z"
    });
    controller.dispose();
  });

  it("updates completed-run proposal status through the pending-review lifecycle", () => {
    const controller = useAgentConversation({ api: () => undefined });
    controller.messages.value = [
      {
        id: "run_edit_1_assistant",
        role: "assistant",
        content: "本轮已经完成",
        createdAt: "2026-07-19T11:00:00.000Z",
        runId: "run_edit_1",
        status: "completed"
      }
    ];
    controller.upsertEditProposal("run_edit_1", createEditProposal());

    expect(controller.hasPendingEditReview.value).toBe(true);

    expect(
      controller.updateEditProposal("run_edit_1", "proposal_1", {
        status: "accepting",
        statusMessage: "正在应用"
      })
    ).toMatchObject({ status: "accepting", statusMessage: "正在应用" });
    expect(controller.hasPendingEditReview.value).toBe(true);

    expect(
      controller.updateEditProposal("run_edit_1", "proposal_1", {
        status: "accepted",
        statusMessage: "已应用"
      })
    ).toMatchObject({ status: "accepted", statusMessage: "已应用" });
    expect(controller.hasPendingEditReview.value).toBe(false);
    controller.dispose();
  });

  it("unblocks pending review after an in-flight proposal save fails", () => {
    const controller = useAgentConversation({ api: () => undefined });
    controller.messages.value = [
      {
        id: "run_edit_timeout_assistant",
        role: "assistant",
        content: "本轮已经完成",
        createdAt: "2026-07-19T11:00:00.000Z",
        runId: "run_edit_timeout",
        status: "completed"
      }
    ];
    controller.upsertEditProposal(
      "run_edit_timeout",
      createEditProposal({ runId: "run_edit_timeout" })
    );

    controller.updateEditProposal("run_edit_timeout", "proposal_1", {
      status: "accepting",
      statusMessage: "正在保存"
    });
    expect(controller.hasPendingEditReview.value).toBe(true);

    controller.updateEditProposal("run_edit_timeout", "proposal_1", {
      status: "error",
      statusMessage: "保存超时"
    });
    expect(controller.hasPendingEditReview.value).toBe(false);
    controller.dispose();
  });

  it("persists proposal content with the conversation history and reloads it", () => {
    const storage = createMemoryStorage();
    const persistenceKey = "conversation-proposal-persistence-test";
    const controller = useAgentConversation({
      api: () => undefined,
      ...storage.options(persistenceKey)
    });
    controller.messages.value = [
      {
        id: "run_edit_persist_assistant",
        role: "assistant",
        content: "已生成修改建议",
        createdAt: "2026-07-19T11:00:00.000Z",
        runId: "run_edit_persist",
        status: "completed"
      }
    ];
    controller.upsertEditProposal(
      "run_edit_persist",
      createEditProposal({ runId: "run_edit_persist" })
    );
    controller.draft.value = "保留修改建议的草稿";
    controller.dispose();

    const restored = useAgentConversation({
      api: () => undefined,
      ...storage.options(persistenceKey)
    });
    expect(
      restored.getEditProposal("run_edit_persist", "proposal_1")
    ).toMatchObject({
      summary: "调整雨夜相遇的因果关系",
      proposedRevision: "v1:5:22222222",
      hunks: [{ oldStart: 1, newStart: 1, newLines: 2 }]
    });
    restored.dispose({ clearPersistence: true });
  });

  it("restores a validated structured snapshot into a pristine controller", async () => {
    const snapshot: AgentConversationPersistenceSnapshot = {
      version: 1,
      activeSessionId: "session-restored",
      conversations: [
        storedConversation(
          "session-restored",
          "2026-08-14T01:00:00.000Z",
          "从异步存储恢复的消息"
        )
      ]
    };
    snapshot.conversations[0]!.draft = "从异步存储恢复的草稿";
    const controller = useAgentConversation({ api: () => undefined });

    await expect(controller.restorePersistenceSnapshot(snapshot)).resolves.toBe(
      true
    );
    expect(controller.sessionId.value).toBe("session-restored");
    expect(controller.messages.value[0]?.content).toBe("从异步存储恢复的消息");
    expect(controller.draft.value).toBe("从异步存储恢复的草稿");
    controller.dispose();
  });

  it("does not let a late persistence snapshot overwrite a local edit", async () => {
    const snapshot: AgentConversationPersistenceSnapshot = {
      version: 1,
      activeSessionId: "session-stale",
      conversations: [
        storedConversation(
          "session-stale",
          "2026-08-14T01:00:00.000Z",
          "已经过时的历史消息"
        )
      ]
    };
    const controller = useAgentConversation({ api: () => undefined });

    const restoring = controller.restorePersistenceSnapshot(snapshot);
    controller.draft.value = "用户刚刚输入的新草稿";

    await expect(restoring).resolves.toBe(false);
    expect(controller.draft.value).toBe("用户刚刚输入的新草稿");
    expect(controller.messages.value).toEqual([]);
    controller.dispose();
  });

  it("restores a snapshot that omitted draft and temperature", async () => {
    const controller = useAgentConversation({ api: () => undefined });
    await expect(
      controller.restorePersistenceSnapshot({
        version: 1,
        activeSessionId: "session-legacy",
        conversations: [
          {
            sessionId: "session-legacy",
            messages: [
              {
                id: "user-legacy",
                role: "user",
                content: "检查设定冲突",
                createdAt: "2026-08-15T07:51:00.000Z"
              }
            ],
            createdAt: "2026-08-15T07:51:00.000Z",
            updatedAt: "2026-08-15T07:51:09.000Z"
          }
        ]
      })
    ).resolves.toBe(true);
    expect(controller.sessionId.value).toBe("session-legacy");
    expect(controller.messages.value[0]?.content).toBe("检查设定冲突");
    expect(controller.draft.value).toBe("");
    expect(controller.temperature.value).toBe(0.7);
    controller.dispose();
  });

  it("keeps valid conversations when one stored session cannot be parsed", async () => {
    const controller = useAgentConversation({ api: () => undefined });
    await expect(
      controller.restorePersistenceSnapshot({
        version: 1,
        activeSessionId: "session-valid",
        conversations: [
          storedConversation(
            "session-valid",
            "2026-08-15T07:51:00.000Z",
            "检查设定冲突"
          ),
          { sessionId: "session-invalid", messages: "invalid" }
        ]
      })
    ).resolves.toBe(true);
    expect(controller.sessionId.value).toBe("session-valid");
    expect(controller.history.value).toHaveLength(1);
    controller.dispose();
  });

  it("does not persist while hydration is holding writes", () => {
    const snapshots: AgentConversationPersistenceSnapshot[] = [];
    const controller = useAgentConversation({
      api: () => undefined,
      onPersistenceSnapshot(snapshot) {
        snapshots.push(snapshot);
      }
    });

    controller.holdPersistenceEmits();
    controller.messages.value = [
      {
        id: "sent-first",
        role: "user",
        content: "已发送的消息",
        createdAt: "2026-09-07T00:00:00.000Z"
      }
    ];
    controller.draft.value = "水合完成前不应落盘";
    expect(snapshots).toEqual([]);
    controller.releasePersistenceEmits();
    controller.draft.value = "水合完成后可以落盘";
    expect(snapshots.at(-1)).toMatchObject({
      conversations: [{ draft: "水合完成后可以落盘" }]
    });
    controller.dispose();
  });

  it("rejects malformed snapshots without changing the active conversation", async () => {
    const controller = useAgentConversation({ api: () => undefined });
    const originalSessionId = controller.sessionId.value;

    await expect(
      controller.restorePersistenceSnapshot({
        version: 1,
        activeSessionId: "session-invalid",
        conversations: [{ sessionId: "session-invalid", messages: "invalid" }]
      })
    ).resolves.toBe(false);
    expect(controller.sessionId.value).toBe(originalSessionId);
    expect(controller.messages.value).toEqual([]);
    controller.dispose();
  });

  it("emits structured snapshots on changes but does not write during dispose", () => {
    const snapshots: AgentConversationPersistenceSnapshot[] = [];
    const controller = useAgentConversation({
      api: () => undefined,
      onPersistenceSnapshot(snapshot) {
        snapshots.push(snapshot);
      }
    });

    controller.messages.value = [
      {
        id: "sent-first",
        role: "user",
        content: "已发送的消息",
        createdAt: "2026-09-07T00:00:00.000Z"
      }
    ];
    controller.draft.value = "需要持久化的草稿";
    expect(snapshots.at(-1)).toMatchObject({
      version: 1,
      activeSessionId: controller.sessionId.value,
      conversations: [{ draft: "需要持久化的草稿" }]
    });
    const writesBeforeDispose = snapshots.length;

    controller.dispose();
    expect(snapshots).toHaveLength(writesBeforeDispose);
  });

  it("can emit a cheap dirty signal and defer structured snapshot capture", () => {
    const changes: string[] = [];
    const eagerSnapshots: AgentConversationPersistenceSnapshot[] = [];
    const controller = useAgentConversation({
      api: () => undefined,
      onPersistenceChange() {
        changes.push("changed");
      },
      onPersistenceSnapshot(snapshot) {
        eagerSnapshots.push(snapshot);
      }
    });

    controller.draft.value = "输入热路径不复制整份历史";
    expect(changes).toEqual(["changed"]);
    expect(eagerSnapshots).toEqual([]);
    expect(controller.capturePersistenceSnapshot()).toMatchObject({
      conversations: []
    });
    controller.dispose();
  });

  it("persists the approval mode with its conversation", () => {
    const storage = createMemoryStorage();
    const persistenceKey = "conversation-approval-mode-test";
    const controller = useAgentConversation({
      api: () => undefined,
      ...storage.options(persistenceKey)
    });
    expect(controller.approvalMode.value).toBe("request-approval");
    controller.messages.value = [
      {
        id: "sent-first",
        role: "user",
        content: "已发送的消息",
        createdAt: "2026-09-07T00:00:00.000Z"
      }
    ];
    controller.draft.value = "保留这份对话草稿";
    controller.selectApprovalMode("auto-approve");
    controller.dispose();

    const restored = useAgentConversation({
      api: () => undefined,
      ...storage.options(persistenceKey)
    });
    expect(restored.approvalMode.value).toBe("auto-approve");
    restored.dispose();
  });

  it("captures and acknowledges incremental persistence changes instead of full snapshots", () => {
    const controller = useAgentConversation({ api: () => undefined });
    controller.draft.value = "第一次修改";
    const baseline = controller.capturePersistenceChanges();
    expect(baseline).not.toBeNull();
    controller.acknowledgePersistenceChanges(baseline!.revision);
    expect(controller.capturePersistenceChanges()!.conversations).toEqual([]);

    controller.draft.value = "第二次修改";
    const incremental = controller.capturePersistenceChanges();
    expect(incremental).not.toBeNull();
    expect(incremental!.revision).toBeGreaterThan(baseline!.revision);

    controller.acknowledgePersistenceChanges(incremental!.revision);
    expect(controller.capturePersistenceChanges()!.conversations).toEqual([]);
    controller.dispose();
  });

  it("stores a deeply-cloned history snapshot and reloads it into a fresh controller", () => {
    const storage = createMemoryStorage();
    const persistenceKey = "conversation-history-clone-test";
    const controller = useAgentConversation({
      api: () => undefined,
      ...storage.options(persistenceKey)
    });
    controller.messages.value = [
      {
        id: "user-clone-1",
        role: "user",
        content: "帮我规划雨夜相遇。",
        createdAt: "2026-08-17T07:58:00.000Z",
        status: "completed"
      },
      {
        id: "assistant-clone-1",
        role: "assistant",
        content: "可以从旧站台的一封错投来信开始。",
        createdAt: "2026-08-17T07:59:00.000Z",
        status: "completed",
        runId: "run_clone_1"
      }
    ];
    controller.draft.value = "继续这一段";
    const persisted = controller.capturePersistenceSnapshot();
    expect(() => structuredClone(persisted)).not.toThrow();
    controller.dispose();

    const restored = useAgentConversation({
      api: () => undefined,
      ...storage.options(persistenceKey)
    });
    expect(restored.messages.value.map((message) => message.content)).toEqual([
      "帮我规划雨夜相遇。",
      "可以从旧站台的一封错投来信开始。"
    ]);
    expect(restored.draft.value).toBe("继续这一段");
    restored.dispose({ clearPersistence: true });
  });

  it("keeps document context stable across persistence reload", () => {
    const storage = createMemoryStorage();
    const persistenceKey = "conversation-document-context-test";
    const controller = useAgentConversation({
      api: () => undefined,
      ...storage.options(persistenceKey)
    });
    controller.messages.value = [
      {
        id: "user-document-context",
        role: "user",
        content: "请基于文档继续。",
        createdAt: "2026-08-17T08:00:00.000Z",
        status: "completed"
      }
    ];
    controller.draft.value = "针对文档提问";
    controller.dispose();

    const restored = useAgentConversation({
      api: () => undefined,
      ...storage.options(persistenceKey)
    });
    expect(restored.draft.value).toBe("针对文档提问");
    expect(
      restored.messages.value.some(
        (message) => message.content === "请基于文档继续。"
      )
    ).toBe(true);
    expect(document.id).toBe("chapter_3");
    restored.dispose({ clearPersistence: true });
  });
});
