import { ref, type Ref } from "vue";
import {
  LongMutationProposalEventEnvelopeSchema,
  LongWorkspaceOperationBatchSchema,
  createEnvelope,
  type AgentWriteApprovalMode,
  type LongAgentId,
  type LongContinuityFileChange,
  type LongContinuityFileRole,
  type LongWorkspaceImpactPreview,
  type LongWorkspaceFileReference,
  type LongWorkspaceIndexSnapshot,
  type LongWorkspaceOperationBatch,
  type SystemEventEnvelope
} from "@deepwrite/contracts";
import { longWorkspaceOperationsRequireImpactConfirmation } from "@deepwrite/contracts/renderer";
import { createId } from "@deepwrite/shared";
import type { LongWorkspaceRendererApi } from "../types/longWorkspace";
import { createKeyedSerialTaskQueue } from "../utils/keyedSerialTaskQueue";
import { longWorldbuildingFiles } from "../utils/longWorldbuildingFiles";
import {
  commitLongContinuityFinalization,
  continuityFinalizationKey,
  type LongContinuityFinalizationEvent
} from "./longContinuityFinalization";

export type LongWorkspaceProposalEvent = Extract<
  SystemEventEnvelope,
  {
    type:
      | "long.mutation_proposal"
      | "long.worldbuilding_file_proposal"
      | "long.character_file_proposal"
      | "long.continuity_file_proposal"
      | "long.ledger_commit_proposal";
  }
>;

export type LongMutationProposalEvent = Extract<
  LongWorkspaceProposalEvent,
  { type: "long.mutation_proposal" }
>;

export type LongWorldbuildingFileProposalEvent = Extract<
  LongWorkspaceProposalEvent,
  { type: "long.worldbuilding_file_proposal" }
>;

export type LongCharacterFileProposalEvent = Extract<
  LongWorkspaceProposalEvent,
  { type: "long.character_file_proposal" }
>;

export type LongContinuityFileProposalEvent = Extract<
  LongWorkspaceProposalEvent,
  { type: "long.continuity_file_proposal" }
>;

type LongWorkspaceReviewEvent = LongWorkspaceProposalEvent;

type LongContentFileProposalEvent =
  | LongWorldbuildingFileProposalEvent
  | LongCharacterFileProposalEvent
  | LongContinuityFileProposalEvent;

type LongBatchProposalEvent =
  LongMutationProposalEvent | LongContentFileProposalEvent;

function isContentFileProposal(
  event: LongWorkspaceProposalEvent
): event is LongContentFileProposalEvent {
  return (
    event.type === "long.worldbuilding_file_proposal" ||
    event.type === "long.character_file_proposal" ||
    event.type === "long.continuity_file_proposal"
  );
}

function isBatchProposal(
  event: LongWorkspaceProposalEvent
): event is LongBatchProposalEvent {
  return (
    event.type === "long.mutation_proposal" || isContentFileProposal(event)
  );
}

function isLongImpactMismatch(error: unknown): boolean {
  return (
    error instanceof Error &&
    /impact_mismatch|关联.*变化|影响.*变化/iu.test(error.message)
  );
}

const CONTINUITY_FILE_ROLE_LABELS: Record<LongContinuityFileRole, string> = {
  foreshadowing_changes: "伏笔变化",
  world_reveals: "世界观揭露",
  character_current_state: "人物当前状态",
  character_history: "人物历史轨迹",
  chapter_end_state: "章末状态",
  handoff: "接续包"
};

interface LongContinuityFileTarget {
  chapterCardId: string;
  role: LongContinuityFileRole;
  characterId: string | null;
  file: LongWorkspaceFileReference;
}

function continuityFileTitle(
  index: LongWorkspaceIndexSnapshot,
  target: LongContinuityFileTarget
): string {
  const chapter = index.plot.chapterCards.find(
    ({ id }) => id === target.chapterCardId
  );
  if (!chapter) {
    throw new Error("连续性提案指向了不存在的章卡。");
  }
  const isCharacterRole =
    target.role === "character_current_state" ||
    target.role === "character_history";
  if (isCharacterRole !== (target.characterId !== null)) {
    throw new Error("连续性提案的人物文件身份不完整。");
  }
  let characterName: string | null = null;
  if (target.characterId !== null) {
    const character = index.characters.find(
      ({ id }) => id === target.characterId
    );
    if (!character) {
      throw new Error("连续性提案指向了不存在的人物。");
    }
    characterName = character.name;
  }
  return `${chapter.title} / ${
    characterName ? `${characterName} / ` : ""
  }${CONTINUITY_FILE_ROLE_LABELS[target.role]}`;
}

