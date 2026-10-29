import { ChatAssistantRoleplayCommandSchemas } from "./chat-assistant-config-api";
import {
  FishAudioCommandEnvelopeSchema,
  FishAudioProgressEventEnvelopeSchema
} from "./fish-audio";
import { ConversationExportCommandEnvelopeSchemas } from "./conversation-export";
import { AgentTeamsSaveBuiltinsCommandEnvelopeSchema } from "./builtin-subagents";
import { CatalogQueryLibraryManagementCommandEnvelopeSchema } from "./library-management";
import { z } from "zod";
import {
  RevisionAnalysisResultEventSchema,
  type RevisionAnalysisResultEvent
} from "./revision-analysis-events";
import { CatalogQueryMaterialsCommandEnvelopeSchema } from "./material-query";
import {
  ChatAssistantProjectConfigGetCommandEnvelopeSchema,
  ChatAssistantProjectConfigListCommandEnvelopeSchema,
  ChatAssistantProjectConfigResetCommandEnvelopeSchema,
  ChatAssistantProjectConfigSaveCommandEnvelopeSchema
} from "./chat-assistant";
import { EnvelopeBaseSchema, type Envelope } from "./envelope";
import {
  AgentErrorEventEnvelopeSchema,
  AgentEvaluationSnapshotEventEnvelopeSchema,
  AgentMessageCompletedEventEnvelopeSchema,
  AgentMessageDeltaEventEnvelopeSchema,
  AgentUsageObservedEventEnvelopeSchema,
  AgentRetryScheduledEventEnvelopeSchema,
  AgentThinkingDeltaEventEnvelopeSchema,
  AgentTurnStartedEventEnvelopeSchema,
  SubagentActivityEventEnvelopeSchema,
  SubagentCompletedEventEnvelopeSchema,
  SubagentStartedEventEnvelopeSchema,
  AgentToolCompletedEventEnvelopeSchema,
  AgentUserInputRequestedEventEnvelopeSchema,
  AgentToolCallStreamEventEnvelopeSchema,
  AgentToolRequestedEventEnvelopeSchema,
  LongChapterWriteProposalEventEnvelopeSchema,
  LongCharacterFileProposalEventEnvelopeSchema,
  LongContinuityFileProposalEventEnvelopeSchema,
  LongLedgerCommitProposalEventEnvelopeSchema,
  LongMutationProposalEventEnvelopeSchema,
  LongWorldbuildingFileProposalEventEnvelopeSchema,
  SubagentAuthoringDraftUpdatedEventEnvelopeSchema,
  LibraryEditorMutationEventEnvelopeSchema,
  WorkspaceEditorMutationEventEnvelopeSchema,
  WorkspaceStageSelectionEventEnvelopeSchema
} from "./session";
import type {
  AgentErrorEventEnvelope,
  AgentEvaluationSnapshotEventEnvelope,
  AgentMessageCompletedEventEnvelope,
  AgentMessageDeltaEventEnvelope,
  AgentUsageObservedEventEnvelope,
  AgentRetryScheduledEventEnvelope,
  AgentThinkingDeltaEventEnvelope,
  AgentTurnStartedEventEnvelope,
  AgentToolCompletedEventEnvelope,
  AgentUserInputRequestedEventEnvelope,
  AgentToolCallStreamEventEnvelope,
  AgentToolRequestedEventEnvelope,
  SubagentActivityEventEnvelope,
  SubagentCompletedEventEnvelope,
  SubagentStartedEventEnvelope,
  LongChapterWriteProposalEventEnvelope,
  LongCharacterFileProposalEventEnvelope,
  LongContinuityFileProposalEventEnvelope,
  LongLedgerCommitProposalEventEnvelope,
  LongMutationProposalEventEnvelope,
  LongWorldbuildingFileProposalEventEnvelope,
  SubagentAuthoringDraftUpdatedEventEnvelope,
  LibraryEditorMutationEventEnvelope,
  WorkspaceEditorMutationEventEnvelope,
  WorkspaceStageSelectionEventEnvelope
} from "./session";
import {
  AgentTeamsCreateCommandEnvelopeSchema,
  AgentTeamsDeleteCommandEnvelopeSchema,
  AgentTeamsExportPackageCommandEnvelopeSchema,
  AgentTeamsInstallPackageCommandEnvelopeSchema,
  AgentTeamsListCommandEnvelopeSchema,
  AgentTeamsRenameCommandEnvelopeSchema,
  AgentTeamsSetEnabledCommandEnvelopeSchema,
  AgentTeamsSaveCommandEnvelopeSchema
} from "./agent-team-catalog";
import {} from "./workspace";
import { SettingsCommandEnvelopeSchemas } from "./settings-command-schemas";
import {
  CatalogCreateLibraryAtPathCommandEnvelopeSchema,
  CatalogCreateLibraryCommandEnvelopeSchema,
  CatalogUpdateLibraryCommandEnvelopeSchema,
  CatalogCreateLibraryGroupAtPathCommandEnvelopeSchema,
  CatalogCreateLibraryGroupCommandEnvelopeSchema,
  CatalogCreateLibraryEntryCommandEnvelopeSchema,
  CatalogChooseExternalLibraryEntriesCommandEnvelopeSchema,
  CatalogImportLibraryEntriesCommandEnvelopeSchema,
  CatalogDeleteBookCommandEnvelopeSchema,
  CatalogDeleteProjectCommandEnvelopeSchema,
  CatalogDuplicateProjectCommandEnvelopeSchema,
  CatalogImportLegacyLibraryAtPathCommandEnvelopeSchema,
  CatalogImportLegacyLibraryCommandEnvelopeSchema,
  CatalogOpenProjectAtPathCommandEnvelopeSchema,
  CatalogOpenProjectCommandEnvelopeSchema,
  CatalogLoadDraftRecoveryCommandEnvelopeSchema,
  CatalogSaveDraftRecoveryCommandEnvelopeSchema,
  CatalogSaveDocumentCommandEnvelopeSchema,
  CatalogSaveLibraryEntryCommandEnvelopeSchema,
  CatalogRemoveLibraryEntryCommandEnvelopeSchema,
  CatalogMoveLibraryEntryCommandEnvelopeSchema,
  CatalogIndexCommandEnvelopeSchema,
  CatalogReadDocumentCommandEnvelopeSchema,
  CatalogSnapshotCommandEnvelopeSchema,
  CatalogUpdateBookCommandEnvelopeSchema,
  CatalogUpdateLibraryGroupCommandEnvelopeSchema,
  CatalogUnregisterProjectCommandEnvelopeSchema
} from "./catalog";
import { ExportLongManuscriptCommandEnvelopeSchema } from "./long-manuscript-export";
import {
  CatalogReadWritingContextCommandEnvelopeSchema,
  CatalogWriteWritingContextCommandEnvelopeSchema
} from "./writing-context";
import {
  RendererStateCommandEnvelopeSchemas,
  RendererStateFlushRequestedEventEnvelopeSchema
} from "./renderer-state";
import { LongWorkspaceCommandSchemas } from "./long-workspace-commands";
export const IPC_COMMAND_CHANNEL = "deepwrite:command";
export const IPC_EVENT_CHANNEL = "deepwrite:event";
export const UtilityWorkerNameSchema = z.enum(["core"]);
export type UtilityWorkerName = z.infer<typeof UtilityWorkerNameSchema>;
export const UtilityHealthPayloadSchema = z.object({
  name: UtilityWorkerNameSchema,
  status: z.enum(["starting", "ok", "degraded", "stopped"]),
  pid: z.number().int().positive().optional(),
  startedAt: z.string().datetime().optional(),
  lastHeartbeatAt: z.string().datetime().optional(),
  details: z.record(z.string(), z.unknown())
});
export type UtilityHealthPayload = z.infer<typeof UtilityHealthPayloadSchema>;
export const SystemHealthPayloadSchema = z.object({
  status: z.enum(["starting", "ok", "degraded"]),
  checkedAt: z.string().datetime(),
  workers: z.array(UtilityHealthPayloadSchema)
});
export type SystemHealthPayload = z.infer<typeof SystemHealthPayloadSchema>;
export const SystemHealthCommandEnvelopeSchema = EnvelopeBaseSchema.extend({
  type: z.literal("system.health"),
  payload: z.object({})
});
export const CommandEnvelopeSchema = z.discriminatedUnion("type", [
  FishAudioCommandEnvelopeSchema,
  CatalogQueryMaterialsCommandEnvelopeSchema,
  SystemHealthCommandEnvelopeSchema,
  ...RendererStateCommandEnvelopeSchemas,
  ...ConversationExportCommandEnvelopeSchemas,
  CatalogIndexCommandEnvelopeSchema,
  CatalogReadDocumentCommandEnvelopeSchema,
  CatalogReadWritingContextCommandEnvelopeSchema,
  CatalogSnapshotCommandEnvelopeSchema,
  CatalogLoadDraftRecoveryCommandEnvelopeSchema,
  CatalogSaveDraftRecoveryCommandEnvelopeSchema,
  CatalogCreateLibraryCommandEnvelopeSchema,
  CatalogUpdateLibraryCommandEnvelopeSchema,
  CatalogCreateLibraryGroupCommandEnvelopeSchema,
  CatalogOpenProjectCommandEnvelopeSchema,
  CatalogImportLegacyLibraryCommandEnvelopeSchema,
  CatalogCreateLibraryAtPathCommandEnvelopeSchema,
  CatalogCreateLibraryGroupAtPathCommandEnvelopeSchema,
  CatalogOpenProjectAtPathCommandEnvelopeSchema,
  CatalogImportLegacyLibraryAtPathCommandEnvelopeSchema,
  CatalogUpdateBookCommandEnvelopeSchema,
  CatalogUpdateLibraryGroupCommandEnvelopeSchema,
  CatalogDeleteBookCommandEnvelopeSchema,
  CatalogSaveDocumentCommandEnvelopeSchema,
  CatalogSaveLibraryEntryCommandEnvelopeSchema,
  CatalogCreateLibraryEntryCommandEnvelopeSchema,
  CatalogChooseExternalLibraryEntriesCommandEnvelopeSchema,
  CatalogImportLibraryEntriesCommandEnvelopeSchema,
  CatalogRemoveLibraryEntryCommandEnvelopeSchema,
  CatalogMoveLibraryEntryCommandEnvelopeSchema,
  CatalogUnregisterProjectCommandEnvelopeSchema,
  CatalogDeleteProjectCommandEnvelopeSchema,
  CatalogDuplicateProjectCommandEnvelopeSchema,
  CatalogWriteWritingContextCommandEnvelopeSchema,
  ...LongWorkspaceCommandSchemas,
  ...SettingsCommandEnvelopeSchemas,
  AgentTeamsSaveBuiltinsCommandEnvelopeSchema,
  CatalogQueryLibraryManagementCommandEnvelopeSchema,
  AgentTeamsListCommandEnvelopeSchema,
  AgentTeamsCreateCommandEnvelopeSchema,
  AgentTeamsRenameCommandEnvelopeSchema,
  AgentTeamsDeleteCommandEnvelopeSchema,
  AgentTeamsSetEnabledCommandEnvelopeSchema,
  AgentTeamsSaveCommandEnvelopeSchema,
  AgentTeamsExportPackageCommandEnvelopeSchema,
  AgentTeamsInstallPackageCommandEnvelopeSchema,
  ...ChatAssistantRoleplayCommandSchemas,
  ChatAssistantProjectConfigListCommandEnvelopeSchema,
  ChatAssistantProjectConfigGetCommandEnvelopeSchema,
  ChatAssistantProjectConfigSaveCommandEnvelopeSchema,
  ChatAssistantProjectConfigResetCommandEnvelopeSchema,
  ExportLongManuscriptCommandEnvelopeSchema
]);
export type CommandEnvelope = z.infer<typeof CommandEnvelopeSchema>;
export type CommandType = CommandEnvelope["type"];
export const ErrorPayloadSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  details: z.record(z.string(), z.unknown()).optional()
});
export type ErrorPayload = z.infer<typeof ErrorPayloadSchema>;
export const CommandResultSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("accepted"),
    requestId: z.string().min(1),
    payload: z.unknown()
  }),
  z.object({
    status: z.literal("rejected"),
    requestId: z.string().min(1),
    error: ErrorPayloadSchema
  })
]);
export type CommandResult<TPayload = unknown> =
  | {
      status: "accepted";
      requestId: string;
      payload: TPayload;
    }
  | {
      status: "rejected";
      requestId: string;
      error: ErrorPayload;
    };
