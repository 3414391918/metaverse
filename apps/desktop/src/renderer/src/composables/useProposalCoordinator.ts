import { createAcceptedEditDiscardCoordinator } from "./accepted-edit-discard";
import { createLibraryCreationCommit } from "./proposal-coordinator/library-creation-commit";
import { createLibraryTextCommit } from "./proposal-coordinator/library-text-commit";
import { createLibraryProposalStager } from "./proposal-coordinator/library-staging";
import { createLongCharacterProposalCommit } from "./proposal-coordinator/long-character-commit";
import { createLongDraftProposalCommit } from "./proposal-coordinator/long-draft-commit";
import { createLongPlotDesignProposalCommit } from "./proposal-coordinator/long-plot-design-commit";
import { createLongWorldbuildingProposalLane } from "./proposal-coordinator/long-worldbuilding-lane";
import { createLongCharacterProposalStager } from "./proposal-coordinator/long-character-staging";
import { createLongDraftProposalStager } from "./proposal-coordinator/long-draft-staging";
import { createLongPlotDesignProposalStager } from "./proposal-coordinator/long-plot-design-staging";
import { createLongWorldbuildingProposalStager } from "./proposal-coordinator/long-worldbuilding-staging";
import { autoApproveEditPriority } from "./proposal-coordinator/generations";
import { createProposalQueue } from "./proposal-coordinator/queue";
import { createProposalReview } from "./proposal-coordinator/review";
import type { ProposalCoordinatorContext } from "./proposal-coordinator/types";

export type {
  ProposalCoordinatorContext,
  ProposalCoordinatorNotifications,
  QueuedAgentEdit
} from "./proposal-coordinator/types";

export function useProposalCoordinator(context: ProposalCoordinatorContext) {
  const queue = createProposalQueue({
    apply: (queued) =>
      review.applyAgentEdit(
        queued.conversation,
        {
          runId: queued.runId,
          proposalId: queued.proposalId,
          decision: "accept"
        },
        queued.automatic,
        {
          decisionToken: queued.decisionToken,
          expectedProposedRevision: queued.expectedProposedRevision
        }
      ),
    priority: autoApproveEditPriority,
    reportUnexpectedError: (error) => {
      context.notifications.error(
        error instanceof Error ? error.message : "批准智能体修改失败。"
      );
    }
  });
  const library = createLibraryCreationCommit(context);
  const commitOptions = {
    acceptingAgentEditWorkspaceIds: context.editor.acceptingWorkspaceIds,
    setAgentEditWorkspaceAccepting: context.editor.setWorkspaceAccepting,
    activeLongBookId: context.longWorkspace.activeBookId,
    longBooks: context.longWorkspace.books,
    saveActiveLongEditorChanges: context.longWorkspace.saveActiveEditorChanges,
    refreshLongProposalWorkspace:
      context.longWorkspace.refreshWorkspaceAfterProposal,
    removeQueuedAgentEdit: queue.removeQueuedAgentEdit,
    uiMessage: context.notifications
  };
  const review = createProposalReview(context, queue, {
    acceptLibraryCreationProposal: library.acceptLibraryCreationProposal,
    acceptLibraryTextEdit: createLibraryTextCommit(context, library),
    acceptLongWorldbuildingFileProposal:
      createLongWorldbuildingProposalLane(commitOptions).accept,
    acceptLongCharacterFileProposal:
      createLongCharacterProposalCommit(commitOptions),
    acceptLongPlotDesignProposal:
      createLongPlotDesignProposalCommit(commitOptions),
    acceptLongDraftProposal: createLongDraftProposalCommit(commitOptions)
  });
  const discard = createAcceptedEditDiscardCoordinator(context);
  function stageWhileActive<Event, Result>(stage: (event: Event) => Result) {
    return (event: Event): Result | undefined => {
      if (!queue.isDisposed()) return stage(event);
    };
  }
  return {
    resumeRecoveredAutomaticAgentEdits: (
      ...args: Parameters<typeof review.resumeRecoveredAutomaticAgentEdits>
    ) => {
      if (!queue.isDisposed())
        review.resumeRecoveredAutomaticAgentEdits(...args);
    },
    hasQueuedAgentEdits: queue.hasQueuedAgentEdits,
    reviewAgentEdit: (...args: Parameters<typeof review.reviewAgentEdit>) =>
      queue.invokeWhileActive(() => review.reviewAgentEdit(...args)),
    reviewLongAgentEdit: (
      ...args: Parameters<typeof review.reviewLongAgentEdit>
    ) => queue.invokeWhileActive(() => review.reviewLongAgentEdit(...args)),
    discardAgentEdit: (...args: Parameters<typeof discard.discardAgentEdit>) =>
      queue.invokeWhileActive(() => discard.discardAgentEdit(...args)),
    scheduleQueuedAgentEdits: (
      ...args: Parameters<typeof queue.scheduleQueuedAgentEdits>
    ) => {
      if (!queue.isDisposed()) queue.scheduleQueuedAgentEdits(...args);
    },
    stageLibraryEditProposal: stageWhileActive(
      createLibraryProposalStager(
        context,
        queue.queueAgentEdit,
        queue.isDisposed,
        queue.drain
      )
    ),
    stageLongCharacterEditProposal: stageWhileActive(
      createLongCharacterProposalStager(context, queue.queueAgentEdit)
    ),
    stageLongDraftEditProposal: stageWhileActive(
      createLongDraftProposalStager(context, queue.queueAgentEdit)
    ),
    stageLongPlotDesignEditProposal: stageWhileActive(
      createLongPlotDesignProposalStager(context, queue.queueAgentEdit)
    ),
    stageLongWorldbuildingEditProposal: stageWhileActive(
      createLongWorldbuildingProposalStager(context, queue.queueAgentEdit)
    ),
    drain: queue.drain,
    dispose: queue.dispose
  };
}

export type ProposalCoordinator = ReturnType<typeof useProposalCoordinator>;