function continuityFileTargets(
  index: LongWorkspaceIndexSnapshot
): Map<string, LongContinuityFileTarget> {
  const targets = new Map<string, LongContinuityFileTarget>();
  const add = (target: LongContinuityFileTarget): void => {
    if (targets.has(target.file.id)) {
      throw new Error("小说工作区包含重复的连续性文件标识。");
    }
    targets.set(target.file.id, target);
  };
  for (const chapter of index.chapters) {
    add({
      chapterCardId: chapter.chapterCardId,
      role: "chapter_end_state",
      characterId: null,
      file: chapter.characterState
    });
    add({
      chapterCardId: chapter.chapterCardId,
      role: "handoff",
      characterId: null,
      file: chapter.handoff
    });
    add({
      chapterCardId: chapter.chapterCardId,
      role: "foreshadowing_changes",
      characterId: null,
      file: chapter.foreshadowingChanges
    });
    if (chapter.worldReveals) {
      add({
        chapterCardId: chapter.chapterCardId,
        role: "world_reveals",
        characterId: null,
        file: chapter.worldReveals
      });
    }
    for (const continuity of chapter.characterContinuity) {
      add({
        chapterCardId: chapter.chapterCardId,
        role: "character_current_state",
        characterId: continuity.characterId,
        file: continuity.currentState
      });
      add({
        chapterCardId: chapter.chapterCardId,
        role: "character_history",
        characterId: continuity.characterId,
        file: continuity.history
      });
    }
  }
  return targets;
}

function createdContinuityFileTarget(
  event: LongContinuityFileProposalEvent,
  fileId: string
): LongContinuityFileTarget | undefined {
  for (const operation of event.payload.batch.operations) {
    if (
      operation.type === "chapterContinuity.worldReveals.create" &&
      operation.file.id === fileId
    ) {
      return {
        chapterCardId: operation.chapterCardId,
        role: "world_reveals",
        characterId: null,
        file: operation.file
      };
    }
    if (operation.type === "chapterContinuity.character.create") {
      if (operation.currentState.id === fileId) {
        return {
          chapterCardId: operation.chapterCardId,
          role: "character_current_state",
          characterId: operation.characterId,
          file: operation.currentState
        };
      }
      if (operation.history.id === fileId) {
        return {
          chapterCardId: operation.chapterCardId,
          role: "character_history",
          characterId: operation.characterId,
          file: operation.history
        };
      }
    }
  }
  return undefined;
}

function assertContinuityFileMetadata(
  index: LongWorkspaceIndexSnapshot,
  change: LongContinuityFileChange,
  target: LongContinuityFileTarget
): void {
  if (
    change.fileId !== target.file.id ||
    change.filePath !== target.file.path ||
    change.chapterCardId !== target.chapterCardId ||
    change.role !== target.role ||
    change.characterId !== target.characterId ||
    change.title !== continuityFileTitle(index, target)
  ) {
    throw new Error(
      "连续性提案的文件路径、章节、角色或人物与当前工作区不一致。"
    );
  }
}

export type LongWorkspaceProposalStatus =
  "previewing" | "waiting" | "ready" | "submitting" | "error" | "accepted";

export interface LongWorkspaceProposalItem {
  event: LongWorkspaceReviewEvent;
  approvalMode: AgentWriteApprovalMode;
  status: LongWorkspaceProposalStatus;
  preview?: LongWorkspaceImpactPreview;
  effectiveBatch?: LongWorkspaceOperationBatch;
  error?: string;
  errorPhase?: "preview" | "apply";
  errorRetryable?: boolean;
}

interface LongProposalNotifications {
  success(message: string): void;
  warning(message: string): void;
  error(message: string): void;
}

export interface UseLongWorkspaceProposalsOptions {
  api: () => LongWorkspaceRendererApi | undefined;
  acceptsEvent: (event: LongWorkspaceProposalEvent) => boolean;
  approvalModeForEvent?: (
    event: LongWorkspaceProposalEvent
  ) => AgentWriteApprovalMode | undefined;
  prepareAutoApprove?: (
    event: LongWorkspaceProposalEvent
  ) => void | Promise<void>;
  canFinalizeContinuity?: (
    event: Extract<
      LongWorkspaceProposalEvent,
      { type: "long.ledger_commit_proposal" }
    >
  ) => boolean;
  onContinuityFinalizationFailed?: (
    event: Extract<
      LongWorkspaceProposalEvent,
      { type: "long.ledger_commit_proposal" }
    >,
    message: string
  ) => boolean;
  onApplied?: (event: LongWorkspaceProposalEvent) => void | Promise<void>;
  onRejected?: (event: LongWorkspaceProposalEvent) => void;
  notifications: LongProposalNotifications;
}

