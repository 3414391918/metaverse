import type {
  LibraryManagementScope,
  AgentEvaluationSnapshot,
  AgentRuntimeRef,
  AgentUsage,
  AgentUsageObservationStatus,
  AgentUserInputSource,
  AgentUserInputQuestion,
  SubagentActivity
} from "@deepwrite/contracts";
export type AgentRuntimeEvent =
  | import("./revision-analysis").RevisionAnalysisRuntimeEvent
  | {
      type: "agent.evaluation_snapshot";
      runId: string;
      sessionId: string;
      payload: {
        messageId: string;
        snapshot: AgentEvaluationSnapshot;
        runtime: AgentRuntimeRef;
      };
    }
  | {
      type: "agent.turn_started";
      runId: string;
      sessionId: string;
      payload: {
        messageId: string;
        turnId: string;
        attempt: number;
        maxAttempts: number;
        runtime: AgentRuntimeRef;
      };
    }
  | {
      type: "agent.retry_scheduled";
      runId: string;
      sessionId: string;
      payload: {
        messageId: string;
        turnId: string;
        failedAttempt: number;
        nextAttempt: number;
        maxAttempts: number;
        delayMs: number;
        retryAt: string;
        reason: string;
        runtime: AgentRuntimeRef;
      };
    }
  | {
      type: "agent.delta";
      runId: string;
      sessionId: string;
      payload: {
        messageId: string;
        delta: string;
        runtime: AgentRuntimeRef;
      };
    }
  | {
      type: "agent.thinking_delta";
      runId: string;
      sessionId: string;
      payload: {
        messageId: string;
        delta: string;
        runtime: AgentRuntimeRef;
      };
    }
  | {
      type: "agent.completed";
      runId: string;
      sessionId: string;
      payload: {
        messageId: string;
        content: string;
        thinking?: string;
        stopReason?: string;
        usage?: AgentUsage;
        runtime: AgentRuntimeRef;
      };
    }
  /**
   * Internal accounting signal emitted once for every provider-returned
   * assistant message. Unlike `agent.completed`, this also includes tool-call
   * turns and retryable error attempts.
   */
  | {
      type: "agent.usage_observed";
      runId: string;
      sessionId: string;
      payload: {
        observationId: string;
        observedAt: string;
        messageId: string;
        turnId: string;
        attempt: number;
        status: AgentUsageObservationStatus;
        hadToolCall: boolean;
        usage: AgentUsage;
        runtime: AgentRuntimeRef;
        parentToolCallId?: string;
        subagentRunId?: string;
        subagentId?: string;
      };
    }
  | {
      type: "agent.tool_stream";
      runId: string;
      sessionId: string;
      payload: {
        streamId: string;
        toolCallId?: string;
        toolName?: string;
        phase: "start" | "delta" | "end";
        argumentsDelta: string;
        /**
         * Provider-side cumulative argument text. This stays inside the runtime
         * adapter and is reduced to argumentsDelta before crossing IPC.
         */
        argumentsSnapshot?: string;
        args?: unknown;
        runtime: AgentRuntimeRef;
      };
    }
  | {
      type: "agent.tool_requested";
      runId: string;
      sessionId: string;
      payload: {
        toolCallId: string;
        toolName: string;
        args: unknown;
        runtime: AgentRuntimeRef;
      };
    }
  | {
      type: "agent.tool_completed";
      runId: string;
      sessionId: string;
      payload: {
        toolCallId: string;
        toolName: string;
        resultSummary: string;
        isError: boolean;
        runtime: AgentRuntimeRef;
      };
    }
  | {
      type: "agent.user_input_requested";
      runId: string;
      sessionId: string;
      payload: {
        requestId: string;
        toolCallId: string;
        source: AgentUserInputSource;
        questions: AgentUserInputQuestion[];
        runtime: AgentRuntimeRef;
      };
    }
  | {
      type: "subagent.started";
      runId: string;
      sessionId: string;
      payload: {
        parentToolCallId: string;
        subagentRunId: string;
        subagentId: string;
        name: string;
        task: string;
        runtime: AgentRuntimeRef;
      };
    }
  | {
      type: "subagent.activity";
      runId: string;
      sessionId: string;
      payload: {
        parentToolCallId: string;
        subagentRunId: string;
        subagentId: string;
        name: string;
        activity: SubagentActivity;
        runtime: AgentRuntimeRef;
      };
    }
  | {
      type: "subagent.completed";
      runId: string;
      sessionId: string;
      payload: {
        parentToolCallId: string;
        subagentRunId: string;
        subagentId: string;
        name: string;
        status: "completed" | "error" | "aborted";
        summary: string;
        errorMessage?: string;
        usage?: AgentUsage;
        runtime: AgentRuntimeRef;
      };
    }
  | {
      type: "long.mutation_proposal";
      runId: string;
      sessionId: string;
      payload: {
        toolCallId: string;
        bookId: string;
        agentId: import("@deepwrite/contracts").LongAgentId;
        batch: import("@deepwrite/contracts").LongWorkspaceOperationBatch;
        summary: string;
        runtime: AgentRuntimeRef;
      };
    }
  | {
      type: "long.worldbuilding_file_proposal";
      runId: string;
      sessionId: string;
      payload: {
        toolCallId: string;
        bookId: string;
        agentId: import("@deepwrite/contracts").LongAgentId;
        batch: import("@deepwrite/contracts").LongWorkspaceOperationBatch;
        summary: string;
        files: import("@deepwrite/contracts").LongWorldbuildingFileChange[];
        runtime: AgentRuntimeRef;
      };
    }
  | {
      type: "long.character_file_proposal";
      runId: string;
      sessionId: string;
      payload: {
        toolCallId: string;
        bookId: string;
        agentId: import("@deepwrite/contracts").LongAgentId;
        batch: import("@deepwrite/contracts").LongWorkspaceOperationBatch;
        summary: string;
        files: import("@deepwrite/contracts").LongCharacterFileChange[];
        runtime: AgentRuntimeRef;
      };
    }
  | {
      type: "long.continuity_file_proposal";
      runId: string;
      sessionId: string;
      payload: {
        toolCallId: string;
        bookId: string;
        agentId: import("@deepwrite/contracts").LongAgentId;
        batch: import("@deepwrite/contracts").LongWorkspaceOperationBatch;
        summary: string;
        files: import("@deepwrite/contracts").LongContinuityFileChange[];
        runtime: AgentRuntimeRef;
      };
    }
  | {
      type: "long.chapter_write_proposal";
      runId: string;
      sessionId: string;
      payload: {
        toolCallId: string;
        bookId: string;
        agentId: import("@deepwrite/contracts").LongAgentId;
        batch: import("@deepwrite/contracts").LongWorkspaceOperationBatch;
        file: import("@deepwrite/contracts").LongChapterBodyChange;
        summary: string;
        runtime: AgentRuntimeRef;
      };
    }
  | {
      type: "long.ledger_commit_proposal";
      runId: string;
      sessionId: string;
      payload: {
        toolCallId: string;
        bookId: string;
        agentId: import("@deepwrite/contracts").LongAgentId;
        input: import("@deepwrite/contracts").LongCommitChapterInput;
        summary: string;
        runtime: AgentRuntimeRef;
      };
    }
  | {
      type: "library.editor_mutation";
      runId: string;
      sessionId: string;
      payload:
        | {
            toolCallId: string;
            operation: "create";
            domain: "material" | "skill";
            libraryId: string;
            managementScope?: LibraryManagementScope;
            creationId?: string;
            stageId: string;
            title: string;
            text: string;
            baseRevision: string;
            baseProjectRevision?: number;
            summary: string;
            runtime: AgentRuntimeRef;
          }
        | {
            toolCallId: string;
            operation: "edit";
            domain: "material" | "skill";
            libraryId: string;
            managementScope?: LibraryManagementScope;
            creationId?: string;
            entryId: string;
            documentId: string;
            stageId: string;
            title: string;
            text: string;
            baseRevision: string;
            baseProjectRevision?: number;
            summary: string;
            runtime: AgentRuntimeRef;
          }
        | {
            toolCallId: string;
            operation: "edit-overview";
            domain: "material" | "skill";
            libraryId: string;
            managementScope?: LibraryManagementScope;
            creationId?: string;
            documentId: string;
            title: string;
            text: string;
            baseRevision: string;
            baseProjectRevision?: number;
            summary: string;
            runtime: AgentRuntimeRef;
          };
    }
  | {
      type: "subagent_authoring.draft_updated";
      runId: string;
      sessionId: string;
      payload: {
        toolCallId: string;
        draft: import("@deepwrite/contracts").SubagentAuthoringDraft;
        runtime: AgentRuntimeRef;
      };
    }
  | {
      type: "agent.error";
      runId: string;
      sessionId: string;
      payload: {
        code: string;
        message: string;
        details?: Record<string, unknown>;
        runtime?: AgentRuntimeRef;
      };
    };
