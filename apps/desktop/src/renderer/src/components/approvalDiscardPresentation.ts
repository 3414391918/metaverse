import type { AgentEditProposal } from "../types/conversation";

type DiscardState = AgentEditProposal["discardState"];

export function approvalDiscardStatusLabel(
  state: DiscardState
): string | undefined {
  if (state?.status === "discarding") return "正在舍弃";
  if (state?.status === "discarded") return "已舍弃";
  if (state?.status === "conflict") return "舍弃冲突";
  if (state?.status === "error") return "舍弃失败";
  return undefined;
}

export function approvalDiscardVisualStatus(
  state: DiscardState
): AgentEditProposal["status"] | undefined {
  if (state?.status === "discarding") return "accepting";
  if (state?.status === "discarded") return "rejected";
  if (state?.status === "conflict") return "conflict";
  if (state?.status === "error") return "error";
  return undefined;
}

export function approvalDiscardStatusMessage(
  state: DiscardState
): string | undefined {
  return state?.message;
}

export function shouldShowApprovalDiscardButton(
  discardable: boolean,
  accepted: boolean,
  state: DiscardState
): boolean {
  return discardable && accepted && state?.status !== "discarded";
}
