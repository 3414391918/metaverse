import {
  ref,
  shallowRef,
  type ComputedRef,
  type Ref,
  type ShallowRef
} from "vue";
import type {
  AgentRuntimeRef,
  AgentTeamRunMode,
  ModelConfig,
  ThinkingLevel
} from "@deepwrite/contracts";
import type {
  AgentApprovalMode,
  ChatMessage,
  ConversationHistoryItem
} from "../../types/conversation";
import { cloneMessage } from "./clone";
import { parseAgentConversationPersistenceSnapshot } from "./persistence-snapshot";
import { id } from "./shared";
import type {
  AgentConversationPersistenceRecord,
  AgentConversationPersistenceSnapshot,
  UseAgentConversationOptions
} from "./types";

import type { AgentConversationOperations } from "./operations";

import {
  createTrackedMessages,
  type TrackedMessages
} from "./message-mutations";

import type { ConversationPersistenceJournal } from "./persistence-journal";

export interface AgentConversationState {
  messageMutations: TrackedMessages;
  options: UseAgentConversationOptions;
  storedEnvelope: AgentConversationPersistenceSnapshot | undefined;
  messages: Ref<ChatMessage[]>;
  draft: Ref<string>;
  sessionId: Ref<string>;
  approvalMode: Ref<AgentApprovalMode>;
  agentTeamMode: Ref<AgentTeamRunMode>;
  webSearchEnabled: Ref<boolean>;
  thinkingLevel: Ref<ThinkingLevel>;
  temperature: Ref<number>;
  configuredModels: Ref<ModelConfig[]>;
  defaultModelId: Ref<string>;
  selectedModelId: Ref<string>;
  runtime: Ref<AgentRuntimeRef | null>;
  conversationError: Ref<string | null>;
  storedConversations: ShallowRef<AgentConversationPersistenceRecord[]>;
  remoteHistoryItems: ShallowRef<ConversationHistoryItem[]>;
  historyOperationPending: Ref<boolean>;
  deferredPersistenceSessions: ShallowRef<ReadonlySet<string>>;
  currentCreatedAt: Ref<string>;
  currentUpdatedAt: Ref<string>;
  submitting: Ref<boolean>;
  activeRunId: Ref<string | null>;
  finishedRunIds: Set<string>;
  runMessageIds: Map<string, string>;
  seenTurnIds: Set<string>;
  seenSubagentTurnIds: Set<string>;
  observedRunByAttempt: Map<number, string>;
  approvalModeByAttempt: Map<number, AgentApprovalMode>;
  approvalModeByRun: Map<string, AgentApprovalMode>;
  sessionsRequiringHistoryReplacement: Set<string>;
  pendingAttemptId: Ref<number | null>;
  hasRunSettingsPreference: boolean;
  modelSettingsApplied: boolean;
  conversationClock: number;
  epoch: number;
  attemptSequence: number;
  persistenceErrorReported: boolean;
  persistenceMutationRevision: number;
  persistenceBatchDepth: number;
  persistenceBatchChanged: boolean;
  applyingPersistenceSnapshot: boolean;
  persistenceNotificationsEnabled: boolean;
  persistenceEmitHold: number;
  persistenceEmitPending: boolean;
}

export type AgentConversationContext = AgentConversationState &
  AgentConversationOperations & {
    persistenceJournal: ConversationPersistenceJournal;
    stopPersistenceWatch(): void;
    history: Readonly<Ref<ConversationHistoryItem[]>>;
    isBusy: ComputedRef<boolean>;
    hasPendingEditReview: ComputedRef<boolean>;
  };

export function createAgentConversationState(
  options: UseAgentConversationOptions
): AgentConversationState {
  const storedEnvelope = parseAgentConversationPersistenceSnapshot(
    options.initialPersistenceSnapshot
  );
  const storedActive = storedEnvelope?.conversations.find(
    (conversation) => conversation.sessionId === storedEnvelope.activeSessionId
  );
  const conversationClock = Math.max(
    Date.now(),
    ...(storedEnvelope?.conversations.map((conversation) =>
      Date.parse(conversation.updatedAt)
    ) ?? [])
  );
  const initialTimestamp = new Date(conversationClock).toISOString();
  const messageMutations = createTrackedMessages(
    (storedActive?.messages ?? options.initialMessages ?? []).map(cloneMessage)
  );
  const messages = messageMutations.messages;
  return {
    options,
    messageMutations,
    storedEnvelope,
    messages,
    draft: ref(storedActive?.draft ?? ""),
    sessionId: ref(storedActive?.sessionId ?? id("session")),
    approvalMode: ref<AgentApprovalMode>(
      storedActive?.approvalMode ?? "request-approval"
    ),
    thinkingLevel: ref<ThinkingLevel>("medium"),
    agentTeamMode: ref<AgentTeamRunMode>("normal"),
    webSearchEnabled: ref(false),
    temperature: ref(storedActive?.temperature ?? 0.7),
    configuredModels: ref<ModelConfig[]>([]),
    defaultModelId: ref(""),
    selectedModelId: ref(""),
    runtime: ref<AgentRuntimeRef | null>(null),
    conversationError: ref<string | null>(null),
    storedConversations: shallowRef<AgentConversationPersistenceRecord[]>(
      (storedEnvelope?.conversations ?? []).map((conversation) => ({
        ...conversation,
        messages: conversation.messages.map(cloneMessage)
      }))
    ),
    remoteHistoryItems: shallowRef<ConversationHistoryItem[]>([]),
    historyOperationPending: ref(false),
    deferredPersistenceSessions: shallowRef<ReadonlySet<string>>(new Set()),
    currentCreatedAt: ref(
      storedActive?.createdAt ??
        messages.value[0]?.createdAt ??
        initialTimestamp
    ),
    currentUpdatedAt: ref(storedActive?.updatedAt ?? initialTimestamp),
    submitting: ref(false),
    activeRunId: ref<string | null>(null),
    finishedRunIds: new Set<string>(),
    runMessageIds: new Map<string, string>(),
    seenTurnIds: new Set<string>(),
    seenSubagentTurnIds: new Set<string>(),
    observedRunByAttempt: new Map<number, string>(),
    approvalModeByAttempt: new Map<number, AgentApprovalMode>(),
    approvalModeByRun: new Map<string, AgentApprovalMode>(),
    sessionsRequiringHistoryReplacement: new Set<string>(),
    pendingAttemptId: ref<number | null>(null),
    hasRunSettingsPreference: false,
    modelSettingsApplied: false,
    conversationClock,
    epoch: 0,
    attemptSequence: 0,
    persistenceErrorReported: false,
    persistenceMutationRevision: 0,
    persistenceBatchDepth: 0,
    persistenceBatchChanged: false,
    applyingPersistenceSnapshot: false,
    persistenceNotificationsEnabled: true,
    persistenceEmitHold: 0,
    persistenceEmitPending: false
  };
}
