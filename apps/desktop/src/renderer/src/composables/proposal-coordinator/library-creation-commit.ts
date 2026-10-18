import {
  MaterialStageIdSchema,
  SkillStageIdSchema
} from "@deepwrite/contracts/renderer";
import type { AgentEditProposal } from "../../types/conversation";
import type { AgentConversationController } from "../useAgentConversation";
import type {
  AgentEditReviewRequest,
  ProposalCoordinatorContext
} from "./types";

export function createLibraryCreationCommit(
  context: ProposalCoordinatorContext
) {
  const { api, notifications: uiMessage } = context;
  const {
    findCatalogLibrary,
    loadSnapshot: loadCatalogSnapshot,
    applyCreatedLibraryEntry,
    isConflict: isCatalogConflict
  } = context.catalog;
  const {
    documents,
    acceptingWorkspaceIds: acceptingAgentEditWorkspaceIds,
    setWorkspaceAccepting: setAgentEditWorkspaceAccepting
  } = context.editor;
  const { selectedResourceId, rightCollapsed } = context.navigation;
  const acceptedLibraryMutationCounts = new Map<string, number>();
  function libraryMutationCountKey(proposal: AgentEditProposal): string {
    const target = proposal.libraryTarget!;
    return `${proposal.runId}\u0000${target.domain}\u0000${target.libraryId}\u0000${target.baseProjectRevision ?? "legacy"}`;
  }

  function currentLibraryProjectRevisionMatches(
    proposal: AgentEditProposal,
    currentRevision: number | undefined
  ): boolean {
    const baseRevision = proposal.libraryTarget?.baseProjectRevision;
    if (baseRevision === undefined || currentRevision === undefined) {
      return baseRevision === currentRevision;
    }
    const acceptedCount =
      acceptedLibraryMutationCounts.get(libraryMutationCountKey(proposal)) ?? 0;
    return currentRevision === baseRevision + acceptedCount;
  }

  function rememberAcceptedLibraryMutation(proposal: AgentEditProposal): void {
    const key = libraryMutationCountKey(proposal);
    acceptedLibraryMutationCounts.set(
      key,
      (acceptedLibraryMutationCounts.get(key) ?? 0) + 1
    );
    while (acceptedLibraryMutationCounts.size > 2_000) {
      const oldest = acceptedLibraryMutationCounts.keys().next().value as
        string | undefined;
      if (!oldest) break;
      acceptedLibraryMutationCounts.delete(oldest);
    }
  }

  async function acceptLibraryCreationProposal(
    conversation: AgentConversationController,
    request: AgentEditReviewRequest,
    proposal: AgentEditProposal,
    automatic: boolean
  ): Promise<void> {
    const target = proposal.libraryTarget;
    if (
      !target ||
      target.operation !== "create" ||
      typeof proposal.proposedText !== "string"
    ) {
      const message = "待审阅的新条目缺少完整内容，请重新生成。";
      conversation.updateEditProposal(request.runId, request.proposalId, {
        status: "error",
        statusMessage: message
      });
      uiMessage.error(message);
      return;
    }
    const currentApi = api();
    if (!currentApi) {
      const message = "桌面文件服务当前不可用。";
      conversation.updateEditProposal(request.runId, request.proposalId, {
        status: "error",
        statusMessage: message
      });
      uiMessage.error(message);
      return;
    }
    const library = findCatalogLibrary(target.domain, target.libraryId);
    const readOnly =
      !library ||
      (target.domain === "skill" &&
        "isBuiltin" in library &&
        library.isBuiltin);
    if (readOnly) {
      const message = "目标资料库已不可用或只读，无法创建条目。";
      conversation.updateEditProposal(request.runId, request.proposalId, {
        status: "conflict",
        statusMessage: message
      });
      uiMessage.warning(message);
      return;
    }
    if (
      !currentLibraryProjectRevisionMatches(proposal, library.projectRevision)
    ) {
      const message = "资料库目录已发生变化，未创建条目，请重新生成。";
      conversation.updateEditProposal(request.runId, request.proposalId, {
        status: "conflict",
        statusMessage: message
      });
      uiMessage.warning(message);
      return;
    }
    if (acceptingAgentEditWorkspaceIds.value.has(proposal.workspaceId)) {
      uiMessage.info("同一资料库正在保存其他修改，请稍候再接受");
      return;
    }

    conversation.updateEditProposal(request.runId, request.proposalId, {
      status: "accepting",
      statusMessage: automatic
        ? "正在自动批准并创建资料库条目…"
        : "正在校验资料库版本并创建条目…"
    });
    setAgentEditWorkspaceAccepting(proposal.workspaceId, true);
    try {
      const commonInput = {
        libraryId: target.libraryId,
        ...(target.managementScope
          ? { managementScope: target.managementScope }
          : {}),
        title: proposal.title,
        content: proposal.proposedText,
        ...(library.projectRevision === undefined
          ? {}
          : { baseProjectRevision: library.projectRevision })
      };
      const created =
        target.domain === "material"
          ? await currentApi.catalog.createLibraryEntry({
              ...commonInput,
              domain: "material",
              stageId: MaterialStageIdSchema.parse(target.stageId)
            })
          : await currentApi.catalog.createLibraryEntry({
              ...commonInput,
              domain: "skill",
              stageId: SkillStageIdSchema.parse(target.stageId)
            });
      const nextProjectRevision =
        library.projectRevision === undefined
          ? undefined
          : library.projectRevision + 1;
      await applyCreatedLibraryEntry(
        target.domain,
        target.libraryId,
        created,
        nextProjectRevision
      );
      rememberAcceptedLibraryMutation(proposal);
      const createdDocument = documents.value.find(
        (document) =>
          document.domain === target.domain &&
          document.libraryId === target.libraryId &&
          document.catalogEntryId === created.id
      );
      conversation.updateEditProposal(request.runId, request.proposalId, {
        status: "accepted",
        proposedText: undefined,
        ...(createdDocument ? { documentId: createdDocument.id } : {}),
        libraryTarget: {
          ...target,
          entryId: created.id
        },
        statusMessage: automatic
          ? "已自动批准并创建资料库条目。"
          : "已创建并保存到本地 Markdown。"
      });
      if (createdDocument && !target.managementScope) {
        selectedResourceId.value = createdDocument.id;
        rightCollapsed.value = false;
      }
      uiMessage.success(
        automatic ? "已自动批准并创建资料库条目" : "已创建资料库条目"
      );
    } catch (error: unknown) {
      const message = isCatalogConflict(error)
        ? "资料库已在外部更新，未创建条目；请重新生成。"
        : error instanceof Error
          ? error.message
          : "创建资料库条目失败。";
      conversation.updateEditProposal(request.runId, request.proposalId, {
        status: isCatalogConflict(error) ? "conflict" : "error",
        statusMessage: message
      });
      if (isCatalogConflict(error)) {
        await loadCatalogSnapshot();
        uiMessage.warning(message);
      } else {
        uiMessage.error(message);
      }
    } finally {
      setAgentEditWorkspaceAccepting(proposal.workspaceId, false);
    }
  }
  return {
    acceptLibraryCreationProposal,
    currentLibraryProjectRevisionMatches,
    rememberAcceptedLibraryMutation
  };
}
