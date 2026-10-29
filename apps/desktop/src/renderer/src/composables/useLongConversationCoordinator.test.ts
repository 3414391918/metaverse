import {
  getDefaultLongAgentProfile,
  type CatalogIndexSnapshot,
  type LongBookSummary,
  type LongWorkspaceIndexSnapshot,
  type LongWorkspaceRuntimeContext
} from "@deepwrite/contracts";
import { computed, nextTick, ref, shallowRef } from "vue";
import { describe, expect, it, vi } from "vitest";
import type { AgentConversationController } from "./useAgentConversation";
import {
  useLongConversationCoordinator,
  type LongConversationCoordinatorOptions
} from "./useLongConversationCoordinator";
import type { LongWorkspaceSelection } from "../types/longWorkspace";
import type { ChatMessage } from "../types/conversation";

const BOOK_ID = "long-book-one";
const NOW = "2026-08-14T00:00:00.000Z";

function bookSummary(): LongBookSummary {
  return {
    id: BOOK_ID,
    title: "小说测试书",
    updatedAt: NOW,
    linkedMaterialIdsByKind: {
      character: [],
      gimmick: [],
      plot: [],
      draft: [],
      other: []
    },
    linkedSkillIdsByKind: {
      general: [],
      plot: [],
      style: [],
      other: []
    },
    navigation: {
      schemaVersion: 1,
      bookId: BOOK_ID,
      updatedAt: NOW,
      counts: {
        worldbuildingCategories: 0,
        characters: 0,
        volumes: 0,
        arcs: 0,
        chapterCards: 0,
        storyEvents: 0,
        storyPlots: 0,
        foreshadowingThreads: 0,
        committedChapters: 0
      },
      worldbuilding: [],
      characterTypes: [],
      characters: [],
      volumes: [],
      arcs: [],
      chapterCards: [],
      committedThroughChapterId: null
    }
  } as unknown as LongBookSummary;
}

function selection(key = "plot-design:book-line"): LongWorkspaceSelection {
  return {
    key,
    root: "plot_design",
    title: "全书故事线",
    breadcrumbs: ["小说测试书", "剧情设计"],
    files: [],
    preferredRole: "body"
  };
}

function runtimeContext(summary: LongBookSummary): LongWorkspaceRuntimeContext {
  return {
    bookId: summary.id,
    title: summary.title,
    activeRoot: "plot_design",
    activeAgentId: "long",
    navigation: summary.navigation
  };
}

function controllerFixture() {
  const sessionId = ref("session-one");
  const draft = ref("继续设计剧情");
  const isBusy = ref(false);
  const messages = ref<ChatMessage[]>([
    {
      id: "user-long-history",
      role: "user",
      content: "小说历史问题",
      createdAt: "2026-08-25T08:00:00.000Z",
      status: "completed"
    }
  ]);
  const conversationError = ref<string | null>(null);
  const selectedModelId = ref("model-one");
  const thinkingLevel = ref<"off" | "low" | "medium" | "high">("medium");
  const webSearchEnabled = ref(false);
  const temperature = ref(0.7);
  const approvalMode = ref<"request-approval" | "auto-approve">(
    "request-approval"
  );
  const newConversation = vi.fn(() => {
    sessionId.value = "session-new";
    draft.value = "";
  });
  const selectConversation = vi.fn((nextSessionId: string) => {
    if (isBusy.value) return false;
    sessionId.value = nextSessionId;
    return true;
  });
  const selectModel = vi.fn((modelId: string) => {
    selectedModelId.value = modelId;
  });
  const selectThinkingLevel = vi.fn(
    (level: "off" | "low" | "medium" | "high") => {
      thinkingLevel.value = level;
    }
  );
  const selectWebSearchEnabled = vi.fn((enabled: boolean) => {
    webSearchEnabled.value = enabled;
  });
  const selectTemperature = vi.fn((value: number) => {
    temperature.value = value;
  });
  const selectApprovalMode = vi.fn(
    (mode: "request-approval" | "auto-approve") => {
      approvalMode.value = mode;
    }
  );
  const controller = {
    sessionId,
    draft,
    messages,
    isBusy,
    conversationError,
    selectedModelId,
    thinkingLevel,
    webSearchEnabled,
    temperature,
    approvalMode,
    newConversation,
    selectConversation,
    selectModel,
    selectThinkingLevel,
    selectWebSearchEnabled,
    selectTemperature,
    selectApprovalMode
  } as unknown as AgentConversationController;
  return {
    controller,
    draft,
    isBusy,
    newConversation,
    messages,
    selectApprovalMode,
    selectConversation,
    selectModel,
    selectTemperature,
    selectThinkingLevel,
    selectWebSearchEnabled,
    selectedModelId,
    sessionId,
    conversationError
  };
}

