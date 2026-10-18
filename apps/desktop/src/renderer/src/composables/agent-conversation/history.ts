import type { SessionConversationHistoryMessage } from "@deepwrite/contracts";
import type { ChatMessage } from "../../types/conversation";

const MAX_HISTORY_MESSAGES = 80;
const MAX_HISTORY_MESSAGE_LENGTH = 20_000;
const MAX_HISTORY_CONTENT_LENGTH = 120_000;

/**
 * Build a bounded, model-visible transcript from persisted presentation state.
 * Runtime restores it only when the in-memory agent for this session is absent.
 */
export function buildConversationHistory(
  messages: readonly ChatMessage[]
): SessionConversationHistoryMessage[] {
  const history: SessionConversationHistoryMessage[] = [];
  let contentLength = 0;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message || message.activityOnly || !message.content.trim()) continue;
    if (!Number.isFinite(Date.parse(message.createdAt))) continue;
    if (history.length >= MAX_HISTORY_MESSAGES) break;

    const remaining = MAX_HISTORY_CONTENT_LENGTH - contentLength;
    if (remaining <= 0) break;
    const content = message.content.slice(
      0,
      Math.min(MAX_HISTORY_MESSAGE_LENGTH, remaining)
    );
    if (!content.trim()) continue;

    history.unshift({
      role: message.role,
      content,
      createdAt: message.createdAt
    });
    contentLength += content.length;
  }

  return history;
}
