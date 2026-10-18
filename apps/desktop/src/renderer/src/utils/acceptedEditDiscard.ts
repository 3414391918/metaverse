import type {
  AgentEditProposal,
  AgentToolTrace,
  ChatMessage
} from "../types/conversation";

const LEGACY_MODIFICATION_TOOL_PREFIXES = [
  "edit_",
  "replace_",
  "rename_",
  "move_"
];

export class AcceptedEditDiscardConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AcceptedEditDiscardConflictError";
  }
}

export function isModificationTool(
  tool: Pick<AgentToolTrace, "name">
): boolean {
  return (
    tool.name === "edit" ||
    LEGACY_MODIFICATION_TOOL_PREFIXES.some((prefix) =>
      tool.name.startsWith(prefix)
    )
  );
}

export function approvalUsesModificationTool(
  message: Pick<ChatMessage, "toolCalls">,
  toolCallIds: readonly string[]
): boolean {
  const ids = new Set(toolCallIds);
  return Boolean(
    message.toolCalls?.some(
      (tool) => ids.has(tool.id) && isModificationTool(tool)
    )
  );
}

export function textEditDiscardSnapshot(
  existing: Pick<AgentEditProposal, "discardSnapshot"> | undefined,
  coalescesExisting: boolean,
  beforeText: string,
  beforeTitle: string
): NonNullable<AgentEditProposal["discardSnapshot"]> {
  return coalescesExisting && existing?.discardSnapshot
    ? existing.discardSnapshot
    : { beforeText, beforeTitle };
}

function isAgentCreationProposal(proposal: AgentEditProposal): boolean {
  return Boolean(
    proposal.libraryTarget?.operation === "create" ||
    proposal.draftSectionCreationTarget ||
    proposal.characterStructureTarget?.mutation.type === "createItem" ||
    proposal.plotStructureTarget?.mutation.type === "create" ||
    proposal.provisionalExpertSection ||
    proposal.provisionalCharacterItemId
  );
}

export function agentProposalSupportsDiscard(
  proposal: AgentEditProposal
): boolean {
  if (
    proposal.longWorldbuildingTarget ||
    proposal.longCharacterTarget ||
    proposal.longPlotDesignTarget ||
    proposal.longDraftTarget
  ) {
    return false;
  }
  if (
    proposal.status !== "accepted" ||
    proposal.discardState?.status === "discarded" ||
    isAgentCreationProposal(proposal)
  ) {
    return false;
  }
  if (proposal.characterStructureTarget) {
    return (
      proposal.characterStructureTarget.mutation.type === "updateItem" ||
      proposal.characterStructureTarget.mutation.type === "moveItem"
    );
  }
  if (proposal.plotStructureTarget) {
    return proposal.plotStructureTarget.mutation.type === "update";
  }
  if (proposal.draftSectionRenameTarget) return true;
  return Boolean(
    proposal.discardSnapshot?.beforeText !== undefined &&
    (proposal.proposedRevision !== proposal.baseRevision ||
      proposal.title !== proposal.discardSnapshot.beforeTitle)
  );
}

export function agentApprovalCanDiscard(
  message: Pick<ChatMessage, "toolCalls">,
  proposal: AgentEditProposal
): boolean {
  return (
    approvalUsesModificationTool(message, proposal.toolCallIds) &&
    agentProposalSupportsDiscard(proposal)
  );
}

export function discardStatePatch(
  status: NonNullable<AgentEditProposal["discardState"]>["status"],
  message: string
): NonNullable<AgentEditProposal["discardState"]> {
  return { status, message, updatedAt: new Date().toISOString() };
}
