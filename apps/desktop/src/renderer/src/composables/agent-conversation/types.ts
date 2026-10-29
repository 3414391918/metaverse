import type { ConversationPersistenceChanges } from "./persistence-changes";
import { type Ref } from "vue";
import type {
  AgentRuntimeRef,
  AgentTeamRunMode,
  DeepWriteApi,
  ModelConfig,
  ModelSettings,
  SystemEventEnvelope,
  ThinkingLevel
} from "@deepwrite/contracts";
import type {
  AgentApprovalMode,
  AgentEditProposal,
  ChatMessage,
  ConversationHistoryItem
} from "../../types/conversation";

export interface ConversationStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export interface UseAgentConversationOptions {
  api: () => DeepWriteApi | undefined;
  autoApproveCrossStageOperations?: () => boolean;
  initialMessages?: ChatMessage[];
  idleTimeoutMs?: number;
  initialPersistenceSnapshot?: unknown;
  onPersistenceSnapshot?: (
    snapshot: AgentConversationPersistenceSnapshot
  ) => void | Promise<void>;
  /**
   * Hot-path notification for stores that defer snapshot capture until their
   * own debounce expires. When supplied, this takes precedence over the
   * eager snapshot callback above.
   */
  onPersistenceChange?: () => void | Promise<void>;
  flushPersistence?: (options?: { allowDeferred?: boolean }) => Promise<void>;
  loadHistoryRecord?: (
    sessionId: string
  ) => Promise<AgentConversationPersistenceRecord>;
  historyManagement?: {
    delete(sessionId: string): Promise<void>;
    restore(sessionId: string): Promise<AgentConversationPersistenceRecord>;
    listDeleted(): Promise<ConversationHistoryItem[]>;
  };
  onPersistenceRemove?: () => void | Promise<void>;
  /** @deprecated Persistence is now coordinated through structured snapshots. */
  persistenceKey?: string;
  /** @deprecated Persistence is now coordinated through structured snapshots. */
  storage?: ConversationStorage;
  onPersistenceError?: () => void;
  onContextWarning?: (message: string) => void;
}

export interface AgentRunSettings {
  selectedModelId: string;
  thinkingLevel: ThinkingLevel;
  temperature: number;
  approvalMode: AgentApprovalMode;
  agentTeamMode?: AgentTeamRunMode;
  webSearchEnabled?: boolean;
}

export interface AgentConversationPersistenceRecord {
  sessionId: string;
  messages: ChatMessage[];
  draft: string;
  approvalMode: AgentApprovalMode;
  createdAt: string;
  updatedAt: string;
  temperature: number;
}

export interface AgentConversationPersistenceSnapshot {
  version: 1;
  activeSessionId: string;
  conversations: AgentConversationPersistenceRecord[];
}

export interface AgentConversationHistorySnapshot {
  activeSessionId: string;
  items: ConversationHistoryItem[];
  active?: AgentConversationPersistenceRecord;
}

export type SubagentEventEnvelope = Extract<
  SystemEventEnvelope,
  {
    type: "subagent.started" | "subagent.activity" | "subagent.completed";
  }
>;
export type SubagentEventPayload = SubagentEventEnvelope["payload"];
export type SubagentActivityEventEnvelope = Extract<
  SubagentEventEnvelope,
  {
    type: "subagent.activity";
  }
>;

export interface AgentConversationController {
  messages: Ref<ChatMessage[]>;
  draft: Ref<string>;
  sessionId: Ref<string>;
  approvalMode: Ref<AgentApprovalMode>;
  agentTeamMode: Ref<AgentTeamRunMode>;
  thinkingLevel: Ref<ThinkingLevel>;
  temperature: Ref<number>;
  webSearchEnabled: Ref<boolean>;
  configuredModels: Ref<ModelConfig[]>;
  selectedModelId: Ref<string>;
  runtime: Ref<AgentRuntimeRef | null>;
  conversationError: Ref<string | null>;
  history: Readonly<Ref<ConversationHistoryItem[]>>;
  isBusy: Readonly<Ref<boolean>>;
  hasPendingEditReview: Readonly<Ref<boolean>>;
  acceptsRunEvent(sessionId: string, runId: string): boolean;
  approvalModeForRun(
    sessionId: string,
    runId: string
  ): AgentApprovalMode | undefined;
  markToolConflict(runId: string, toolCallId: string, summary: string): void;
  getEditProposal(
    runId: string,
    proposalId: string
  ): AgentEditProposal | undefined;
  listEditProposals(runId: string): AgentEditProposal[];
  upsertEditProposal(
    runId: string,
    proposal: AgentEditProposal
  ): AgentEditProposal;
  updateEditProposal(
    runId: string,
    proposalId: string,
    patch: Partial<AgentEditProposal>
  ): AgentEditProposal | undefined;
  newConversation(): void;
  selectConversation(sessionId: string): boolean;
  openConversation(sessionId: string): Promise<boolean>;
  restorePersistenceHistory(
    snapshot: AgentConversationHistorySnapshot
  ): Promise<boolean>;
  historyManagementAvailable: boolean;
  listDeletedConversations(): Promise<ConversationHistoryItem[]>;
  deleteConversation(sessionId: string): Promise<boolean>;
  restoreConversation(sessionId: string): Promise<boolean>;
  applyModelSettings(settings: ModelSettings): void;
  applyRunSettings(settings: AgentRunSettings): void;
  selectModel(modelId: string): void;
  selectThinkingLevel(level: ThinkingLevel): void;
  selectWebSearchEnabled(enabled: boolean): void;
  selectTemperature(temperature: number): void;
  selectApprovalMode(mode: AgentApprovalMode): void;
  selectAgentTeamMode(mode: AgentTeamRunMode): void;
  capturePersistenceSnapshot(): AgentConversationPersistenceSnapshot;
  capturePersistenceChanges(): ConversationPersistenceChanges;
  acknowledgePersistenceChanges(revision: number): void;
  initializePersistenceBaseline(): boolean;
  restorePersistenceSnapshot(snapshot: unknown): Promise<boolean>;
  holdPersistenceEmits(): void;
  releasePersistenceEmits(): void;
  dispose(options?: { clearPersistence?: boolean }): void;
}
