import { useLongLedgerCommitDeletionCoordinator } from "../../composables/useLongLedgerCommitDeletionCoordinator";
import { useLongWorkspacePresentationCoordinator } from "../../composables/useLongWorkspacePresentationCoordinator";
import { useLongProposalRuntimeCoordinator } from "../../composables/useLongProposalRuntimeCoordinator";
import {
  useLongWorkspaceSessionCoordinator,
  type LongWorkspaceEditorPort
} from "../../composables/useLongWorkspaceSessionCoordinator";
export interface NovelRuntime {
  longWorkspacePresentation: ReturnType<
    typeof useLongWorkspacePresentationCoordinator
  >;
  activeLongRoot: ReturnType<
    typeof useLongWorkspacePresentationCoordinator
  >["activeLongRoot"];
  activeLongAgentProfile: ReturnType<
    typeof useLongWorkspacePresentationCoordinator
  >["activeLongAgentProfile"];
  activeLongRuntimeContext: ReturnType<
    typeof useLongWorkspacePresentationCoordinator
  >["activeLongRuntimeContext"];
  longEditorLocked: ReturnType<
    typeof useLongWorkspacePresentationCoordinator
  >["longEditorLocked"];
  longEditorLockedReason: ReturnType<
    typeof useLongWorkspacePresentationCoordinator
  >["longEditorLockedReason"];
  editorLocked: ReturnType<
    typeof useLongWorkspacePresentationCoordinator
  >["editorLocked"];
  editorLockedLabel: ReturnType<
    typeof useLongWorkspacePresentationCoordinator
  >["editorLockedLabel"];
  editorSaving: ReturnType<
    typeof useLongWorkspacePresentationCoordinator
  >["editorSaving"];
  buildLongLibraryAttachmentsForProfile: ReturnType<
    typeof useLongWorkspacePresentationCoordinator
  >["buildLongLibraryAttachmentsForProfile"];
  filterLongReadableAttachmentsForProfile: ReturnType<
    typeof useLongWorkspacePresentationCoordinator
  >["filterLongReadableAttachmentsForProfile"];
  longCatalogContextDocuments: ReturnType<
    typeof useLongWorkspacePresentationCoordinator
  >["longCatalogContextDocuments"];
  longWorkspaceProposals: ReturnType<
    typeof useLongProposalRuntimeCoordinator
  >["workspaceProposals"];
  activeLongConversationProposalItems: ReturnType<
    typeof useLongProposalRuntimeCoordinator
  >["activeConversationProposalItems"];
  longConversationKey: ReturnType<
    typeof useLongProposalRuntimeCoordinator
  >["conversationKey"];
  longConversationForProposalEvent: ReturnType<
    typeof useLongProposalRuntimeCoordinator
  >["conversationForProposalEvent"];
  refreshLongProposalWorkspace: ReturnType<
    typeof useLongProposalRuntimeCoordinator
  >["refreshWorkspaceAfterProposal"];
  stopLongBookAgentRuns: ReturnType<
    typeof useLongProposalRuntimeCoordinator
  >["stopBookAgentRuns"];
  disposeLongBookProposalState: ReturnType<
    typeof useLongProposalRuntimeCoordinator
  >["disposeBookProposalState"];
  disposeLongBookConversations: ReturnType<
    typeof useLongProposalRuntimeCoordinator
  >["disposeBookConversations"];
  stopLongGenerationCommand: ReturnType<
    typeof useLongProposalRuntimeCoordinator
  >["stopActiveGeneration"];
  approveLongProposal: ReturnType<
    typeof useLongProposalRuntimeCoordinator
  >["approveProposal"];
  rejectLongProposal: ReturnType<
    typeof useLongProposalRuntimeCoordinator
  >["rejectProposal"];
  retryLongProposalPreview: ReturnType<
    typeof useLongProposalRuntimeCoordinator
  >["retryProposalPreview"];
  locateAcceptedLongProposal: ReturnType<
    typeof useLongProposalRuntimeCoordinator
  >["locateAcceptedProposal"];
  disposeLongProposalRuntime: ReturnType<
    typeof useLongProposalRuntimeCoordinator
  >["dispose"];
  longWorkspaceEditor: ReturnType<
    typeof useLongWorkspaceSessionCoordinator
  >["editor"];
  loadLongBookList: ReturnType<
    typeof useLongWorkspaceSessionCoordinator
  >["loadBookList"];
  saveActiveLongEditorChanges: ReturnType<
    typeof useLongWorkspaceSessionCoordinator
  >["saveActiveEditorChanges"];
  saveActiveLongEditorBeforeLeaving: ReturnType<
    typeof useLongWorkspaceSessionCoordinator
  >["saveActiveEditorBeforeLeaving"];
  openLongBook: ReturnType<
    typeof useLongWorkspaceSessionCoordinator
  >["openBook"];
  refreshActiveLongWorkspace: ReturnType<
    typeof useLongWorkspaceSessionCoordinator
  >["refreshActiveWorkspace"];
  selectLongWorkspaceFile: ReturnType<
    typeof useLongWorkspaceSessionCoordinator
  >["selectWorkspaceFile"];
  selectLongCharacterTab: ReturnType<
    typeof useLongWorkspaceSessionCoordinator
  >["selectCharacterTab"];
  selectLongPlotPointTab: ReturnType<
    typeof useLongWorkspaceSessionCoordinator
  >["selectPlotPointTab"];
  selectLongChapterCardTab: ReturnType<
    typeof useLongWorkspaceSessionCoordinator
  >["selectChapterCardTab"];
  handleLongFileContextChange: ReturnType<
    typeof useLongWorkspaceSessionCoordinator
  >["handleFileContextChange"];
  handleLongDocumentSaved: ReturnType<
    typeof useLongWorkspaceSessionCoordinator
  >["handleDocumentSaved"];
  retryActiveLongWorkspaceRefresh: ReturnType<
    typeof useLongWorkspaceSessionCoordinator
  >["retryActiveRefresh"];
  refreshLongWorkspaceOnWindowFocus: ReturnType<
    typeof useLongWorkspaceSessionCoordinator
  >["refreshOnWindowFocus"];
  invalidateLongWorkspaceRefresh: ReturnType<
    typeof useLongWorkspaceSessionCoordinator
  >["invalidateRefresh"];
  deactivateActiveLongBook: ReturnType<
    typeof useLongWorkspaceSessionCoordinator
  >["deactivateActiveBook"];
  clearActiveLongBook: ReturnType<
    typeof useLongWorkspaceSessionCoordinator
  >["clearActiveBook"];
  activateOpenedLongBook: ReturnType<
    typeof useLongWorkspaceSessionCoordinator
  >["activateOpenedBook"];
  disposeLongWorkspaceSession: ReturnType<
    typeof useLongWorkspaceSessionCoordinator
  >["dispose"];
  requestDeleteLongLedgerCommit: ReturnType<
    typeof useLongLedgerCommitDeletionCoordinator
  >["request"];
  closeDeleteLongLedgerCommit: ReturnType<
    typeof useLongLedgerCommitDeletionCoordinator
  >["close"];
  confirmDeleteLongLedgerCommit: ReturnType<
    typeof useLongLedgerCommitDeletionCoordinator
  >["confirm"];
  updateLongWorkspaceEditorPort: (port: LongWorkspaceEditorPort | null) => void;
}
