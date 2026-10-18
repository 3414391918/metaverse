import type { AgentRuntimeEvent } from "./runtime-events";
export type { AgentRuntimeEvent } from "./runtime-events";
import type { LibraryManagementRuntimeContext } from "@deepwrite/contracts";
import type { LibraryManagementCommandExecutor } from "./library-management-runtime";
import type {
  AgentProviderRuntimeConfig,
  AgentRuntimeRef,
  AgentWriteApprovalMode,
  AgentUserInputQuestion,
  AgentUserInputSource,
  SessionUserInputResponsePayload,
  ChatAssistantRuntimeContext,
  LibraryAgentProfile,
  LongAgentProfile,
  SessionConversationHistoryMessage,
  SessionMode,
  ShortAgentSubagentDefinition,
  ThinkingLevel as ConfiguredThinkingLevel,
  UserPromptAttachment,
  WorkspaceRuntimeContext
} from "@deepwrite/contracts";
import type { AgentTurnRetryPolicyOptions } from "./agent-turn-retry";
import type { LongCommandExecutor } from "./long-agent-tools";
import type { MaterialCommandExecutor } from "./material-query-runtime";
import type { AgentToolExecutionHooks } from "./subagent-runtime";
export interface AgentRunInput {
  runId: string;
  sessionId: string;
  prompt: string;
  conversationHistory?: SessionConversationHistoryMessage[];
  conversationHistoryMode?: "replace";
  mode?: SessionMode;
  attachments?: UserPromptAttachment[];
  chatAssistantRuntimeContext?: ChatAssistantRuntimeContext;
  webSearchEnabled?: boolean;
  writeApprovalMode?: AgentWriteApprovalMode;
  autoApproveCrossStageOperations?: boolean;
  thinkingLevel?: ConfiguredThinkingLevel;
  temperature?: number;
  runtimeConfig?: AgentProviderRuntimeConfig;
  longAgentProfile?: LongAgentProfile;
  subagentDefinitions?: ShortAgentSubagentDefinition[];
  subagentRuntimeConfigs?: Readonly<Record<string, AgentProviderRuntimeConfig>>;
  libraryAgentProfile?: LibraryAgentProfile;
  libraryManagement?: LibraryManagementRuntimeContext;
  libraryManagementCommandExecutor?: LibraryManagementCommandExecutor;
  workspaceContext?: WorkspaceRuntimeContext;
  /**
   * Narrow Agent Utility -> Core query bridge for the active long-form book.
   * Proposal tools never use this callback for mutation commands.
   */
  longCommandExecutor?: LongCommandExecutor;
  materialCommandExecutor?: MaterialCommandExecutor;
  signal?: AbortSignal;
}
export interface AgentUserInputRequest {
  toolCallId: string;
  source: AgentUserInputSource;
  questions: AgentUserInputQuestion[];
}
export type AgentUserInputRequester = (
  request: AgentUserInputRequest,
  signal?: AbortSignal
) => Promise<SessionUserInputResponsePayload>;
export interface AgentRuntime {
  describe(): AgentRuntimeRef;
  start(input: AgentRunInput): AsyncIterable<AgentRuntimeEvent>;
}
export interface PiRuntimeAdapterOptions extends AgentToolExecutionHooks {
  idleTimeoutMs?: number;
  subagentTimeoutMs?: number;
  tokensPerSecond?: number;
  systemPrompt?: string;
  evaluationMode?: boolean;
  retryPolicy?: AgentTurnRetryPolicyOptions;
}