function createHarness() {
  const summary = shallowRef<LongBookSummary | null>(bookSummary());
  const activeSelection = shallowRef<LongWorkspaceSelection | null>(
    selection()
  );
  const profile = shallowRef(getDefaultLongAgentProfile("long"));
  const context = shallowRef<LongWorkspaceRuntimeContext | null>(
    runtimeContext(summary.value!)
  );
  const conversation = controllerFixture();
  const sendPreflightPending = ref(false);
  const notifications = {
    info: vi.fn(),
    warning: vi.fn(),
    error: vi.fn()
  };
  const showConversation = vi.fn();
  const synchronizeSessionModelSelection = vi.fn();
  const synchronizeRunPreferences = vi.fn();
  const updatePermissionMode = vi.fn();
  const indexSnapshot = shallowRef<CatalogIndexSnapshot | null>(null);
  const workspaceIndex = shallowRef({
    plot: { foreshadowing: [] }
  } as unknown as LongWorkspaceIndexSnapshot);
  const options: LongConversationCoordinatorOptions = {
    state: {
      activeBookId: ref(BOOK_ID),
      activeBookSummary: summary,
      workspaceIndex,
      selection: activeSelection,
      fileContext: shallowRef(null),
      activeRoot: computed(
        () => activeSelection.value?.root ?? "worldbuilding"
      ),
      activeAgentProfile: profile,
      activeRuntimeContext: context,
      sendPreflightPending,
      agentLoadError: ref(null)
    },
    runtime: {
      conversationKey: vi.fn((bookId, root, chapterCardId) =>
        [bookId, root, chapterCardId ?? "none"].join(":")
      ),
      conversationForKey: vi.fn(() => conversation.controller),
      synchronizeSessionModelSelection,
      synchronizeRunPreferences
    },
    workspace: {
      ensureAgentSettingsLoaded: vi.fn(async () => true),
      saveActiveEditorChanges: vi.fn(async () => true),
      refreshActiveWorkspace: vi.fn(async () => true),
      captureForeshadowingFocus: vi.fn(() => ({
        threadId: null,
        beatId: null
      })),
      api: vi.fn(() => undefined)
    },
    catalog: {
      indexSnapshot,
      documentsForProfile: vi.fn(() => []),
      ensureDocumentsLoaded: vi.fn(async () => true),
      hydratedSnapshot: vi.fn(() => null),
      buildAttachments: vi.fn(() => ({
        bookId: BOOK_ID,
        attachedSkills: [],
        attachedMaterials: [],
        diagnostics: [],
        omittedAttachments: [],
        complete: true
      })),
      filterReadableAttachments: vi.fn(() => ({
        attachedSkills: [],
        attachedMaterials: []
      }))
    },
    settings: {
      permissionMode: vi.fn(() => "request-approval" as const),
      updatePermissionMode
    },
    showConversation,
    notifications
  };
  const coordinator = useLongConversationCoordinator(options);
  return {
    activeSelection,
    conversation,
    coordinator,
    indexSnapshot,
    notifications,
    options,
    profile,
    showConversation,
    summary,
    synchronizeRunPreferences,
    updatePermissionMode
  };
}

