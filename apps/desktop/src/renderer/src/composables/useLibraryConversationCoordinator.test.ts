import { CatalogSnapshotSchema } from "@deepwrite/contracts";
import type {
  CatalogIndexSnapshot,
  LibraryAgentSettings
} from "@deepwrite/contracts";
import { computed, nextTick, ref, shallowRef } from "vue";
import { describe, expect, it, vi } from "vitest";
import type { AgentConversationController } from "./useAgentConversation";
import { useLibraryConversationCoordinator } from "./useLibraryConversationCoordinator";
import type { LibraryConversationCoordinatorOptions } from "./libraryConversationContext";
import type { ChatMessage } from "../types/conversation";
import type { WorkspaceDocument } from "../types/workspace";

function workspaceDocument(
  patch: Partial<WorkspaceDocument> = {}
): WorkspaceDocument {
  return {
    id: "document-one",
    domain: "material",
    title: "正文",
    eyebrow: "素材库",
    path: ["作品", "正文"],
    content: "正文内容",
    libraryId: "library-one",
    catalogEntryId: "entry-one",
    workspaceTitle: "作品",
    ...patch
  };
}

function controllerFixture() {
  const sessionId = ref("session-one");
  const draft = ref("请继续写");
  const isBusy = ref(false);
  const messages = ref<ChatMessage[]>([
    {
      id: "user-history-one",
      role: "user",
      content: "历史问题",
      createdAt: "2026-08-25T08:00:00.000Z",
      status: "completed"
    }
  ]);
  const conversationError = ref<string | null>(null);
  const webSearchEnabled = ref(false);
  const newConversation = vi.fn(() => {
    sessionId.value = "session-new";
    draft.value = "";
  });
  const selectConversation = vi.fn((nextSessionId: string) => {
    if (isBusy.value) return false;
    sessionId.value = nextSessionId;
    return true;
  });
  const controller = {
    sessionId,
    draft,
    messages,
    isBusy,
    conversationError,
    webSearchEnabled,
    newConversation,
    selectConversation,
    useSuggestion: vi.fn((value: string) => {
      draft.value = value;
    }),
    selectModel: vi.fn(),
    selectThinkingLevel: vi.fn(),
    selectWebSearchEnabled: vi.fn((enabled: boolean) => {
      webSearchEnabled.value = enabled;
    }),
    selectTemperature: vi.fn(),
    selectApprovalMode: vi.fn(),
    selectAgentTeamMode: vi.fn()
  } as unknown as AgentConversationController;
  return {
    controller,
    conversationError,
    draft,
    isBusy,
    newConversation,
    messages,
    selectConversation,
    sessionId,
    webSearchEnabled
  };
}

function createHarness(
  overrides: Partial<LibraryConversationCoordinatorOptions> = {}
) {
  const conversation = controllerFixture();
  const selectedResourceId = ref("document-one");
  const activeDocument = shallowRef(workspaceDocument());
  const activeAgentDocument = computed(() => activeDocument.value);
  const activePromptDocument = computed(() => activeDocument.value);
  const liveWorkspaceDocuments = computed(() => [activeDocument.value]);
  const catalogDocuments = shallowRef([workspaceDocument()]);
  const ensureDocumentsLoaded = vi.fn(async () => true);
  const snapshot = CatalogSnapshotSchema.parse({
    schemaVersion: 1,
    revision: 1,
    updatedAt: "2026-10-03T00:00:00.000Z",
    books: [],
    skills: [],
    materialGroups: [],
    skillGroups: [],
    materials: [
      {
        id: "library-one",
        title: "作品",
        materialType: "long",
        materialKind: "other",
        parentGenre: "",
        subGenre: "",
        overview: "说明",
        entries: [
          {
            id: "entry-one",
            title: "正文",
            stageId: "other",
            body: "正文内容",
            createdAt: "2026-10-03T00:00:00.000Z",
            updatedAt: "2026-10-03T00:00:00.000Z"
          }
        ],
        createdAt: "2026-10-03T00:00:00.000Z",
        updatedAt: "2026-10-03T00:00:00.000Z"
      }
    ]
  });
  const notifications = {
    info: vi.fn(),
    warning: vi.fn(),
    error: vi.fn()
  };
  const showConversation = vi.fn();
  const clearEditorSelectionReferences = vi.fn();
  const options: LibraryConversationCoordinatorOptions = {
    runtime: {
      conversationForKey: vi.fn(() => conversation.controller),
      synchronizeSessionModelSelection: vi.fn(),
      synchronizeRunPreferences: vi.fn()
    },
    resource: {
      selectedResourceId,
      activeAgentDocument,
      activePromptDocument,
      liveWorkspaceDocuments,
      pendingEditorReferences: ref([]),
      leftCollapsed: ref(false),
      rightCollapsed: ref(false),
      clearEditorSelectionReferences,
      contextDocuments: vi.fn(() => catalogDocuments.value),
      ensureDocumentsLoaded,
      hydratedCatalogSnapshot: vi.fn(() => snapshot)
    },
    catalog: {
      snapshot: shallowRef<CatalogIndexSnapshot | null>(null)
    },
    profiles: {
      libraryAgents: shallowRef({
        agents: []
      } as unknown as LibraryAgentSettings)
    },
    edits: {
      acceptingDocumentIds: ref(new Set<string>()),
      acceptingWorkspaceIds: ref(new Set<string>()),
      hasQueued: vi.fn(() => false),
      schedule: vi.fn(),
      resumeRecovered: vi.fn()
    },
    settings: {
      permissionMode: () => "request-approval",
      updatePermissionMode: vi.fn()
    },
    runtimeAvailable: () => true,
    showConversation,
    notifications,
    ...overrides
  };
  const coordinator = useLibraryConversationCoordinator(options);
  return {
    activeDocument,
    clearEditorSelectionReferences,
    conversation,
    coordinator,
    ensureDocumentsLoaded,
    notifications,
    options,
    selectedResourceId,
    showConversation
  };
}