export const SystemReadyEventEnvelopeSchema = EnvelopeBaseSchema.extend({
  type: z.literal("system.ready"),
  payload: SystemHealthPayloadSchema
});
export const SystemWorkerRestartedEventEnvelopeSchema =
  EnvelopeBaseSchema.extend({
    type: z.literal("system.worker_restarted"),
    payload: z.object({
      worker: UtilityWorkerNameSchema,
      reason: z.string().min(1),
      restartedAt: z.string().datetime()
    })
  });
export const SystemWorkerRestartingEventEnvelopeSchema =
  EnvelopeBaseSchema.extend({
    type: z.literal("system.worker_restarting"),
    payload: z.object({
      worker: UtilityWorkerNameSchema,
      reason: z.string().min(1),
      detectedAt: z.string().datetime()
    })
  });
export const SystemEventEnvelopeSchema = z.discriminatedUnion("type", [
  FishAudioProgressEventEnvelopeSchema,
  RendererStateFlushRequestedEventEnvelopeSchema,
  SystemReadyEventEnvelopeSchema,
  SystemWorkerRestartingEventEnvelopeSchema,
  SystemWorkerRestartedEventEnvelopeSchema,
  AgentEvaluationSnapshotEventEnvelopeSchema,
  AgentTurnStartedEventEnvelopeSchema,
  AgentRetryScheduledEventEnvelopeSchema,
  AgentMessageDeltaEventEnvelopeSchema,
  AgentThinkingDeltaEventEnvelopeSchema,
  AgentMessageCompletedEventEnvelopeSchema,
  AgentUsageObservedEventEnvelopeSchema,
  AgentToolCallStreamEventEnvelopeSchema,
  AgentToolRequestedEventEnvelopeSchema,
  AgentToolCompletedEventEnvelopeSchema,
  AgentUserInputRequestedEventEnvelopeSchema,
  SubagentStartedEventEnvelopeSchema,
  SubagentActivityEventEnvelopeSchema,
  SubagentCompletedEventEnvelopeSchema,
  RevisionAnalysisResultEventSchema,
  SubagentAuthoringDraftUpdatedEventEnvelopeSchema,
  LongMutationProposalEventEnvelopeSchema,
  LongWorldbuildingFileProposalEventEnvelopeSchema,
  LongCharacterFileProposalEventEnvelopeSchema,
  LongContinuityFileProposalEventEnvelopeSchema,
  LongChapterWriteProposalEventEnvelopeSchema,
  LongLedgerCommitProposalEventEnvelopeSchema,
  LibraryEditorMutationEventEnvelopeSchema,
  WorkspaceEditorMutationEventEnvelopeSchema,
  WorkspaceStageSelectionEventEnvelopeSchema,
  AgentErrorEventEnvelopeSchema
]);
export type SystemReadyEventEnvelope = Envelope<
  SystemHealthPayload,
  "system.ready"
