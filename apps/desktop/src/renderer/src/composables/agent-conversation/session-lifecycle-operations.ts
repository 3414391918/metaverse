export interface SessionLifecycleOperations {
  resetTransientConversationState(): void;
  stopStreamingMessages(): void;
  newConversation(): void;
  selectConversation(nextSessionId: string): boolean;
}
