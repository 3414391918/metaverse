import { analysisToolEvents } from "./analysis-tool-events";
import { isLibraryAgentToolDetails } from "./library-agent-tools";
import { isLongAgentToolDetails } from "./long-agent-tools";
import { isSubagentAuthoringToolDetails } from "./subagent-authoring-tools";
import type { AgentEvent } from "@earendil-works/pi-agent-core";
import type { AgentRuntimeRef } from "@deepwrite/contracts";
import type { AgentRunInput, AgentRuntimeEvent } from "./runtime-types";
export function toolResultEvents(
  event: Extract<AgentEvent, { type: "tool_execution_end" }>,
  input: AgentRunInput,
  runtime: AgentRuntimeRef
): AgentRuntimeEvent[] {
  const events: AgentRuntimeEvent[] = [];
  const details = (event.result as { details?: unknown } | undefined)?.details;
  const analysisEvents = analysisToolEvents(
    details,
    event.toolCallId,
    input,
    runtime
  );
  if (analysisEvents && !event.isError) {
    events.push(...analysisEvents);
  } else if (
    isLibraryAgentToolDetails(details) &&
    (details.kind === "library-entry-mutation" ||
      details.kind === "library-overview-mutation")
  ) {
    events.push({
      type: "library.editor_mutation",
      runId: input.runId,
      sessionId: input.sessionId,
      payload:
        details.kind === "library-overview-mutation"
          ? {
              toolCallId: event.toolCallId,
              operation: details.operation,
              domain: details.domain,
              libraryId: details.libraryId,
              documentId: details.documentId,
              title: details.title,
              text: details.text,
              baseRevision: details.baseRevision,
              ...(details.baseProjectRevision === undefined
                ? {}
                : { baseProjectRevision: details.baseProjectRevision }),
              summary: details.summary,
              runtime
            }
          : details.operation === "create"
            ? {
                toolCallId: event.toolCallId,
                operation: details.operation,
                ...(details.creationId
                  ? { creationId: details.creationId }
                  : {}),
                domain: details.domain,
                libraryId: details.libraryId,
                stageId: details.stageId,
                title: details.title,
                text: details.text,
                baseRevision: details.baseRevision,
                ...(details.baseProjectRevision === undefined
                  ? {}
                  : { baseProjectRevision: details.baseProjectRevision }),
                summary: details.summary,
                runtime
              }
            : {
                toolCallId: event.toolCallId,
                operation: details.operation,
                domain: details.domain,
                libraryId: details.libraryId,
                entryId: details.entryId,
                documentId: details.documentId,
                stageId: details.stageId,
                title: details.title,
                text: details.text,
                baseRevision: details.baseRevision,
                ...(details.baseProjectRevision === undefined
                  ? {}
                  : { baseProjectRevision: details.baseProjectRevision }),
                summary: details.summary,
                runtime
              }
    });
  } else if (isSubagentAuthoringToolDetails(details)) {
    events.push({
      type: "subagent_authoring.draft_updated",
      runId: input.runId,
      sessionId: input.sessionId,
      payload: {
        toolCallId: event.toolCallId,
        draft: details.draft,
        runtime
      }
    });
  } else if (isLongAgentToolDetails(details)) {
    if (details.kind === "long-mutation-proposal") {
      events.push({
        type: "long.mutation_proposal",
        runId: input.runId,
        sessionId: input.sessionId,
        payload: {
          toolCallId: event.toolCallId,
          bookId: details.bookId,
          agentId: details.agentId,
          batch: details.batch,
          summary: details.summary,
          runtime
        }
      });
    } else if (details.kind === "long-worldbuilding-file-proposal") {
      events.push({
        type: "long.worldbuilding_file_proposal",
        runId: input.runId,
        sessionId: input.sessionId,
        payload: {
          toolCallId: event.toolCallId,
          bookId: details.bookId,
          agentId: details.agentId,
          batch: details.batch,
          summary: details.summary,
          files: details.files,
          runtime
        }
      });
    } else if (details.kind === "long-character-file-proposal") {
      events.push({
        type: "long.character_file_proposal",
        runId: input.runId,
        sessionId: input.sessionId,
        payload: {
          toolCallId: event.toolCallId,
          bookId: details.bookId,
          agentId: details.agentId,
          batch: details.batch,
          summary: details.summary,
          files: details.files,
          runtime
        }
      });
    } else if (details.kind === "long-continuity-file-proposal") {
      events.push({
        type: "long.continuity_file_proposal",
        runId: input.runId,
        sessionId: input.sessionId,
        payload: {
          toolCallId: event.toolCallId,
          bookId: details.bookId,
          agentId: details.agentId,
          batch: details.batch,
          summary: details.summary,
          files: details.files,
          runtime
        }
      });
    } else if (details.kind === "long-chapter-write-proposal") {
      events.push({
        type: "long.chapter_write_proposal",
        runId: input.runId,
        sessionId: input.sessionId,
        payload: {
          toolCallId: event.toolCallId,
          bookId: details.bookId,
          agentId: details.agentId,
          batch: details.batch,
          file: details.file,
          summary: details.summary,
          runtime
        }
      });
    } else if (details.kind === "long-ledger-commit-proposal") {
      events.push({
        type: "long.ledger_commit_proposal",
        runId: input.runId,
        sessionId: input.sessionId,
        payload: {
          toolCallId: event.toolCallId,
          bookId: details.bookId,
          agentId: details.agentId,
          input: details.input,
          summary: details.summary,
          runtime
        }
      });
    }
  }
  return events;
}