>;
export type SystemWorkerRestartedEventEnvelope = Envelope<
  {
    worker: UtilityWorkerName;
    reason: string;
    restartedAt: string;
  },
  "system.worker_restarted"
>;
export type SystemWorkerRestartingEventEnvelope = Envelope<
  {
    worker: UtilityWorkerName;
    reason: string;
    detectedAt: string;
  },
  "system.worker_restarting"
>;
export type SystemEventEnvelope =
  | z.infer<typeof FishAudioProgressEventEnvelopeSchema>
  | RevisionAnalysisResultEvent
  | z.infer<typeof RendererStateFlushRequestedEventEnvelopeSchema>
  | SystemReadyEventEnvelope
  | SystemWorkerRestartingEventEnvelope
  | SystemWorkerRestartedEventEnvelope
  | AgentEvaluationSnapshotEventEnvelope
  | AgentTurnStartedEventEnvelope
  | AgentRetryScheduledEventEnvelope
  | AgentMessageDeltaEventEnvelope
  | AgentThinkingDeltaEventEnvelope
  | AgentMessageCompletedEventEnvelope
  | AgentUsageObservedEventEnvelope
  | AgentToolCallStreamEventEnvelope
  | AgentToolRequestedEventEnvelope
  | AgentToolCompletedEventEnvelope
  | AgentUserInputRequestedEventEnvelope
  | SubagentStartedEventEnvelope
  | SubagentActivityEventEnvelope
  | SubagentCompletedEventEnvelope
  | SubagentAuthoringDraftUpdatedEventEnvelope
  | LongMutationProposalEventEnvelope
  | LongWorldbuildingFileProposalEventEnvelope
  | LongCharacterFileProposalEventEnvelope
  | LongContinuityFileProposalEventEnvelope
  | LongChapterWriteProposalEventEnvelope
  | LongLedgerCommitProposalEventEnvelope
  | LibraryEditorMutationEventEnvelope
  | WorkspaceEditorMutationEventEnvelope
  | WorkspaceStageSelectionEventEnvelope
  | AgentErrorEventEnvelope;
