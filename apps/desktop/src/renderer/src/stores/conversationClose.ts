import type { AgentConversationController } from "../composables/useAgentConversation";

/** Flush durable history checkpoints; Harness owns and stops its own active runs. */
export async function flushConversationsBeforeClose(
  controllers: ReadonlyMap<string, AgentConversationController>,
  schedule: (key: string, snapshot: () => unknown) => void,
  flush: () => Promise<void>
): Promise<void> {
  const closing = [...controllers];
  for (const [, controller] of closing) controller.holdPersistenceEmits();
  try {
    for (const [key, controller] of closing) {
      if (
        controller.messages.value.length ||
        controller.draft.value ||
        controller.isBusy.value
      ) {
        schedule(key, controller.capturePersistenceSnapshot);
      }
    }
    await flush();
  } finally {
    for (const [, controller] of closing) controller.releasePersistenceEmits();
  }
}