export interface EnqueueManualLongMutationInput {
  bookId: string;
  agentId?: LongAgentId;
  batch: LongWorkspaceOperationBatch;
  summary: string;
}

export interface LongWorkspaceProposalController {
  queues: Ref<Record<string, LongWorkspaceProposalItem[]>>;
  itemsForBook(bookId: string | null | undefined): LongWorkspaceProposalItem[];
  activateBook(bookId: string): void;
  discardBook(bookId: string): void;
  quarantineSession(bookId: string, sessionId: string): void;
  handleEvent(event: SystemEventEnvelope): Promise<boolean>;
  enqueueManualMutation(
    input: EnqueueManualLongMutationInput
  ): Promise<LongMutationProposalEvent>;
  retryPreview(bookId: string, eventId: string): Promise<void>;
  approve(bookId: string, eventId: string): Promise<void>;
  reject(bookId: string, eventId: string): boolean;
}

const LONG_PROPOSAL_TYPES = new Set<SystemEventEnvelope["type"]>([
  "long.mutation_proposal",
  "long.worldbuilding_file_proposal",
  "long.character_file_proposal",
  "long.continuity_file_proposal",
  "long.ledger_commit_proposal"
]);

function isLongProposalEvent(
  event: SystemEventEnvelope
): event is LongWorkspaceProposalEvent {
  return LONG_PROPOSAL_TYPES.has(event.type);
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function isRetryableLongProposalError(error: unknown): boolean {
  const message = errorMessage(error, "");
  if (
    message.startsWith("long.operation.") ||
    message.includes("v4 连续性账本的文件清单与章节索引不一致") ||
    message.includes("自动按当前文件覆盖旧 v4 连续性账本失败")
  ) {
    return false;
  }
  return true;
}

function ipcSafeJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function useLongWorkspaceProposals(
  options: UseLongWorkspaceProposalsOptions
): LongWorkspaceProposalController {
  const queues = ref<Record<string, LongWorkspaceProposalItem[]>>({});
  const handledEventIds = new Set<string>();
  const handledProposalKeys = new Set<string>();
  const discardedBookIds = new Set<string>();
  const quarantinedSessions = new Set<string>();
  const proposalApprovalQueue = createKeyedSerialTaskQueue<string>();
  const pendingContinuityFinalizations = new Map<
    string,
    LongContinuityFinalizationEvent
  >();
  const continuityFinalizationsInFlight = new Set<string>();

  function sessionKey(bookId: string, sessionId: string): string {
    return `${bookId}\u0000${sessionId}`;
  }

  function proposalKey(event: LongWorkspaceProposalEvent): string {
    return [
      event.type,
      event.payload.bookId,
      event.payload.sessionId,
      event.payload.runId,
      event.payload.toolCallId
    ].join("\u0000");
  }

  function clearContinuityFinalizations(
    matches: (
      event: Extract<
        LongWorkspaceProposalEvent,
        { type: "long.ledger_commit_proposal" }
      >
    ) => boolean
  ): void {
    for (const [key, event] of pendingContinuityFinalizations) {
      if (matches(event)) pendingContinuityFinalizations.delete(key);
    }
  }

  function itemsForBook(
    bookId: string | null | undefined
  ): LongWorkspaceProposalItem[] {
    return bookId ? (queues.value[bookId] ?? []) : [];
  }

  function setBookItems(
    bookId: string,
    items: LongWorkspaceProposalItem[]
  ): void {
    const pending = items.filter(({ status }) => status !== "accepted");
    const accepted = items
      .filter(({ status }) => status === "accepted")
      .slice(-100);
    const retained = [...pending, ...accepted].sort((left, right) =>
      left.event.timestamp.localeCompare(right.event.timestamp)
    );
    const next = { ...queues.value };
    if (retained.length) {
      next[bookId] = retained;
    } else {
      delete next[bookId];
    }
    queues.value = next;
  }

  function activateBook(bookId: string): void {
    discardedBookIds.delete(bookId);
  }

  function discardBook(bookId: string): void {
    discardedBookIds.add(bookId);
    clearContinuityFinalizations((event) => event.payload.bookId === bookId);
    setBookItems(bookId, []);
  }

  function quarantineSession(bookId: string, sessionId: string): void {
    quarantinedSessions.add(sessionKey(bookId, sessionId));
    clearContinuityFinalizations(
      (event) =>
        event.payload.bookId === bookId && event.payload.sessionId === sessionId
    );
    while (quarantinedSessions.size > 2_000) {
      const oldest = quarantinedSessions.values().next().value as
        string | undefined;
      if (!oldest) break;
      quarantinedSessions.delete(oldest);
    }
    setBookItems(
      bookId,
      itemsForBook(bookId).filter(
        (item) => item.event.payload.sessionId !== sessionId
      )
    );
  }

  function updateItem(
    bookId: string,
    eventId: string,
    patch: Partial<Omit<LongWorkspaceProposalItem, "event">> & {
      clearError?: boolean;
      clearPreview?: boolean;
    }
  ): void {
    setBookItems(
      bookId,
      itemsForBook(bookId).map((item) => {
        if (item.event.id !== eventId) return item;
        const { clearError, clearPreview, ...values } = patch;
        const next = { ...item, ...values };
        if (clearError) {
          delete next.error;
          delete next.errorPhase;
          delete next.errorRetryable;
        }
        if (clearPreview) {
          delete next.preview;
          delete next.effectiveBatch;
        }
        return next;
      })
    );
  }

  function removeItem(bookId: string, eventId: string): void {
    setBookItems(
      bookId,
      itemsForBook(bookId).filter((item) => item.event.id !== eventId)
    );
  }

  function currentItem(
    bookId: string,
    eventId: string
  ): LongWorkspaceProposalItem | undefined {
    return itemsForBook(bookId).find((item) => item.event.id === eventId);
  }

  function pendingBatchPredecessor(
    item: LongWorkspaceProposalItem
  ): LongWorkspaceProposalItem | undefined {
    const items = itemsForBook(item.event.payload.bookId);
    const currentIndex = items.findIndex(
      ({ event }) => event.id === item.event.id
    );
    if (currentIndex < 0) return undefined;
    return items
      .slice(0, currentIndex)
      .reverse()
      .find(
        (candidate) =>
          isBatchProposal(candidate.event) &&
          candidate.event.payload.sessionId === item.event.payload.sessionId &&
          candidate.event.payload.runId === item.event.payload.runId &&
          candidate.status !== "accepted" &&
          candidate.status !== "error"
      );
  }

  async function previewMutation(
    item: LongWorkspaceProposalItem
  ): Promise<void> {
    if (
      item.event.type !== "long.mutation_proposal" &&
      !isContentFileProposal(item.event)
    )
      return;
    const { event } = item;
    const api = options.api();
    if (!api) {
      updateItem(event.payload.bookId, event.id, {
        status: "error",
        error: "当前环境未连接小说工作区。",
        errorPhase: "preview",
        errorRetryable: true,
        clearPreview: true
      });
      return;
    }
    updateItem(event.payload.bookId, event.id, {
      status: "previewing",
      clearError: true,
      clearPreview: true
    });
    try {
      const batchPredecessor = pendingBatchPredecessor(item);
      if (batchPredecessor) {
        updateItem(event.payload.bookId, event.id, {
          status: "waiting",
          clearError: true
        });
        return;
      }
      let effectiveBatch = event.payload.batch;
      if (isContentFileProposal(event)) {
        const latest = await api.getWorkspaceIndex({
          bookId: event.payload.bookId
        });
        if (
          latest.bookId !== event.payload.bookId ||
          latest.workspaceIndex.bookId !== event.payload.bookId
        ) {
          throw new Error("小说工作区索引返回了错误的项目。");
        }
        const continuityTargets =
          event.type === "long.continuity_file_proposal"
            ? continuityFileTargets(latest.workspaceIndex)
            : null;
        const characterFiles = [
          ...(latest.workspaceIndex.characterOverview
            ? [latest.workspaceIndex.characterOverview]
            : []),
          ...latest.workspaceIndex.characterFiles.flatMap((entry) => [
            entry.coreProfile,
            entry.relationships
          ])
        ];
        const currentFiles = new Map<string, LongWorkspaceFileReference>(
          event.type === "long.worldbuilding_file_proposal"
            ? longWorldbuildingFiles(latest.workspaceIndex.worldbuilding).map(
                (file) => [file.id, file] as const
              )
            : event.type === "long.character_file_proposal"
              ? characterFiles.map((file) => [file.id, file] as const)
              : [...continuityTargets!.values()].map(
                  ({ file }) => [file.id, file] as const
                )
        );
        for (const file of event.payload.files) {
          const current = currentFiles.get(file.fileId);
          if (event.type === "long.continuity_file_proposal") {
            const currentTarget = continuityTargets!.get(file.fileId);
            if (file.operation === "create") {
              if (current || currentTarget) {
                throw new Error(
                  `目标连续性文件已存在，无法重复创建：${file.fileId}`
                );
              }
              const createdTarget = createdContinuityFileTarget(
                event,
                file.fileId
              );
              if (!createdTarget || file.beforeText !== "") {
                throw new Error("连续性文件创建提案的身份或初始内容不一致。");
              }
              assertContinuityFileMetadata(
                latest.workspaceIndex,
                file as LongContinuityFileChange,
                createdTarget
              );
              continue;
            }
            if (!current || !currentTarget) {
              throw new Error(`目标连续性文件已经不存在：${file.fileId}`);
            }
            assertContinuityFileMetadata(
              latest.workspaceIndex,
              file as LongContinuityFileChange,
              currentTarget
            );
            continue;
          }
          if (file.operation === "create") {
            if (current) {
              throw new Error(`目标文件已存在，无法重复创建：${file.filePath}`);
            }
          } else if (!current) {
            throw new Error(`目标文件已经不存在：${file.filePath}`);
          }
        }
        const nextOrderByCategory = new Map<string, number>();
        const nextOrderByCharacterGroup = new Map<string, number>();
        effectiveBatch = {
          ...event.payload.batch,
          operations: event.payload.batch.operations.map((operation) => {
            if (operation.type === "worldbuildingItem.create") {
              const category = latest.workspaceIndex.worldbuilding.find(
                ({ id }) => id === operation.categoryId
              );
              if (!category || category.format !== "list") {
                throw new Error("世界观条目的目标分类已不存在或不再是列表型。");
              }
              const nextOrder =
                (nextOrderByCategory.get(category.id) ??
                  category.items.length) + 1;
              nextOrderByCategory.set(category.id, nextOrder);
              return {
                ...operation,
                item: { ...operation.item, order: nextOrder }
              };
            }
            if (operation.type === "character.create") {
              const group = operation.character.group;
              const currentCount = latest.workspaceIndex.characters.filter(
                (character) => character.group === group
              ).length;
              const nextOrder =
                (nextOrderByCharacterGroup.get(group) ?? currentCount) + 1;
              nextOrderByCharacterGroup.set(group, nextOrder);
              return {
                ...operation,
                character: { ...operation.character, order: nextOrder }
              };
            }
            return operation;
          })
        };
      }
      const result = await api.previewOperations(
        ipcSafeJson({
          bookId: event.payload.bookId,
          batch: LongWorkspaceOperationBatchSchema.parse(effectiveBatch)
        })
      );
      if (result.bookId !== event.payload.bookId) {
        throw new Error("结构影响预览返回了错误的小说项目。");
      }
      if (!currentItem(event.payload.bookId, event.id)) return;
      updateItem(event.payload.bookId, event.id, {
        status: "ready",
        preview: result.preview,
        effectiveBatch,
        clearError: true
      });
    } catch (error: unknown) {
      if (!currentItem(event.payload.bookId, event.id)) return;
      updateItem(event.payload.bookId, event.id, {
        status: "error",
        error: errorMessage(error, "预览小说结构影响失败。"),
        errorPhase: "preview",
        errorRetryable: isRetryableLongProposalError(error),
        clearPreview: true
      });
    }
  }

  function rememberEvent(event: LongWorkspaceProposalEvent): boolean {
    const semanticKey = proposalKey(event);
    if (handledEventIds.has(event.id) || handledProposalKeys.has(semanticKey)) {
      return false;
    }
    handledEventIds.add(event.id);
    handledProposalKeys.add(semanticKey);
    while (handledEventIds.size > 2_000) {
      const oldest = handledEventIds.values().next().value as
        string | undefined;
      if (!oldest) break;
      handledEventIds.delete(oldest);
    }
    while (handledProposalKeys.size > 2_000) {
      const oldest = handledProposalKeys.values().next().value as
        string | undefined;
      if (!oldest) break;
      handledProposalKeys.delete(oldest);
    }
    return true;
  }

  function continuityFinalizationHasPendingChanges(
    event: Extract<
      LongWorkspaceProposalEvent,
      { type: "long.ledger_commit_proposal" }
    >
  ): boolean {
    return itemsForBook(event.payload.bookId).some(
      (item) =>
        item.event.payload.sessionId === event.payload.sessionId &&
        item.event.payload.runId === event.payload.runId &&
        item.event.type === "long.continuity_file_proposal" &&
        item.status !== "accepted"
    );
  }

  async function attemptContinuityFinalizations(bookId: string): Promise<void> {
    for (const [key, event] of pendingContinuityFinalizations) {
      if (
        event.payload.bookId !== bookId ||
        continuityFinalizationsInFlight.has(key)
      ) {
        continue;
      }
      if (continuityFinalizationHasPendingChanges(event)) {
        updateItem(bookId, event.id, {
          status: "waiting",
          clearError: true
        });
        continue;
      }
      if (options.canFinalizeContinuity?.(event) === false) {
        pendingContinuityFinalizations.delete(key);
        removeItem(bookId, event.id);
        continue;
      }
      continuityFinalizationsInFlight.add(key);
      updateItem(bookId, event.id, {
        status: "submitting",
        clearError: true
      });
      try {
        const api = options.api();
        if (!api) throw new Error("当前环境未连接小说工作区。");
        await commitLongContinuityFinalization(api, event);
      } catch (error: unknown) {
        const message = errorMessage(error, "连续性文件归档失败。");
        updateItem(bookId, event.id, {
          status: "error",
          error: message,
          errorPhase: "apply",
          errorRetryable: isRetryableLongProposalError(error)
        });
        if (!options.onContinuityFinalizationFailed?.(event, message)) {
          options.notifications.error(message);
        }
        continue;
      } finally {
        continuityFinalizationsInFlight.delete(key);
      }
      pendingContinuityFinalizations.delete(key);
      updateItem(bookId, event.id, {
        status: "accepted",
        clearError: true
      });
      options.notifications.success("本章连续性文件已完成归档。");
      try {
        await options.onApplied?.(event);
      } catch (error: unknown) {
        options.notifications.warning(
          `连续性文件已经归档，但后续刷新失败：${errorMessage(error, "请手动刷新小说工作区。")}`
        );
      }
    }
  }

  async function processAutomaticProposal(
    event: LongWorkspaceReviewEvent,
    previewFirst: boolean
  ): Promise<void> {
    await proposalApprovalQueue.enqueue(event.payload.bookId, async () => {
      let current = currentItem(event.payload.bookId, event.id);
      if (!current) return;
      let prepared = false;
      if (previewFirst && isContentFileProposal(current.event)) {
        try {
          await options.prepareAutoApprove?.(event);
          prepared = true;
        } catch (error: unknown) {
          const message = errorMessage(
            error,
            "小说文件实时自动保存前检查失败。"
          );
          updateItem(event.payload.bookId, event.id, {
            status: "error",
            error: message,
            clearPreview: true
          });
          options.notifications.error(message);
          return;
        }
      }
      if (
        previewFirst &&
        (current.event.type === "long.mutation_proposal" ||
          isContentFileProposal(current.event))
      ) {
        await previewMutation(current);
        current = currentItem(event.payload.bookId, event.id);
      }
      if (!current || current.status !== "ready") return;
      if (
        isBatchProposal(current.event) &&
        current.preview &&
        longWorkspaceOperationsRequireImpactConfirmation(
          (current.effectiveBatch ?? current.event.payload.batch).operations,
          current.preview.confirmation
        )
      ) {
        updateItem(event.payload.bookId, event.id, {
          approvalMode: "request-approval",
          status: "ready",
          clearError: true
        });
        options.notifications.warning(
          "该提案包含删除或解除关联影响，请核对后手动确认。"
        );
        return;
      }
      if (!prepared) {
        try {
          await options.prepareAutoApprove?.(event);
        } catch (error: unknown) {
          const message = errorMessage(
            error,
            "小说提案实时自动保存前检查失败。"
          );
          updateItem(event.payload.bookId, event.id, {
            status: "error",
            error: message,
            clearPreview: true
          });
          options.notifications.error(message);
          return;
        }
      }
      await approveCurrent(event.payload.bookId, event.id);
    });
  }

  async function enqueueProposalEvent(
    event: LongWorkspaceReviewEvent,
    approvalMode: AgentWriteApprovalMode = options.approvalModeForEvent?.(
      event
    ) ?? "request-approval"
  ): Promise<boolean> {
    if (!rememberEvent(event)) {
      return false;
    }

    const item: LongWorkspaceProposalItem = {
      event,
      approvalMode,
      status:
        event.type === "long.mutation_proposal" || isContentFileProposal(event)
          ? "previewing"
          : "ready"
    };
    setBookItems(event.payload.bookId, [
      ...itemsForBook(event.payload.bookId),
      item
    ]);
    if (approvalMode === "auto-approve") {
      await processAutomaticProposal(event, true);
    } else if (
      event.type === "long.mutation_proposal" ||
      isContentFileProposal(event)
    ) {
      await previewMutation(item);
    }
    return true;
  }

  async function handleEvent(event: SystemEventEnvelope): Promise<boolean> {
    if (
      !isLongProposalEvent(event) ||
      discardedBookIds.has(event.payload.bookId) ||
      quarantinedSessions.has(
        sessionKey(event.payload.bookId, event.payload.sessionId)
      ) ||
      handledEventIds.has(event.id) ||
      handledProposalKeys.has(proposalKey(event)) ||
      !options.acceptsEvent(event)
    ) {
      return false;
    }
    if (event.type === "long.ledger_commit_proposal") {
      if (!rememberEvent(event)) return false;
      const finalizationKey = continuityFinalizationKey(event);
      pendingContinuityFinalizations.set(finalizationKey, event);
      const retainedItems = itemsForBook(event.payload.bookId).filter(
        (item) =>
          item.status === "accepted" ||
          item.event.type !== "long.ledger_commit_proposal" ||
          continuityFinalizationKey(item.event) !== finalizationKey
      );
      setBookItems(event.payload.bookId, [
        ...retainedItems,
        {
          event,
          approvalMode: "auto-approve",
          status: "waiting"
        }
      ]);
      await proposalApprovalQueue.enqueue(event.payload.bookId, () =>
        attemptContinuityFinalizations(event.payload.bookId)
      );
      return true;
    }
    return enqueueProposalEvent(event);
  }

  function createUniqueManualEventId(): string {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const eventId = createId("long_manual_mutation");
      if (!handledEventIds.has(eventId)) {
        return eventId;
      }
    }
    throw new Error("无法为手工小说结构提案生成唯一事件 ID。");
  }

  async function enqueueManualMutation(
    input: EnqueueManualLongMutationInput
  ): Promise<LongMutationProposalEvent> {
    const eventId = createUniqueManualEventId();
    const sessionId = createId("long_manual_session");
    const runId = createId("long_manual_run");
    const event = LongMutationProposalEventEnvelopeSchema.parse(
      createEnvelope(
        "long.mutation_proposal",
        {
          sessionId,
          runId,
          toolCallId: createId("long_manual_tool"),
          bookId: input.bookId,
          agentId: input.agentId ?? "long",
          summary: input.summary,
          runtime: {
            provider: "deepwrite",
            model: "manual-structure-manager",
            mode: "local-faux"
          },
          batch: input.batch
        },
        {
          id: eventId,
          context: {
            sessionId,
            runId,
            resourceId: input.bookId
          }
        }
      )
    );
    activateBook(input.bookId);
    if (!(await enqueueProposalEvent(event, "request-approval"))) {
      throw new Error("手工小说结构提案事件 ID 冲突，请重试。");
    }
    return event;
  }

  async function retryPreview(bookId: string, eventId: string): Promise<void> {
    const item = currentItem(bookId, eventId);
    if (!item || item.status === "previewing" || item.status === "submitting") {
      return;
    }
    if (item.event.type === "long.ledger_commit_proposal") {
      await proposalApprovalQueue.enqueue(bookId, () =>
        attemptContinuityFinalizations(bookId)
      );
      return;
    }
    if (
      item.approvalMode === "auto-approve" &&
      (item.event.type === "long.mutation_proposal" ||
        isContentFileProposal(item.event))
    ) {
      await processAutomaticProposal(item.event, true);
      return;
    }
    await previewMutation(item);
    const current = currentItem(bookId, eventId);
    if (
      current?.approvalMode === "auto-approve" &&
      current.status === "ready"
    ) {
      await processAutomaticProposal(current.event, false);
    }
  }

  async function approveCurrent(
    bookId: string,
    eventId: string
  ): Promise<void> {
    const item = currentItem(bookId, eventId);
    const api = options.api();
    if (!item || !api || item.status === "submitting") {
      if (!api) {
        options.notifications.warning("当前环境未连接小说工作区。");
      }
      return;
    }
    if (item.event.type === "long.ledger_commit_proposal") {
      await attemptContinuityFinalizations(bookId);
      return;
    }
    if (
      (item.event.type === "long.mutation_proposal" ||
        isContentFileProposal(item.event)) &&
      (item.status !== "ready" || !item.preview)
    ) {
      await previewMutation(item);
      const refreshed = currentItem(bookId, eventId);
      if (refreshed?.status === "ready" && refreshed.preview) {
        updateItem(bookId, eventId, {
          approvalMode: "request-approval",
          status: "ready",
          clearError: true
        });
        options.notifications.warning(
          "关联影响已完成核对，请查看最新影响后再次确认。"
        );
      }
      return;
    }
    const mutationPreview =
      item.event.type === "long.mutation_proposal" ||
      isContentFileProposal(item.event)
        ? item.preview
        : undefined;
    if (
      item.event.type !== "long.mutation_proposal" &&
      !isContentFileProposal(item.event) &&
      item.status !== "ready" &&
      item.status !== "error"
    ) {
      return;
    }

    updateItem(bookId, eventId, {
      status: "submitting",
      clearError: true
    });
    try {
      if (
        item.event.type === "long.mutation_proposal" ||
        isContentFileProposal(item.event)
      ) {
        const effectiveBatch = item.effectiveBatch ?? item.event.payload.batch;
        await api.applyOperations(
          ipcSafeJson({
            bookId,
            batch: LongWorkspaceOperationBatchSchema.parse({
              ...effectiveBatch,
              expectedImpact: mutationPreview!.confirmation
            })
          })
        );
      } else {
        throw new Error(
          "章节正文必须通过会话 diff 审批卡保存，不能进入旧小说提案队列。"
        );
      }
    } catch (error: unknown) {
      if (
        (item.event.type === "long.mutation_proposal" ||
          isContentFileProposal(item.event)) &&
        isLongImpactMismatch(error)
      ) {
        await previewMutation(item);
        const refreshed = currentItem(bookId, eventId);
        if (refreshed?.status === "ready" && refreshed.preview) {
          updateItem(bookId, eventId, {
            approvalMode: "request-approval",
            status: "ready",
            clearError: true
          });
          options.notifications.warning(
            "关联关系或删除影响已变化，请查看最新影响后再次确认。"
          );
        }
        return;
      }
      updateItem(bookId, eventId, {
        status: "error",
        error: errorMessage(error, "处理小说提案失败。"),
        errorPhase: "apply",
        errorRetryable: isRetryableLongProposalError(error),
        clearPreview: true
      });
      options.notifications.error(errorMessage(error, "处理小说提案失败。"));
      return;
    }

    if (
      item.event.type === "long.mutation_proposal" ||
      isContentFileProposal(item.event)
    ) {
      updateItem(bookId, eventId, {
        status: "accepted",
        clearError: true
      });
    } else {
      removeItem(bookId, eventId);
    }
    options.notifications.success(
      item.event.type === "long.mutation_proposal"
        ? "小说结构提案已应用。"
        : item.event.type === "long.worldbuilding_file_proposal"
          ? "世界观文件变更已保存到本地 Markdown。"
          : item.event.type === "long.character_file_proposal"
            ? "人物文件变更已保存到本地 Markdown。"
            : "本章连续性记录已保存到本地 Markdown。"
    );
    try {
      await options.onApplied?.(item.event);
    } catch (error: unknown) {
      options.notifications.warning(
        `小说提案已经写入，但后续刷新失败：${errorMessage(error, "请手动刷新小说工作区。")}`
      );
    }
    if (isBatchProposal(item.event)) {
      for (const waiting of itemsForBook(bookId).filter(
        (candidate) =>
          candidate.status === "waiting" && isBatchProposal(candidate.event)
      )) {
        if (waiting.approvalMode === "auto-approve") {
          queueMicrotask(() => {
            void processAutomaticProposal(waiting.event, true);
          });
        } else {
          await previewMutation(waiting);
        }
      }
    }
    await attemptContinuityFinalizations(bookId);
  }

  async function approve(bookId: string, eventId: string): Promise<void> {
    await proposalApprovalQueue.enqueue(bookId, async () => {
      await approveCurrent(bookId, eventId);
    });
  }

  function reject(bookId: string, eventId: string): boolean {
    const item = currentItem(bookId, eventId);
    if (!item || item.status === "submitting" || item.status === "accepted")
      return false;
    if (item.event.type === "long.ledger_commit_proposal") {
      pendingContinuityFinalizations.delete(
        continuityFinalizationKey(item.event)
      );
    }
    if (isContentFileProposal(item.event)) {
      const canceledFinalizations = [
        ...pendingContinuityFinalizations.values()
      ].filter(
        (event) =>
          event.payload.bookId === bookId &&
          event.payload.sessionId === item.event.payload.sessionId
      );
      clearContinuityFinalizations(
        (event) =>
          event.payload.bookId === bookId &&
          event.payload.sessionId === item.event.payload.sessionId
      );
      for (const finalization of canceledFinalizations) {
        updateItem(bookId, finalization.id, {
          status: "error",
          error: "前序连续性文件提案已被拒绝，本章账本未归档。",
          errorPhase: "apply",
          errorRetryable: false
        });
      }
    }
    options.onRejected?.(item.event);
    removeItem(bookId, eventId);
    if (isBatchProposal(item.event)) {
      for (const waiting of itemsForBook(bookId).filter(
        (candidate) =>
          candidate.status === "waiting" && isBatchProposal(candidate.event)
      )) {
        queueMicrotask(() => {
          if (waiting.approvalMode === "auto-approve") {
            void processAutomaticProposal(waiting.event, true);
          } else {
            void previewMutation(waiting);
          }
        });
      }
    }
    return true;
  }

  return {
    queues,
    itemsForBook,
    activateBook,
    discardBook,
    quarantineSession,
    handleEvent,
    enqueueManualMutation,
    retryPreview,
    approve,
    reject
  };
}