describe("useLibraryConversationCoordinator", () => {
  it("renders the conversation context from the active document without hydrating the catalog", () => {
    const test = createHarness();
    const context = test.coordinator.conversationContext.value;
    expect(context.contextTitle).toBe("正文");
    expect(context.bookTitle).toBe("作品");
    expect(context.runtimeAvailable).toBe(false);
    expect(context.agentLabel).toBe("历史对话");
    expect(test.ensureDocumentsLoaded).not.toHaveBeenCalled();
    test.coordinator.dispose();
  });

  it("exposes only history navigation: no send, stop, or rewrite ports", () => {
    const test = createHarness();
    const coordinator = test.coordinator as unknown as Record<string, unknown>;
    expect(coordinator.sendMessage).toBeUndefined();
    expect(coordinator.resendMessage).toBeUndefined();
    expect(coordinator.stopGeneration).toBeUndefined();
    expect(coordinator.canRewriteHistory).toBeUndefined();
    expect(coordinator.sendPreflightPending).toBeUndefined();
    expect(typeof coordinator.selectConversation).toBe("function");
    expect(typeof coordinator.newConversation).toBe("function");
    test.coordinator.dispose();
  });

  it("selects stored history, keeps the draft, and clears editor references", () => {
    const test = createHarness();
    test.coordinator.selectConversation("session-two");

    expect(test.conversation.selectConversation).toHaveBeenCalledWith(
      "session-two"
    );
    expect(test.conversation.sessionId.value).toBe("session-two");
    expect(test.conversation.draft.value).toBe("请继续写");
    expect(test.clearEditorSelectionReferences).toHaveBeenCalledOnce();
    test.coordinator.dispose();
  });

  it("warns when switching history while the conversation is busy", () => {
    const test = createHarness();
    test.conversation.isBusy.value = true;
    test.coordinator.selectConversation("session-two");

    expect(test.conversation.sessionId.value).toBe("session-one");
    expect(test.notifications.warning).toHaveBeenCalledWith(
      "请等待历史保存完成后再切换对话"
    );
    test.coordinator.dispose();
  });

  it("starts a new conversation through the active controller", () => {
    const test = createHarness();
    test.coordinator.newConversation();

    expect(test.conversation.newConversation).toHaveBeenCalledOnce();
    expect(test.clearEditorSelectionReferences).toHaveBeenCalledOnce();
    expect(test.showConversation).toHaveBeenCalledOnce();
    test.coordinator.dispose();
  });

  it("blocks a new library conversation while the controller is busy", () => {
    const test = createHarness();
    test.conversation.isBusy.value = true;

    test.coordinator.newConversation();

    expect(test.conversation.newConversation).not.toHaveBeenCalled();
    expect(test.showConversation).not.toHaveBeenCalled();
    test.coordinator.dispose();
  });

  it("delegates preference selection to the active conversation", () => {
    const test = createHarness();
    test.coordinator.selectModel("model-two");
    test.coordinator.selectThinking("high");
    test.coordinator.selectWebSearch(true);
    test.coordinator.selectTemperature(0.2);
    test.coordinator.selectApprovalMode("auto-approve");

    expect(test.conversation.controller.selectModel).toHaveBeenCalledWith(
      "model-two"
    );
    expect(
      test.conversation.controller.selectThinkingLevel
    ).toHaveBeenCalledWith("high");
    expect(test.conversation.webSearchEnabled.value).toBe(true);
    expect(test.conversation.controller.selectTemperature).toHaveBeenCalledWith(
      0.2
    );
    expect(
      test.conversation.controller.selectApprovalMode
    ).toHaveBeenCalledWith("auto-approve");
    expect(test.options.runtime.synchronizeRunPreferences).toHaveBeenCalled();
    test.coordinator.dispose();
  });

  it("keeps draft edits and suggestions inside the active conversation", () => {
    const test = createHarness();
    test.coordinator.updateDraft("新的草稿");
    expect(test.conversation.draft.value).toBe("新的草稿");

    test.coordinator.useSuggestion("使用这条建议");
    expect(test.conversation.draft.value).toBe("使用这条建议");
    test.coordinator.dispose();
  });

  it("persists a composer web-search toggle through the session model selection", async () => {
    const test = createHarness();
    test.conversation.webSearchEnabled.value = true;
    await nextTick();
    const sessionModelSelection = vi.mocked(
      test.options.runtime
        .synchronizeSessionModelSelection as unknown as ReturnType<typeof vi.fn>
    );
    expect(sessionModelSelection).toHaveBeenCalledWith(
      test.conversation.controller
    );
    test.coordinator.dispose();
  });

  it("stops preference synchronization after disposal", async () => {
    const test = createHarness();
    await test.coordinator.dispose();
    const sessionModelSelection = vi.mocked(
      test.options.runtime
        .synchronizeSessionModelSelection as unknown as ReturnType<typeof vi.fn>
    );
    const calls = sessionModelSelection.mock.calls.length;
    test.conversation.webSearchEnabled.value = false;
    await nextTick();
    expect(sessionModelSelection.mock.calls.length).toBe(calls);
  });
});
