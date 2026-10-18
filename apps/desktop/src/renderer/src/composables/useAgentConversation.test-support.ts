import { createConversationTestApi } from "./conversationTestApi";
import { afterEach, describe, expect, it, vi } from "vitest";
import { reactive } from "vue";
import {
  DEFAULT_LIBRARY_AGENT_SETTINGS,
  DEFAULT_LONG_AGENT_SETTINGS,
  DEFAULT_LONG_AGENT_TEAM_SETTINGS,
  createDefaultAppearanceSettings,
  createEmptyLongMarkdownFileReference,
  createShortWorkspaceContentRevision,
  createEnvelope,
  longCharacterCoreProfileFileId,
  longCharacterFilePath,
  longWorldbuildingItemContentPath,
  longWorldbuildingItemFileId,
  type DeepWriteApi,
  type ModelSettings,
  type SessionAbortCommandPayload,
  type SessionPromptAcceptedPayload,
  type SessionPromptCommandPayload
} from "@deepwrite/contracts";
import {
  mergeAgentConversationPersistenceSnapshots,
  useAgentConversation,
  type AgentConversationPersistenceRecord,
  type AgentConversationPersistenceSnapshot,
  type UseAgentConversationOptions
} from "./useAgentConversation";
import type { AgentEditProposal } from "../types/conversation";
import type { WorkspaceDocument } from "../types/workspace";

const document: WorkspaceDocument = {
  id: "chapter_3",
  domain: "material",
  libraryId: "material-library",
  catalogEntryId: "chapter_3",
  title: "第三章 雨夜回声",
  eyebrow: "素材库条目",
  path: ["雾港来信", "第三章 雨夜回声"],
  format: "正文",
  content: "雨是在午夜以后落下来的。"
};

const runtime = {
  provider: "deepwrite",
  model: "deepwrite-writing-faux",
  mode: "local-faux" as const
};

function createDeferredApi(): {
  api: DeepWriteApi;
  prompts: SessionPromptCommandPayload[];
  aborts: SessionAbortCommandPayload[];
  resolveAccepted(index: number, payload: SessionPromptAcceptedPayload): void;
  rejectPrompt(index: number, error: Error): void;
  promptCount(): number;
} {
  const pending: Array<{
    resolve(payload: SessionPromptAcceptedPayload): void;
    reject(error: Error): void;
  }> = [];
  const queuedPromptResults = new Map<
    number,
    | { status: "accepted"; payload: SessionPromptAcceptedPayload }
    | { status: "rejected"; error: Error }
  >();
  const prompts: SessionPromptCommandPayload[] = [];
  const aborts: SessionAbortCommandPayload[] = [];
  const api: DeepWriteApi = createConversationTestApi({
    prompt(payload) {
      const index = prompts.length;
      prompts.push(payload);
      return new Promise<SessionPromptAcceptedPayload>((resolve, reject) => {
        pending[index] = { resolve, reject };
        const queued = queuedPromptResults.get(index);
        if (!queued) return;
        queuedPromptResults.delete(index);
        if (queued.status === "accepted") resolve(queued.payload);
        else reject(queued.error);
      });
    },
    async abort(payload) {
      aborts.push(payload);
      return {
        ...payload,
        abortedAt: new Date().toISOString()
      };
    },
    async submitUserInput(payload) {
      return {
        sessionId: payload.sessionId,
        runId: payload.runId,
        requestId: payload.requestId,
        resolvedAt: new Date().toISOString()
      };
    }
  });
  return {
    api,
    prompts,
    aborts,
    resolveAccepted(index, payload) {
      const request = pending[index];
      if (request) request.resolve(payload);
      else queuedPromptResults.set(index, { status: "accepted", payload });
    },
    rejectPrompt(index, error) {
      const request = pending[index];
      if (request) request.reject(error);
      else queuedPromptResults.set(index, { status: "rejected", error });
    },
    promptCount: () => prompts.length
  };
}

function eventOptions(sessionId: string, runId: string, id: string) {
  return {
    id,
    context: { correlationId: "cmd_1", sessionId, runId }
  };
}

function createMemoryStorage(): {
  options(
    key: string
  ): Pick<
    UseAgentConversationOptions,
    | "initialPersistenceSnapshot"
    | "onPersistenceSnapshot"
    | "onPersistenceRemove"
  >;
  getItem(key: string): unknown | null;
  setItem(key: string, value: unknown): void;
  removeItem(key: string): void;
} {
  const values = new Map<string, unknown>();
  return {
    options(key) {
      return {
        initialPersistenceSnapshot: structuredClone(values.get(key)),
        onPersistenceSnapshot(snapshot) {
          values.set(key, structuredClone(snapshot));
        },
        onPersistenceRemove() {
          values.delete(key);
        }
      };
    },
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    }
  };
}

function storedConversation(
  sessionId: string,
  updatedAt: string,
  content: string
): AgentConversationPersistenceRecord {
  return {
    sessionId,
    messages: [
      {
        id: `user-${sessionId}`,
        role: "user",
        content,
        createdAt: updatedAt,
        status: "completed"
      }
    ],
    draft: "",
    approvalMode: "request-approval",
    createdAt: updatedAt,
    updatedAt,
    temperature: 0.7
  };
}

function createEditProposal(
  overrides: Partial<AgentEditProposal> = {}
): AgentEditProposal {
  return {
    id: "proposal_1",
    runId: "run_edit_1",
    workspaceId: "short_story_1",
    stageId: "plot_design",
    documentId: "short_plot_design",
    title: "剧情设计",
    summary: "调整雨夜相遇的因果关系",
    status: "pending",
    baseRevision: "v1:4:11111111",
    proposedRevision: "v1:5:22222222",
    proposedText: "新的剧情文本",
    toolCallIds: ["tool_edit_1"],
    additions: 1,
    deletions: 1,
    hunks: [
      {
        oldStart: 1,
        oldLines: 2,
        newStart: 1,
        newLines: 2,
        lines: [
          { type: "deletion", text: "旧句", oldLineNumber: 1 },
          { type: "addition", text: "新句", newLineNumber: 1 },
          {
            type: "context",
            text: "保留句",
            oldLineNumber: 2,
            newLineNumber: 2
          }
        ]
      }
    ],
    createdAt: "2026-07-19T11:00:00.000Z",
    updatedAt: "2026-07-19T11:00:00.000Z",
    ...overrides
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

export {
  DEFAULT_LIBRARY_AGENT_SETTINGS,
  DEFAULT_LONG_AGENT_SETTINGS,
  DEFAULT_LONG_AGENT_TEAM_SETTINGS,
  afterEach,
  createDefaultAppearanceSettings,
  createDeferredApi,
  createEditProposal,
  createEmptyLongMarkdownFileReference,
  createEnvelope,
  createMemoryStorage,
  createShortWorkspaceContentRevision,
  describe,
  document,
  eventOptions,
  expect,
  it,
  longCharacterCoreProfileFileId,
  longCharacterFilePath,
  longWorldbuildingItemContentPath,
  longWorldbuildingItemFileId,
  mergeAgentConversationPersistenceSnapshots,
  reactive,
  runtime,
  storedConversation,
  useAgentConversation,
  vi
};
export type {
  AgentConversationPersistenceRecord,
  AgentConversationPersistenceSnapshot,
  AgentEditProposal,
  DeepWriteApi,
  ModelSettings,
  SessionAbortCommandPayload,
  SessionPromptAcceptedPayload,
  SessionPromptCommandPayload,
  UseAgentConversationOptions,
  WorkspaceDocument
};
