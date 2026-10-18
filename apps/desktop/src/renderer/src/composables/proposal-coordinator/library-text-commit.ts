import { createShortWorkspaceContentRevision } from "@deepwrite/contracts/renderer";
import type { AgentEditProposal } from "../../types/conversation";
import { classifyAgentEditAcceptance } from "../../utils/agentEditReview";
import type { AgentConversationController } from "../useAgentConversation";
import type {
  AgentEditReviewRequest,
  ProposalCoordinatorContext
} from "./types";
import type { createLibraryCreationCommit } from "./library-creation-commit";

export function createLibraryTextCommit(
  context: ProposalCoordinatorContext,
  revisions: ReturnType<typeof createLibraryCreationCommit>
) {
  const { api, notifications: uiMessage } = context;
  const {
    findCatalogLibrary,
    loadSnapshot: loadCatalogSnapshot,
    applyAcceptedDocumentLocally: applyAcceptedAgentDocumentLocally,
    applySavedLibraryEntry,
    applyUpdatedLibrary: applyUpdatedCatalogLibrary,
    isConflict: isCatalogConflict
  } = context.catalog;
  const {
    documents,
    drafts: editorDrafts,
    liveDocuments: liveWorkspaceDocuments,
    acceptingWorkspaceIds: acceptingAgentEditWorkspaceIds,
    savingDocumentIds,
    setDocumentAccepting: setAgentEditDocumentAccepting,
    setWorkspaceAccepting: setAgentEditWorkspaceAccepting
  } = context.editor;
  const {
    currentLibraryProjectRevisionMatches,
    rememberAcceptedLibraryMutation
  } = revisions;
  async function acceptLibraryTextEdit(
    conversation: AgentConversationController,
    request: AgentEditReviewRequest,
    proposal: AgentEditProposal,
    automatic: boolean
  ): Promise<void> {
    const target = liveWorkspaceDocuments.value.find(
      (document) => document.id === proposal.documentId
    );
    const persistedDocument = documents.value.find(
      (document) => document.id === proposal.documentId
    );
    if (!target || !persistedDocument || target.readOnly) {
      const message = "目标文稿已不可用，无法接受这项智能体修改。";
      conversation.updateEditProposal(request.runId, request.proposalId, {
        status: "error",
        statusMessage: message
      });
      uiMessage.error(message);
      return;
    }

    if (proposal.libraryTarget) {
      const library = findCatalogLibrary(
        proposal.libraryTarget.domain,
        proposal.libraryTarget.libraryId
      );
      if (
        !library ||
        !currentLibraryProjectRevisionMatches(proposal, library.projectRevision)
      ) {
        const message = "资料库目录已在审阅期间发生变化，未接受智能体修改。";
        conversation.updateEditProposal(request.runId, request.proposalId, {
          status: "conflict",
          statusMessage: message
        });
        uiMessage.warning(message);
        return;
      }
    }

    if (
      acceptingAgentEditWorkspaceIds.value.has(proposal.workspaceId) ||
      documents.value.some(
        (document) =>
          (document.workspaceId === proposal.workspaceId ||
            (proposal.libraryTarget !== undefined &&
              document.domain === proposal.libraryTarget.domain &&
              document.libraryId === proposal.libraryTarget.libraryId)) &&
          savingDocumentIds.value.has(document.id)
      )
    ) {
      const message = automatic
        ? "检测到作品正在保存其他内容，实时自动落盘已暂停，请稍后人工重试。"
        : "同一作品正在保存其他修改，请稍候再接受";
      conversation.updateEditProposal(request.runId, request.proposalId, {
        status: automatic ? "error" : "pending",
        statusMessage: message
      });
      uiMessage.info(message);
      return;
    }

    const currentDraft = editorDrafts.value[target.id];
    if (
      typeof proposal.proposedText === "string" &&
      persistedDocument.content === proposal.proposedText &&
      (!proposal.libraryTarget || persistedDocument.title === proposal.title)
    ) {
      const staleRecoveryDraft = Boolean(
        currentDraft &&
        currentDraft.title === persistedDocument.title &&
        (currentDraft.content === persistedDocument.content ||
          currentDraft.content === proposal.proposedText)
      );
      if (staleRecoveryDraft) {
        const nextDrafts = { ...editorDrafts.value };
        delete nextDrafts[target.id];
        editorDrafts.value = nextDrafts;
      }
      conversation.updateEditProposal(request.runId, request.proposalId, {
        status: "accepted",
        proposedText: undefined,
        statusMessage:
          currentDraft && !staleRecoveryDraft
            ? "修改已在本地 Markdown 中；检测到另一份未保存草稿，已为你保留。"
            : "修改已经存在于本地 Markdown 中。"
      });
      if (!automatic) {
        uiMessage.success("智能体修改已经保存在本地文稿中");
      }
      return;
    }

    if (typeof proposal.proposedText !== "string") {
      const message = "待审阅变更缺少完整修改稿，请重新生成修改。";
      conversation.updateEditProposal(request.runId, request.proposalId, {
        status: "error",
        statusMessage: message
      });
      uiMessage.error(message);
      return;
    }
    if (
      proposal.libraryTarget &&
      classifyAgentEditAcceptance(proposal, target.content) === "conflict"
    ) {
      const message =
        "资料库内容已在审阅期间发生变化，未接受智能体修改，也没有覆盖最新内容。";
      conversation.updateEditProposal(request.runId, request.proposalId, {
        status: "conflict",
        statusMessage: message
      });
      uiMessage.warning(message);
      return;
    }

    const proposedText = proposal.proposedText;
    const payload = {
      id: target.id,
      title: proposal.title,
      content: proposedText
    };
    conversation.updateEditProposal(request.runId, request.proposalId, {
      status: "accepting",
      statusMessage: automatic
        ? "正在自动批准并保存到本地 Markdown…"
        : "正在保存到本地 Markdown…"
    });
    setAgentEditDocumentAccepting(target.id, true);
    setAgentEditWorkspaceAccepting(proposal.workspaceId, true);
    const draftAtAccept = currentDraft;
    const currentApi = api();

    try {
      let newerDraftPreserved = false;
      if (
        proposal.libraryTarget?.operation === "edit-overview" &&
        persistedDocument.catalogLibraryField === "overview" &&
        persistedDocument.libraryId &&
        (persistedDocument.domain === "material" ||
          persistedDocument.domain === "skill")
      ) {
        if (!currentApi) {
          throw new Error("桌面文件服务当前不可用。");
        }
        const updated = await currentApi.catalog.updateLibrary({
          ...(proposal.libraryTarget.managementScope
            ? { managementScope: proposal.libraryTarget.managementScope }
            : {}),
          domain: persistedDocument.domain,
          libraryId: persistedDocument.libraryId,
          overview: payload.content,
          ...(persistedDocument.catalogProjectRevision === undefined
            ? {}
            : {
                baseProjectRevision:
                  findCatalogLibrary(
                    persistedDocument.domain,
                    persistedDocument.libraryId
                  )?.projectRevision ?? persistedDocument.catalogProjectRevision
              })
        });
        const normalizedPayload = {
          id: payload.id,
          title: persistedDocument.title,
          content: updated.overview
        };
        await applyUpdatedCatalogLibrary(persistedDocument.domain, updated);
        applyAcceptedAgentDocumentLocally(
          normalizedPayload,
          updated.projectRevision,
          draftAtAccept
        );
        rememberAcceptedLibraryMutation(proposal);
        newerDraftPreserved = Boolean(editorDrafts.value[payload.id]);
      } else if (
        proposal.libraryTarget?.operation === "edit" &&
        persistedDocument.catalogEntryId &&
        persistedDocument.libraryId &&
        (persistedDocument.domain === "material" ||
          persistedDocument.domain === "skill")
      ) {
        if (!currentApi) {
          throw new Error("桌面文件服务当前不可用。");
        }
        const library = findCatalogLibrary(
          persistedDocument.domain,
          persistedDocument.libraryId
        );
        if (!library) {
          throw new Error("目标资料库已不存在。");
        }
        const projectRevision = library.projectRevision;
        const saved = await currentApi.catalog.saveLibraryEntry({
          ...(proposal.libraryTarget.managementScope
            ? { managementScope: proposal.libraryTarget.managementScope }
            : {}),
          domain: persistedDocument.domain,
          libraryId: persistedDocument.libraryId,
          entryId: persistedDocument.catalogEntryId,
          title: payload.title,
          content: payload.content,
          baseRevision:
            currentDraft?.baseRevision ??
            createShortWorkspaceContentRevision(persistedDocument.content),
          ...(projectRevision === undefined
            ? {}
            : { baseProjectRevision: projectRevision })
        });
        const savedProjectRevision =
          projectRevision === undefined ? undefined : projectRevision + 1;
        const normalizedPayload = {
          id: payload.id,
          title: saved.title,
          content: saved.body
        };
        const synchronizedProjectRevision = await applySavedLibraryEntry(
          persistedDocument.domain,
          persistedDocument.libraryId,
          saved,
          savedProjectRevision
        );
        applyAcceptedAgentDocumentLocally(
          normalizedPayload,
          synchronizedProjectRevision,
          draftAtAccept
        );
        rememberAcceptedLibraryMutation(proposal);
        newerDraftPreserved = Boolean(editorDrafts.value[payload.id]);
      } else {
        throw new Error("目标资料库文件无法写入，请重新生成修改。");
      }

      conversation.updateEditProposal(request.runId, request.proposalId, {
        status: "accepted",
        proposedText: undefined,
        statusMessage: newerDraftPreserved
          ? `${automatic ? "已自动批准并" : "已"}保存审阅时的智能体修改；保存期间出现的更新草稿已保留。`
          : `${automatic ? "已自动批准并" : "已接受并"}保存到本地文件。`
      });
      if (!automatic) {
        uiMessage.success("已接受并保存智能体修改");
      }
    } catch (error: unknown) {
      const conflict = isCatalogConflict(error);
      const message = conflict
        ? "本地 Markdown 已在其他位置更新，未保存智能体修改；请基于最新文稿重新生成。"
        : error instanceof Error
          ? error.message
          : "保存智能体修改失败，原文保持不变。";
      conversation.updateEditProposal(request.runId, request.proposalId, {
        status: conflict ? "conflict" : "error",
        statusMessage: message
      });
      if (conflict) {
        await loadCatalogSnapshot();
        uiMessage.warning(message);
      } else {
        uiMessage.error(message);
      }
    } finally {
      setAgentEditDocumentAccepting(target.id, false);
      setAgentEditWorkspaceAccepting(proposal.workspaceId, false);
    }
  }
  return acceptLibraryTextEdit;
}
