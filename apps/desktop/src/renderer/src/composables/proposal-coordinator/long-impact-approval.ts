import type {
  LongWorkspaceImpactConfirmation,
  LongWorkspaceOperationBatch
} from "@deepwrite/contracts";
import { longWorkspaceOperationsRequireImpactConfirmation } from "@deepwrite/contracts/renderer";
import type { AgentEditProposal } from "../../types/conversation";
import type { LongWorkspaceRendererApi } from "../../types/longWorkspace";
import type { AgentConversationController } from "../useAgentConversation";

interface ManualReviewInput {
  conversation: AgentConversationController;
  runId: string;
  proposalId: string;
  patch: Partial<AgentEditProposal>;
  statusMessage: string;
  notificationMessage: string;
  removeQueued(
    conversation: AgentConversationController,
    runId: string,
    proposalId: string
  ): void;
  notify(message: string): void;
}

interface HoldForManualReviewInput extends ManualReviewInput {
  automatic: boolean;
  hadExpectedImpact: boolean;
  batch: LongWorkspaceOperationBatch;
  confirmation: LongWorkspaceImpactConfirmation;
}

export function moveLongProposalToManualReview(input: ManualReviewInput): void {
  input.removeQueued(input.conversation, input.runId, input.proposalId);
  input.conversation.updateEditProposal(input.runId, input.proposalId, {
    ...input.patch,
    status: "pending",
    approvalMode: "request-approval",
    statusMessage: input.statusMessage
  });
  input.notify(input.notificationMessage);
}

/**
 * A newly previewed manual proposal and every destructive automatic proposal
 * must leave the queue. The next apply can only come from a fresh user approval
 * reservation, so system queue drains cannot silently reuse it.
 */
export function holdLongProposalForManualReview(
  input: HoldForManualReviewInput
): boolean {
  const shouldHold =
    (!input.hadExpectedImpact && !input.automatic) ||
    (input.automatic &&
      longWorkspaceOperationsRequireImpactConfirmation(
        input.batch.operations,
        input.confirmation
      ));
  if (!shouldHold) return false;
  moveLongProposalToManualReview(input);
  return true;
}

export function isLongImpactMismatch(error: unknown): boolean {
  return (
    error instanceof Error &&
    /impact_mismatch|关联.*变化|影响.*变化/iu.test(error.message)
  );
}

export async function previewLongProposalImpact(
  api: Pick<LongWorkspaceRendererApi, "previewOperations">,
  bookId: string,
  batch: LongWorkspaceOperationBatch,
  label: string
): Promise<LongWorkspaceImpactConfirmation> {
  const preview = await api.previewOperations({ bookId, batch });
  if (preview.bookId !== bookId) {
    throw new Error(`${label}影响预览与当前作品不匹配。`);
  }
  return preview.preview.confirmation;
}
