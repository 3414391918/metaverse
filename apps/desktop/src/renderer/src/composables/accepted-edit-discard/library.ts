import { createShortWorkspaceContentRevision } from "@deepwrite/contracts/renderer";
import type { AgentEditProposal } from "../../types/conversation";
import type { ProposalCoordinatorContext } from "../proposal-coordinator/types";
import { AcceptedEditDiscardConflictError } from "../../utils/acceptedEditDiscard";

type Context = ProposalCoordinatorContext;

function requireCurrentAcceptedDocument(
  context: Context,
  proposal: AgentEditProposal
) {
  const document = context.editor.documents.value.find(
    (candidate) => candidate.id === proposal.documentId
  );
  const snapshot = proposal.discardSnapshot;
  if (!document || snapshot?.beforeText === undefined) {
    throw new Error("缺少修改前的完整内容，无法安全舍弃本次修改。");
  }
  const draft = context.editor.drafts.value[document.id];
  if (draft?.dirty) {
    throw new AcceptedEditDiscardConflictError(
      "目标文件有未保存编辑，未舍弃本次修改。请先处理当前草稿。"
    );
  }
  if (
    createShortWorkspaceContentRevision(document.content) !==
      proposal.proposedRevision ||
    document.title !== proposal.title
  ) {
    throw new AcceptedEditDiscardConflictError(
      "目标文件已有后续修改，未覆盖最新内容；本次修改没有被舍弃。"
    );
  }
  return { document, snapshot };
}

export async function discardAcceptedLibraryTextEdit(
  context: Context,
  proposal: AgentEditProposal
): Promise<void> {
  const api = context.api();
  const { document, snapshot } = requireCurrentAcceptedDocument(
    context,
    proposal
  );
  const title = snapshot.beforeTitle ?? document.title;
  const content = snapshot.beforeText!;
  if (
    proposal.libraryTarget?.operation === "edit-overview" &&
    document.catalogLibraryField === "overview" &&
    document.libraryId &&
    (document.domain === "material" || document.domain === "skill")
  ) {
    if (!api) throw new Error("桌面文件服务当前不可用。");
    const library = context.catalog.findCatalogLibrary(
      document.domain,
      document.libraryId
    );
    if (!library) throw new Error("目标资料库已不存在。");
    const updated = await api.catalog.updateLibrary({
      ...(proposal.libraryTarget.managementScope
        ? { managementScope: proposal.libraryTarget.managementScope }
        : {}),
      domain: document.domain,
      libraryId: document.libraryId,
      overview: content,
      ...(library.projectRevision === undefined
        ? {}
        : { baseProjectRevision: library.projectRevision })
    });
    await context.catalog.applyUpdatedLibrary(document.domain, updated);
    context.catalog.applyAcceptedDocumentLocally(
      { id: document.id, title: document.title, content: updated.overview },
      updated.projectRevision,
      undefined
    );
    return;
  }
  if (
    proposal.libraryTarget?.operation === "edit" &&
    document.catalogEntryId &&
    document.libraryId &&
    (document.domain === "material" || document.domain === "skill")
  ) {
    if (!api) throw new Error("桌面文件服务当前不可用。");
    const library = context.catalog.findCatalogLibrary(
      document.domain,
      document.libraryId
    );
    if (!library) throw new Error("目标资料库已不存在。");
    const saved = await api.catalog.saveLibraryEntry({
      ...(proposal.libraryTarget.managementScope
        ? { managementScope: proposal.libraryTarget.managementScope }
        : {}),
      domain: document.domain,
      libraryId: document.libraryId,
      entryId: document.catalogEntryId,
      title,
      content,
      baseRevision: createShortWorkspaceContentRevision(document.content),
      ...(library.projectRevision === undefined
        ? {}
        : { baseProjectRevision: library.projectRevision })
    });
    const projectRevision =
      library.projectRevision === undefined
        ? undefined
        : library.projectRevision + 1;
    const synchronizedRevision = await context.catalog.applySavedLibraryEntry(
      document.domain,
      document.libraryId,
      saved,
      projectRevision
    );
    context.catalog.applyAcceptedDocumentLocally(
      { id: document.id, title: saved.title, content: saved.body },
      synchronizedRevision,
      undefined
    );
    return;
  }
  throw new Error("该提案不属于当前资料库修改流程，无法舍弃。");
}
