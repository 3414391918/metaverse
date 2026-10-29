import {
  longSkillReferences,
  longMaterialReferences
} from "../utils/longLibraryReferences";
import { createConversationHistorySelection } from "./conversationHistorySelection";
import type {
  AgentTeamRunMode,
  CatalogIndexSnapshot,
  CatalogSnapshot,
  LongAgentProfile,
  LongBookSummary,
  LongFileId,
  LongWorkspaceIndexSnapshot,
  LongWorkspaceRuntimeContext,
  ThinkingLevel
} from "@deepwrite/contracts";
import { computed, watch, type Ref } from "vue";
import type {
  AgentConversationController,
  AgentRunSettings
} from "./useAgentConversation";
import type {
  LongForeshadowingFocus,
  LongWorkspaceRendererApi,
  LongWorkspaceSelection
} from "../types/longWorkspace";
import type { WorkspaceDocument } from "../types/workspace";
import type { LibraryAttachmentBuildResult } from "../utils/libraryAttachments";

export interface LongConversationFileContext {
  readonly bookId: string;
  readonly fileId: LongFileId;
}
export interface LongConversationCoordinatorOptions {
  state: {
    activeBookId: Readonly<Ref<string | null>>;
    activeBookSummary: Readonly<Ref<LongBookSummary | null>>;
    workspaceIndex: Readonly<Ref<LongWorkspaceIndexSnapshot | null>>;
    selection: Readonly<Ref<LongWorkspaceSelection | null>>;
    fileContext: Readonly<Ref<LongConversationFileContext | null>>;
    activeRoot: Readonly<Ref<LongWorkspaceRuntimeContext["activeRoot"]>>;
    activeAgentProfile: Readonly<Ref<LongAgentProfile | null>>;
    activeRuntimeContext: Readonly<Ref<LongWorkspaceRuntimeContext | null>>;
    sendPreflightPending: Ref<boolean>;
    agentLoadError: Readonly<Ref<string | null>>;
  };
  runtime: {
    conversationKey(
      bookId: string,
      activeRoot: LongWorkspaceRuntimeContext["activeRoot"],
      chapterCardId?: string
    ): string;
    conversationForKey(key: string, scope: string): AgentConversationController;
    synchronizeSessionModelSelection(
      conversation: AgentConversationController
    ): void;
    synchronizeRunPreferences(
      scope: string,
      conversation: AgentConversationController
    ): void;
  };
  workspace: {
    ensureAgentSettingsLoaded(): Promise<boolean>;
    saveActiveEditorChanges(): Promise<boolean>;
    refreshActiveWorkspace(bookId: string): Promise<boolean>;
    captureForeshadowingFocus(): LongForeshadowingFocus;
    api(): LongWorkspaceRendererApi | undefined;
  };
  catalog: {
    indexSnapshot: Readonly<Ref<CatalogIndexSnapshot | null>>;
    documentsForProfile(
      summary: LongBookSummary,
      profile: LongAgentProfile
    ): readonly WorkspaceDocument[];
    ensureDocumentsLoaded(
      documents: readonly WorkspaceDocument[]
    ): Promise<boolean>;
    hydratedSnapshot(): CatalogSnapshot | null;
    buildAttachments(
      summary: LongBookSummary,
      snapshot: CatalogSnapshot,
      profile: LongAgentProfile
    ): LibraryAttachmentBuildResult;
    filterReadableAttachments(
      attachments: LibraryAttachmentBuildResult,
      profile: LongAgentProfile
    ): Pick<
      LibraryAttachmentBuildResult,
      "attachedSkills" | "attachedMaterials"
    >;
  };
  settings: {
    permissionMode(): AgentRunSettings["approvalMode"];
    updatePermissionMode(mode: AgentRunSettings["approvalMode"]): void;
  };
  showConversation(): void;
  notifications: {
    info(message: string): void;
    warning(message: string): void;
    error(message: string): void;
  };
}

/** Long-form history navigation. There is no local model execution or send preflight. */
export function useLongConversationCoordinator(
  options: LongConversationCoordinatorOptions
) {
  let disposed = false;
  const activeConversationKey = computed<string | null>(() => {
    const summary = options.state.activeBookSummary.value;
    if (!summary || !options.state.activeAgentProfile.value) return null;
    return options.runtime.conversationKey(
      summary.id,
      options.state.activeRoot.value,
      options.state.selection.value?.chapterCardId
    );
  });
  const activeConversationScope = computed(() => {
    const bookId = options.state.activeBookSummary.value?.id;
    return bookId ? `long:${bookId}` : null;
  });
  const activeConversation = computed<AgentConversationController | null>(
    () => {
      const key = activeConversationKey.value;
      const scope = activeConversationScope.value;
      return key && scope
        ? options.runtime.conversationForKey(key, scope)
        : null;
    }
  );
  const availableSkillReferences = computed(() =>
    longSkillReferences(
      options.catalog.indexSnapshot.value,
      options.state.activeBookSummary.value,
      options.state.activeAgentProfile.value
    )
  );
  const availableMaterialReferences = computed(() =>
    longMaterialReferences(
      options.catalog.indexSnapshot.value,
      options.state.activeBookSummary.value,
      options.state.activeAgentProfile.value
    )
  );
  const stopErrorWatch = watch(
    () => activeConversation.value?.conversationError.value ?? null,
    (message) => {
      if (!disposed && message) options.notifications.error(message);
    }
  );
  function updatePreference(
    update: (conversation: AgentConversationController) => void
  ): void {
    const conversation = activeConversation.value;
    if (disposed || !conversation) return;
    update(conversation);
    const scope = activeConversationScope.value;
    if (scope) options.runtime.synchronizeRunPreferences(scope, conversation);
  }
  const selectConversation = createConversationHistorySelection({
    prepare: () => !disposed,
    current: () => activeConversation.value,
    warning: (message) => options.notifications.warning(message),
    busyMessage: "请等待历史保存完成后再切换对话。",
    unavailableMessage: "这条小说历史对话已不可用。"
  });
  return {
    activeConversation,
    activeConversationKey,
    availableMaterialReferences,
    availableSkillReferences,
    async dispose() {
      disposed = true;
      stopErrorWatch();
    },
    newConversation() {
      const conversation = activeConversation.value;
      if (disposed || !conversation || conversation.isBusy.value) return;
      conversation.newConversation();
      options.showConversation();
    },
    selectConversation,
    selectModel(modelId: string) {
      updatePreference((conversation) => conversation.selectModel(modelId));
    },
    selectThinking(level: ThinkingLevel) {
      updatePreference((conversation) =>
        conversation.selectThinkingLevel(level)
      );
    },
    selectWebSearch(enabled: boolean) {
      updatePreference((conversation) =>
        conversation.selectWebSearchEnabled(enabled)
      );
    },
    selectTemperature(value: number) {
      updatePreference((conversation) => conversation.selectTemperature(value));
    },
    selectApprovalMode(mode: AgentRunSettings["approvalMode"]) {
      updatePreference((conversation) => {
        options.settings.updatePermissionMode(mode);
        conversation.selectApprovalMode(mode);
      });
    },
    selectAgentTeamMode(mode: AgentTeamRunMode) {
      updatePreference((conversation) =>
        conversation.selectAgentTeamMode(mode)
      );
    },
    updateDraft(value: string) {
      if (!disposed && activeConversation.value)
        activeConversation.value.draft.value = value;
    },
    useSuggestion(value: string) {
      if (!disposed && activeConversation.value)
        activeConversation.value.draft.value = value;
    }
  };
}
export type LongConversationCoordinator = ReturnType<
  typeof useLongConversationCoordinator
>;
