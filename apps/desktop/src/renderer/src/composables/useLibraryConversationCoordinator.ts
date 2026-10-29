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
import {
  composerStageLabel,
  stableDocumentDescriptor,
  libraryEntryReferences,
  type LibraryConversationCoordinatorOptions
} from "./libraryConversationContext";

/** Library history navigation and persisted preferences. Execution belongs to Harness. */
export function useLibraryConversationCoordinator(
  options: LibraryConversationCoordinatorOptions
) {
  let disposed = false;
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
  const availableSkillReferences = computed<ComposerReferenceOption[]>(() =>
    (activeLibraryAgentProfile.value?.readAccess.skills ?? [])
      .slice(0, ATTACHED_CONTEXT_MAX_ITEMS)
      .map((skill) => ({
        id: `library-agent-skill:${skill.id}`,
        label: skill.name,
        detail: "按需加载的方法"
      }))
  );
  const availableMaterialReferences = computed(() =>
    libraryEntryReferences(
      options.catalog.snapshot.value,
      activeDescriptor.value,
      activeLibraryDomain.value
    )
  );
  const conversationContext = computed(() => {
    const descriptor = activeDescriptor.value;
    return {
      runtimeAvailable: false,
      allowLiveEditReview: false,
      contextTitle: descriptor.title,
      bookTitle:
        descriptor.workspaceTitle || descriptor.pathRoot || "未选择资源",
      stageLabel: composerStageLabel(descriptor),
      agentLabel: activeLibraryAgentProfile.value?.label ?? "历史对话",
      agentId: undefined,
      welcomeShortcuts: undefined,
      libraryDomain: activeLibraryDomain.value,
      librarySkills: activeLibraryAgentProfile.value?.readAccess.skills.map(
        (skill) => ({ name: skill.name })
      ),
      availableSkills: availableSkillReferences.value,
      availableMaterials: availableMaterialReferences.value,
      editorReferences: options.resource.pendingEditorReferences.value,
      leftCollapsed: options.resource.leftCollapsed.value,
      rightCollapsed: options.resource.rightCollapsed.value
    };
  });
  function synchronizeActiveRunPreferences() {
    options.runtime.synchronizeRunPreferences(
      activeConversationScope.value,
      activeConversation.value
    );
  }
  const stopPreferenceSync = watch(
    () => activeConversation.value.webSearchEnabled.value,
    () => {
      if (disposed) return;
      options.runtime.synchronizeSessionModelSelection(
        activeConversation.value
      );
      synchronizeActiveRunPreferences();
    },
    { flush: "sync" }
  );
  const selectConversation = createConversationHistorySelection({
    prepare: () => !disposed,
    current: () => activeConversation.value,
    warning: (message) => options.notifications.warning(message),
    busyMessage: "请等待历史保存完成后再切换对话",
    unavailableMessage: "这条历史对话已不可用，请重新打开历史列表",
    selected() {
      options.resource.clearEditorSelectionReferences();
    }
  });
  return {
    activeConversation,
    activeConversationKey,
    conversationContext,
    async dispose() {
      disposed = true;
      stopPreferenceSync();
    },
    newConversation() {
      if (disposed || activeConversation.value.isBusy.value) return;
      activeConversation.value.newConversation();
      options.resource.clearEditorSelectionReferences();
      options.showConversation();
    },
    selectConversation,
    selectModel(modelId: string) {
      activeConversation.value.selectModel(modelId);
      synchronizeActiveRunPreferences();
    },
    selectThinking(level: ThinkingLevel) {
      activeConversation.value.selectThinkingLevel(level);
      synchronizeActiveRunPreferences();
    },
    selectWebSearch(enabled: boolean) {
      activeConversation.value.selectWebSearchEnabled(enabled);
      synchronizeActiveRunPreferences();
    },
    selectTemperature(value: number) {
      activeConversation.value.selectTemperature(value);
      synchronizeActiveRunPreferences();
    },
    selectApprovalMode(mode: AgentRunSettings["approvalMode"]) {
      options.settings.updatePermissionMode(mode);
      activeConversation.value.selectApprovalMode(mode);
      synchronizeActiveRunPreferences();
    },
    selectAgentTeamMode(mode: AgentTeamRunMode) {
      activeConversation.value.selectAgentTeamMode(mode);
      synchronizeActiveRunPreferences();
    },
    updateDraft(value: string) {
      activeConversation.value.draft.value = value;
    },
    useSuggestion(value: string) {
      activeConversation.value.draft.value = value;
    }
  };
}
export type LibraryConversationCoordinator = ReturnType<
  typeof useLibraryConversationCoordinator
>;
