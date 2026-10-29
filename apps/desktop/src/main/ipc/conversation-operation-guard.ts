type SessionOperations = { management: boolean };

const sessions = new Map<string, SessionOperations>();

/** Main owns history management exclusivity for a conversation session. */
export function acquireConversationOperation(
  sessionId: string,
  _operation: "management"
): (() => void) | undefined {
  const current = sessions.get(sessionId) ?? { management: false };
  if (current.management) return undefined;
  current.management = true;
  sessions.set(sessionId, current);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    current.management = false;
    if (!current.management) sessions.delete(sessionId);
  };
}