describe("useLongConversationCoordinator", () => {
  it("builds UI references from bound libraries without touching catalog hydration", () => {
    const test = createHarness();
    test.summary.value = {
      ...test.summary.value!,
      linkedResourceStageScopes: {
        materials: { "material-library": ["draft"] },
        skills: { "skill-library": ["draft"] }
      },
      linkedMaterialIdsByKind: {
        ...test.summary.value!.linkedMaterialIdsByKind,
        character: ["material-library"]
      },
      linkedSkillIdsByKind: {
        ...test.summary.value!.linkedSkillIdsByKind,
        plot: ["skill-library"]
      }
    };
    test.indexSnapshot.value = {
      skills: [
        {
          id: "skill-library",
          title: "剧情方法",
          skillKind: "plot",
          entries: [
            {
              id: "skill-entry",
              title: "冲突升级",
              body: "",
              contentBytes: 18
            }
          ]
        }
      ],
      materials: [
        {
          id: "material-library",
          title: "人物素材",
          entries: [
            {
              id: "material-entry",
              title: "主角档案",
              stageId: "character",
              body: "",
              contentBytes: 24
            }
          ]
        }
      ]
    } as unknown as CatalogIndexSnapshot;

    expect(test.coordinator.availableSkillReferences.value).toEqual([
      {
        id: "skill:skill-library:skill-entry",
        label: "剧情方法 · 冲突升级",
        detail: "剧情设计技能库 · 当前小说已绑定"
      }
    ]);
    expect(test.coordinator.availableMaterialReferences.value).toEqual([
      {
        id: "material:material-library:material-entry",
        label: "人物素材 · 主角档案",
        detail: "人设素材库 · 当前小说已绑定"
      }
    ]);
    test.coordinator.dispose();
  });

  it("exposes only history navigation: no send, stop, or rewrite ports", () => {
    const test = createHarness();
    const coordinator = test.coordinator as unknown as Record<string, unknown>;
    expect(coordinator.sendLongMessage).toBeUndefined();
    expect(coordinator.resendLongMessage).toBeUndefined();
    expect(coordinator.stopGeneration).toBeUndefined();
    expect(coordinator.sendMessage).toBeUndefined();
    expect(coordinator.canRewriteHistory).toBeUndefined();
    expect(typeof coordinator.selectConversation).toBe("function");
    expect(typeof coordinator.newConversation).toBe("function");
    test.coordinator.dispose();
  });

  it("selects stored history and keeps the current draft untouched", () => {
    const test = createHarness();
    test.coordinator.selectConversation("session-two");

    expect(test.conversation.selectConversation).toHaveBeenCalledWith(
      "session-two"
    );
    expect(test.conversation.sessionId.value).toBe("session-two");
    expect(test.conversation.draft.value).toBe("继续设计剧情");
    test.coordinator.dispose();
  });

  it("warns when switching history while the conversation is busy", () => {
    const test = createHarness();
    test.conversation.isBusy.value = true;
    test.coordinator.selectConversation("session-two");

    expect(test.conversation.selectConversation).toHaveBeenCalledWith(
      "session-two"
    );
    expect(test.notifications.warning).toHaveBeenCalledWith(
      "请等待历史保存完成后再切换对话。"
    );
    test.coordinator.dispose();
  });

  it("starts a new conversation through the active controller", () => {
    const test = createHarness();
    test.coordinator.newConversation();

    expect(test.conversation.newConversation).toHaveBeenCalledOnce();
    expect(test.showConversation).toHaveBeenCalledOnce();
    test.coordinator.dispose();
  });

  it("silently blocks a new conversation while the controller is busy", () => {
    const test = createHarness();
    test.conversation.isBusy.value = true;

    test.coordinator.newConversation();

    expect(test.conversation.newConversation).not.toHaveBeenCalled();
    expect(test.showConversation).not.toHaveBeenCalled();
    test.coordinator.dispose();
  });

  it("delegates model and run preferences to the active conversation", () => {
    const test = createHarness();
    test.coordinator.selectModel("model-two");
    test.coordinator.selectThinking("high");
    test.coordinator.selectWebSearch(true);
    test.coordinator.selectTemperature(0.2);
    test.coordinator.selectApprovalMode("auto-approve");

    expect(test.conversation.selectedModelId.value).toBe("model-two");
    expect(test.conversation.controller.thinkingLevel.value).toBe("high");
    expect(test.conversation.controller.webSearchEnabled.value).toBe(true);
    expect(test.conversation.controller.temperature.value).toBe(0.2);
    expect(test.conversation.controller.approvalMode.value).toBe(
      "auto-approve"
    );
    expect(test.updatePermissionMode).toHaveBeenCalledWith("auto-approve");
    expect(test.synchronizeRunPreferences).toHaveBeenCalled();
    test.coordinator.dispose();
  });

  it("keeps draft edits and suggestions inside the active conversation", () => {
    const test = createHarness();
    test.coordinator.updateDraft("新的小说草稿");
    expect(test.conversation.draft.value).toBe("新的小说草稿");

    test.coordinator.useSuggestion("使用这条建议");
    expect(test.conversation.draft.value).toBe("使用这条建议");
    test.coordinator.dispose();
  });

  it("surfaces conversation errors through notifications until disposal", async () => {
    const test = createHarness();
    test.conversation.conversationError.value = "历史加载失败";
    await nextTick();
    expect(test.notifications.error).toHaveBeenCalledWith("历史加载失败");

    test.notifications.error.mockClear();
    await test.coordinator.dispose();
    test.conversation.conversationError.value = "关闭后的错误";
    await nextTick();
    expect(test.notifications.error).not.toHaveBeenCalled();
  });
});
