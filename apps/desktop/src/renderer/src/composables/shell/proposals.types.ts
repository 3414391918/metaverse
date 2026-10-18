import { useLazyProposalCoordinator } from "../../composables/useLazyProposalCoordinator";
export interface ProposalsRuntime {
  resumeRecoveredAutomaticAgentEdits: ReturnType<
    typeof useLazyProposalCoordinator
  >["resumeRecoveredAutomaticAgentEdits"];
  reviewAgentEdit: ReturnType<
    typeof useLazyProposalCoordinator
  >["reviewAgentEdit"];
  reviewLongAgentEdit: ReturnType<
    typeof useLazyProposalCoordinator
  >["reviewLongAgentEdit"];
  discardAgentEdit: ReturnType<
    typeof useLazyProposalCoordinator
  >["discardAgentEdit"];
  scheduleQueuedAgentEdits: ReturnType<
    typeof useLazyProposalCoordinator
  >["scheduleQueuedAgentEdits"];
  disposeProposalCoordinator: ReturnType<
    typeof useLazyProposalCoordinator
  >["dispose"];
  stageLibraryEditProposal: ReturnType<
    typeof useLazyProposalCoordinator
  >["stageLibraryEditProposal"];
  stageLongPlotDesignEditProposal: ReturnType<
    typeof useLazyProposalCoordinator
  >["stageLongPlotDesignEditProposal"];
  stageLongWorldbuildingEditProposal: ReturnType<
    typeof useLazyProposalCoordinator
  >["stageLongWorldbuildingEditProposal"];
  stageLongCharacterEditProposal: ReturnType<
    typeof useLazyProposalCoordinator
  >["stageLongCharacterEditProposal"];
  stageLongDraftEditProposal: ReturnType<
    typeof useLazyProposalCoordinator
  >["stageLongDraftEditProposal"];
}
