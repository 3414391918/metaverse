import { useLibraryConversationSend } from "./useLibraryConversationSend";
import { createConversationHistorySelection } from "./conversationHistorySelection";
import {
  ATTACHED_CONTEXT_MAX_ITEMS,
  type AgentTeamRunMode,
  type LibraryAgentDomain,
  type ThinkingLevel
} from "@deepwrite/contracts";
import { computed, watch } from "vue";
import type { AgentRunSettings } from "./useAgentConversation";
import type { ComposerReferenceOption } from "../types/conversation";
import {
  agentConversationKeyForDocument,
  agentRunScopeForDocument
} from "../utils/agentRunPreferences";
import { createConversationHistoryRewriteDispatcher } from "./agent-conversation/history-rewrite-dispatcher";
import {
  composerStageLabel,
  stableDocumentDescriptor,
  libraryEntryReferences,
  type LibraryConversationCoordinatorOptions
} from "./libraryConversationContext";

/** Owns library management conversations and send preflight. */
export function useLibraryConversationCoordinator(
  options: LibraryConversationCoordinatorOptions
) {
  const activeDescriptor = stableDocumentDescriptor(
    options.resource.activeAgentDocument
  );
  const activeConversationKey = computed(() =>
    agentConversationKeyForDocument(options.resource.activeAgentDocument.value)
  );
  const activeConversationScope = computed(() =>
    agentRunScopeForDocument(options.resource.activeAgentDocument.value)
  );
  const activeConversation = computed(() =>
    options.runtime.conversationForKey(
      activeConversationKey.value,
      activeConversationScope.value
    )
  );
  const resendMessage = createConversationHistoryRewriteDispatcher({
    conversation: () => activeConversation.value,
    dispatch: (request) => sendMessage([], request)
  });
  const activeLibraryDomain = computed<LibraryAgentDomain | undefined>(() => {
    const domain = activeDescriptor.value.domain;
    return domain === "material" || domain === "skill" ? domain : undefined;
  });
  const activeLibraryAgentProfile = computed(() => {
    const domain = activeLibraryDomain.value;
    return domain
      ? options.profiles.libraryAgents.value.agents.find(
          (agent) => agent.domain === domain
        )
      : undefined;
  });
  const {
    sendMessage,
    sendPreflightPending,
    invalidateSendTarget,
    dispose: disposeSend,
    drain,
    disposed: isDisposed
  } = useLibraryConversationSend(
    options,
    activeConversation,
    activeConversationKey,
    activeLibraryAgentProfile
  );
  const availableSkillReferences = computed<ComposerReferenceOption[]>(() => {
    if (activeLibraryDomain.value) {
      return (activeLibraryAgentProfile.value?.readAccess.skills ?? [])
        .slice(0, ATTACHED_CONTEXT_MAX_ITEMS)
        .map((skill) => ({
          id: `library-agent-skill:${skill.id}`,
          label: skill.name,
          detail: "按需加载的方法"
        }));
    }
    return [];
  });
  const availableMaterialReferences = computed<ComposerReferenceOption[]>(() =>
    libraryEntryReferences(
      options.catalog.snapshot.value,
      activeDescriptor.value,
      activeLibraryDomain.value
    )
  );
  const conversationContext = computed(() => {
    const descriptor = activeDescriptor.value;
    return {
      runtimeAvailable: options.runtimeAvailable(),
      allowLiveEditReview: true,
      contextTitle: descriptor.title,
      bookTitle:
        descriptor.workspaceTitle || descriptor.pathRoot || "未选择资源",
      stageLabel: composerStageLabel(descriptor),
      agentLabel: activeLibraryAgentProfile.value?.label ?? "智能体对话",
      agentId: undefined,
      welcomeShortcuts: undefined,
      libraryDomain: activeLibraryDomain.value,
      librarySkills: activeLibraryAgentProfile.value?.readAccess.skills.map(
        (skill) => ({
          name: skill.name
        })
      ),
      availableSkills: availableSkillReferences.value,
      availableMaterials: availableMaterialReferences.value,
      editorReferences: options.resource.pendingEditorReferences.value,
      leftCollapsed: options.resource.leftCollapsed.value,
      rightCollapsed: options.resource.rightCollapsed.value,
      canRewriteHistory:
        activeConversation.value.canRewriteHistory.value &&
        !sendPreflightPending.value &&
        options.edits.acceptingDocumentIds.value.size === 0 &&
        options.edits.acceptingWorkspaceIds.value.size === 0 &&
        !options.edits.hasQueued(),
      submitEditedMessage: resendMessage
    };
  });

  const stopWebSearchSync = watch(
    () => activeConversation.value.webSearchEnabled.value,
    () => {
      if (isDisposed()) return;
      const conversation = activeConversation.value;
      options.runtime.synchronizeSessionModelSelection(conversation);
      synchronizeActiveRunPreferences(conversation);
    },
    { flush: "sync" }
  );

  function updateDraft(value: string): void {
    activeConversation.value.draft.value = value;
  }

  function newConversation(): void {
    invalidateSendTarget();
    const conversation = activeConversation.value;
    if (conversation.isBusy.value) {
      options.notifications.warning("请先停止当前回复，再新建对话。");
      return;
    }
    if (
      options.edits.acceptingDocumentIds.value.size > 0 ||
      options.edits.acceptingWorkspaceIds.value.size > 0 ||
      options.edits.hasQueued()
    ) {
      options.notifications.info("请等待智能体修改保存完成后再新建对话");
      return;
    }
    options.showConversation();
    conversation.newConversation();
    options.resource.clearEditorSelectionReferences();
  }

  const selectConversation = createConversationHistorySelection({
    prepare() {
      invalidateSendTarget();
      if (
        options.edits.acceptingDocumentIds.value.size > 0 ||
        options.edits.acceptingWorkspaceIds.value.size > 0 ||
        options.edits.hasQueued()
      ) {
        options.notifications.info("请等待智能体修改保存完成后再切换对话");
        return false;
      }
      return !isDisposed();
    },
    current: () => activeConversation.value,
    warning: (message) => options.notifications.warning(message),
    busyMessage: "请先停止当前回复，再切换历史对话",
    unavailableMessage: "这条历史对话已不可用，请重新打开历史列表",
    selected(conversation) {
      options.resource.clearEditorSelectionReferences();
      queueMicrotask(() => {
        if (!isDisposed()) options.edits.resumeRecovered([conversation]);
      });
    }
  });

  function useSuggestion(value: string): void {
    activeConversation.value.useSuggestion(value);
  }

  async function stopGeneration(): Promise<void> {
    const conversation = activeConversation.value;
    try {
      if (await conversation.stopGeneration()) {
        options.notifications.info("已停止生成");
      }
    } catch (error: unknown) {
      if (!isDisposed()) {
        options.notifications.error(
          error instanceof Error ? error.message : "停止生成失败，请稍后重试。"
        );
      }
    }
  }

  function synchronizeActiveRunPreferences(
    conversation = activeConversation.value
  ): void {
    options.runtime.synchronizeRunPreferences(
      activeConversationScope.value,
      conversation
    );
  }

  function selectModel(modelId: string): void {
    const conversation = activeConversation.value;
    conversation.selectModel(modelId);
    options.runtime.synchronizeSessionModelSelection(conversation);
    synchronizeActiveRunPreferences(conversation);
  }

  function selectThinking(level: ThinkingLevel): void {
    const conversation = activeConversation.value;
    conversation.selectThinkingLevel(level);
    options.runtime.synchronizeSessionModelSelection(conversation);
    synchronizeActiveRunPreferences(conversation);
  }

  function selectWebSearch(enabled: boolean): void {
    const conversation = activeConversation.value;
    conversation.selectWebSearchEnabled(enabled);
    options.runtime.synchronizeSessionModelSelection(conversation);
    synchronizeActiveRunPreferences(conversation);
  }

  function selectTemperature(value: number): void {
    activeConversation.value.selectTemperature(value);
    synchronizeActiveRunPreferences();
  }

  function selectApprovalMode(mode: AgentRunSettings["approvalMode"]): void {
    options.settings.updatePermissionMode(mode);
    activeConversation.value.selectApprovalMode(mode);
    synchronizeActiveRunPreferences();
  }

  function selectAgentTeamMode(mode: AgentTeamRunMode): void {
    const conversation = activeConversation.value;
    conversation.selectAgentTeamMode(mode);
    synchronizeActiveRunPreferences(conversation);
  }

  return {
    activeConversation,
    activeConversationKey,
    conversationContext,
    dispose: async () => {
      stopWebSearchSync();
      await disposeSend();
    },
    drain,
    newConversation,
    selectAgentTeamMode,
    selectApprovalMode,
    selectConversation,
    selectModel,
    selectTemperature,
    selectThinking,
    selectWebSearch,
    resendMessage,
    sendMessage,
    sendPreflightPending,
    stopGeneration,
    updateDraft,
    useSuggestion
  };
}

export type LibraryConversationCoordinator = ReturnType<
  typeof useLibraryConversationCoordinator
>;
