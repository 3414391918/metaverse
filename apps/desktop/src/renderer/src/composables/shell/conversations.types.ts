import type { GeneralPermissionMode } from "@deepwrite/contracts";
import { useLibraryConversationCoordinator } from "../../composables/useLibraryConversationCoordinator";
import { useConversationRuntimeRegistryCoordinator } from "../../composables/useConversationRuntimeRegistryCoordinator";
import { useLongConversationCoordinator } from "../../composables/useLongConversationCoordinator";
export interface ConversationsRuntime {
  allConversations: ReturnType<
    typeof useConversationRuntimeRegistryCoordinator
  >["allConversations"];
  applyModelSettingsToConversations: ReturnType<
    typeof useConversationRuntimeRegistryCoordinator
  >["applyModelSettingsToConversations"];
  disposeConversationRuntimeRegistry: ReturnType<
    typeof useConversationRuntimeRegistryCoordinator
  >["dispose"];
  conversationPersistenceEnabled: ReturnType<
    typeof useConversationRuntimeRegistryCoordinator
  >["persistenceEnabled"];
  removeAgentRunPreferences: ReturnType<
    typeof useConversationRuntimeRegistryCoordinator
  >["removeAgentRunPreferences"];
  activeLongConversation: ReturnType<
    typeof useLongConversationCoordinator
  >["activeConversation"];
  activeLongMaterialReferences: ReturnType<
    typeof useLongConversationCoordinator
  >["availableMaterialReferences"];
  activeLongSkillReferences: ReturnType<
    typeof useLongConversationCoordinator
  >["availableSkillReferences"];
  disposeLongConversation: ReturnType<
    typeof useLongConversationCoordinator
  >["dispose"];
  newLongConversation: ReturnType<
    typeof useLongConversationCoordinator
  >["newConversation"];
  selectLongAgentTeamMode: ReturnType<
    typeof useLongConversationCoordinator
  >["selectAgentTeamMode"];
  selectLongApprovalMode: ReturnType<
    typeof useLongConversationCoordinator
  >["selectApprovalMode"];
  selectLongConversation: ReturnType<
    typeof useLongConversationCoordinator
  >["selectConversation"];
  selectLongModel: ReturnType<
    typeof useLongConversationCoordinator
  >["selectModel"];
  selectLongTemperature: ReturnType<
    typeof useLongConversationCoordinator
  >["selectTemperature"];
  selectLongThinking: ReturnType<
    typeof useLongConversationCoordinator
  >["selectThinking"];
  sendLongMessage: ReturnType<
    typeof useLongConversationCoordinator
  >["sendLongMessage"];
  stopLongGeneration: ReturnType<
    typeof useLongConversationCoordinator
  >["stopGeneration"];
  updateLongComposerDraft: ReturnType<
    typeof useLongConversationCoordinator
  >["updateDraft"];
  useLongSuggestion: ReturnType<
    typeof useLongConversationCoordinator
  >["useSuggestion"];
  activeConversation: ReturnType<
    typeof useLibraryConversationCoordinator
  >["activeConversation"];
  writingConversationContext: ReturnType<
    typeof useLibraryConversationCoordinator
  >["conversationContext"];
  disposeLibraryConversationCoordinator: ReturnType<
    typeof useLibraryConversationCoordinator
  >["dispose"];
  newLibraryConversation: ReturnType<
    typeof useLibraryConversationCoordinator
  >["newConversation"];
  selectAgentTeamMode: ReturnType<
    typeof useLibraryConversationCoordinator
  >["selectAgentTeamMode"];
  selectApprovalMode: ReturnType<
    typeof useLibraryConversationCoordinator
  >["selectApprovalMode"];
  selectConversation: ReturnType<
    typeof useLibraryConversationCoordinator
  >["selectConversation"];
  selectModel: ReturnType<
    typeof useLibraryConversationCoordinator
  >["selectModel"];
  selectTemperature: ReturnType<
    typeof useLibraryConversationCoordinator
  >["selectTemperature"];
  selectThinking: ReturnType<
    typeof useLibraryConversationCoordinator
  >["selectThinking"];
  sendMessage: ReturnType<
    typeof useLibraryConversationCoordinator
  >["sendMessage"];
  stopGeneration: ReturnType<
    typeof useLibraryConversationCoordinator
  >["stopGeneration"];
  updateComposerDraft: ReturnType<
    typeof useLibraryConversationCoordinator
  >["updateDraft"];
  useSuggestion: ReturnType<
    typeof useLibraryConversationCoordinator
  >["useSuggestion"];
  applyDefaultApprovalMode: (permissionMode: GeneralPermissionMode) => void;
  hydrateConversationPreferences: ReturnType<
    typeof useConversationRuntimeRegistryCoordinator
  >["hydrateConversationPreferences"];
}
