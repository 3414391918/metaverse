import { ref, watch, type ComputedRef } from "vue";
import type {
  LibraryAgentSettings,
  UserPromptAttachment
} from "@deepwrite/contracts";
import type { AgentConversationController } from "./useAgentConversation";
import type { ConversationMessageRewriteRequest } from "../types/conversation";
import { buildLibraryAgentWorkspaceContext } from "../utils/libraryAgentContext";
import { buildLibraryAgentSkillAttachments } from "../utils/libraryAgentSkillAttachments";
import type {
  LibraryConversationCoordinatorOptions,
  LibraryConversationSendTarget
} from "./libraryConversationContext";

/** Captures library sends and cancels stale requests before runtime dispatch. */
export function useLibraryConversationSend(
  options: LibraryConversationCoordinatorOptions,
  activeConversation: ComputedRef<AgentConversationController>,
  activeConversationKey: ComputedRef<string>,
  activeLibraryAgentProfile: ComputedRef<
    LibraryAgentSettings["agents"][number] | undefined
  >
) {
  const sendPreflightPending = ref(false);
  let disposed = false;
  let sendRequestId = 0;
  let activeSend: Promise<void> | null = null;
  let activeSendConversation: AgentConversationController | null = null;

  function invalidateSendTarget(): void {
    sendRequestId += 1;
  }

  const stopResourceInvalidation = watch(
    options.resource.selectedResourceId,
    invalidateSendTarget,
    { flush: "sync" }
  );

  const stopConversationError = watch(
    () => activeConversation.value.conversationError.value,
    (message) => {
      if (!disposed && message) options.notifications.error(message);
    }
  );

  function captureSendTarget(): LibraryConversationSendTarget {
    const conversation = activeConversation.value;
    const document = options.resource.activeAgentDocument.value;
    return {
      requestId: ++sendRequestId,
      conversation,
      conversationKey: activeConversationKey.value,
      sessionId: conversation.sessionId.value,
      selectedResourceId: options.resource.selectedResourceId.value,
      documentId: document.id,
      draft: conversation.draft.value
    };
  }

  function sendTargetIsCurrent(
    target: LibraryConversationSendTarget,
    options_: { includeDraft?: boolean } = {}
  ): boolean {
    if (disposed || target.requestId !== sendRequestId) return false;
    const document = options.resource.activeAgentDocument.value;
    return (
      activeConversation.value === target.conversation &&
      activeConversationKey.value === target.conversationKey &&
      target.conversation.sessionId.value === target.sessionId &&
      options.resource.selectedResourceId.value === target.selectedResourceId &&
      document.id === target.documentId &&
      (options_.includeDraft === false ||
        target.conversation.draft.value === target.draft)
    );
  }

  function notifyCanceledSend(): void {
    if (disposed) return;
    options.notifications.info(
      "当前资源、会话或输入内容已切换，本次发送已取消。"
    );
  }

  function sendMessage(
    promptAttachments: UserPromptAttachment[] = [],
    rewriteRequest?: ConversationMessageRewriteRequest
  ): Promise<void> {
    if (disposed) return Promise.resolve();
    if (activeSend) {
      options.notifications.info("正在准备上一条消息，请稍候。");
      return Promise.resolve();
    }
    if (
      rewriteRequest &&
      (!activeConversation.value.canRewriteHistory.value ||
        options.edits.acceptingDocumentIds.value.size > 0 ||
        options.edits.acceptingWorkspaceIds.value.size > 0 ||
        options.edits.hasQueued())
    ) {
      options.notifications.info("请先等待当前回复、审批和修改保存全部完成。");
      return Promise.resolve();
    }
    const target = captureSendTarget();
    sendPreflightPending.value = true;
    const operation = (async () => {
      try {
        const contextReady = await options.resource.ensureDocumentsLoaded(
          options.resource.contextDocuments()
        );
        if (!sendTargetIsCurrent(target)) {
          notifyCanceledSend();
          return;
        }
        if (!contextReady) return;

        const contextSnapshot = options.resource.hydratedCatalogSnapshot();
        const liveDocuments = options.resource.liveWorkspaceDocuments.value;
        const agentDocument = options.resource.activeAgentDocument.value;
        const libraryProfile = activeLibraryAgentProfile.value;
        const librarySkillAttachments = libraryProfile
          ? buildLibraryAgentSkillAttachments(libraryProfile.readAccess.skills)
          : null;
        const libraryAgentContext = buildLibraryAgentWorkspaceContext(
          contextSnapshot,
          agentDocument,
          liveDocuments
        );
        if (!sendTargetIsCurrent(target)) {
          notifyCanceledSend();
          return;
        }
        if (!libraryAgentContext) {
          options.notifications.warning(
            "当前资料库上下文尚未就绪，请重新选择条目后再发送。"
          );
          return;
        }
        const skillDiagnostics = librarySkillAttachments?.diagnostics ?? [];
        if (skillDiagnostics.length) {
          const first = skillDiagnostics[0]!;
          options.notifications.warning(
            skillDiagnostics.length === 1
              ? first.message
              : `${first.message}（另有 ${skillDiagnostics.length - 1} 项可用技能提示）`
          );
        }
        target.conversation.selectApprovalMode(
          options.settings.permissionMode()
        );
        const workspaceAttachments = {
          ...(librarySkillAttachments
            ? { attachedSkills: librarySkillAttachments.attachedSkills }
            : {}),
          ...(libraryAgentContext
            ? { libraryWorkspace: libraryAgentContext }
            : {})
        };
        let rewriteStarted = true;
        if (rewriteRequest) {
          rewriteStarted = await target.conversation.resendMessage(
            rewriteRequest,
            agentDocument,
            liveDocuments,
            workspaceAttachments
          );
        } else {
          await target.conversation.sendMessage(
            agentDocument,
            liveDocuments,
            workspaceAttachments,
            promptAttachments
          );
        }
        if (!rewriteStarted) return;
        if (!sendTargetIsCurrent(target, { includeDraft: false })) return;
        options.edits.schedule(
          (queued) =>
            queued.conversation === target.conversation &&
            queued.sessionId === target.sessionId
        );
      } catch (error: unknown) {
        if (!disposed && sendTargetIsCurrent(target, { includeDraft: false })) {
          options.notifications.error(
            error instanceof Error
              ? error.message
              : "发送消息失败，请稍后重试。"
          );
        }
      }
    })().finally(() => {
      if (activeSend === operation) {
        activeSend = null;
        activeSendConversation = null;
        sendPreflightPending.value = false;
      }
    });
    activeSend = operation;
    activeSendConversation = target.conversation;
    return operation;
  }

  async function drain(): Promise<void> {
    const pending = activeSend;
    if (pending) await pending;
  }

  async function dispose(): Promise<void> {
    if (disposed) return;
    const pending = activeSend;
    const conversation = activeSendConversation;
    disposed = true;
    invalidateSendTarget();
    stopResourceInvalidation();
    stopConversationError();
    if (pending && conversation?.isBusy.value) {
      try {
        await conversation.stopGeneration();
      } catch {
        // Disposal is best-effort; the pending send is still drained below.
      }
    }
    await drain();
  }

  return {
    sendMessage,
    sendPreflightPending,
    invalidateSendTarget,
    disposed: () => disposed,
    dispose,
    drain
  };
}
