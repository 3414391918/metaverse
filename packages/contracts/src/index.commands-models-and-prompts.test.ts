import {
  AgentMessageCompletedEventEnvelopeSchema,
  AgentMessageDeltaEventEnvelopeSchema,
  CommandEnvelopeSchema,
  PROMPT_IMAGE_ATTACHMENT_MAX_BYTES,
  PROTOCOL_VERSION,
  SystemEventEnvelopeSchema,
  SystemHealthPayloadSchema,
  UserPromptAttachmentsSchema,
  UtilityWorkerNameSchema,
  createEnvelope,
  describe,
  expect,
  it,
  runtime
} from "./index.test-support";

const REMOVED_EXECUTION_COMMAND_TYPES = [
  "session.prompt",
  "session.abort",
  "session.user_input_response",
  "agent.prompt",
  "agent.abort",
  "agent.user_input_response",
  "agent.model_test",
  "agent.model_capacity",
  "models.list",
  "models.refreshFree",
  "models.setFreeModelEnabled",
  "models.refreshOfficial",
  "models.queryOfficialBalance",
  "models.saveOfficialToken",
  "models.clearOfficialToken",
  "models.setOfficialModelEnabled",
  "models.save",
  "models.test",
  "models.resolveCapacity",
  "models.listRemote",
  "models.saveSiteOfficialToken",
  "models.clearSiteOfficialToken",
  "models.refreshSiteOfficial",
  "models.querySiteOfficialQuota",
  "models.setSiteOfficialModelEnabled",
  "models.mergeSiteOfficialQuota",
  "modelUsage.query",
  "revisionAnalysisSettings.list",
  "revisionAnalysisSettings.save",
  "revisionAnalysisSettings.reset"
] as const;

describe("desktop contracts: commands and prompts", () => {
  it("creates a versioned command envelope with a correlation id", () => {
    const envelope = createEnvelope("system.health", {}, { id: "cmd_health" });

    expect(CommandEnvelopeSchema.parse(envelope)).toMatchObject({
      protocolVersion: PROTOCOL_VERSION,
      id: "cmd_health",
      type: "system.health",
      context: { correlationId: "cmd_health" }
    });
  });

  it("rejects unknown protocol versions", () => {
    const envelope = createEnvelope("system.health", {}, { id: "cmd_health" });

    expect(() =>
      CommandEnvelopeSchema.parse({ ...envelope, protocolVersion: 2 })
    ).toThrow();
  });

  it("no longer accepts the removed agent/Pi execution commands", () => {
    for (const type of REMOVED_EXECUTION_COMMAND_TYPES) {
      const envelope = createEnvelope(type, {}, { id: `cmd_${type}` });
      expect(CommandEnvelopeSchema.safeParse(envelope).success).toBe(false);
    }
  });

  it("keeps only the core utility worker in the process contract", () => {
    expect(UtilityWorkerNameSchema.parse("core")).toBe("core");
    for (const worker of ["agent", "tool"]) {
      expect(UtilityWorkerNameSchema.safeParse(worker).success).toBe(false);
    }

    expect(
      SystemHealthPayloadSchema.parse({
        status: "ok",
        checkedAt: new Date().toISOString(),
        workers: [{ name: "core", status: "ok", pid: 1000, details: {} }]
      }).workers
    ).toHaveLength(1);
    expect(
      SystemHealthPayloadSchema.safeParse({
        status: "ok",
        checkedAt: new Date().toISOString(),
        workers: [
          { name: "core", status: "ok", details: {} },
          { name: "agent", status: "ok", details: {} }
        ]
      }).success
    ).toBe(false);
  });

  it("accepts extracted text and base64 image prompt attachments", () => {
    const attachments = UserPromptAttachmentsSchema.parse([
      {
        id: "attachment_notes",
        kind: "text",
        name: "notes.md",
        mediaType: "text/markdown",
        size: 18,
        content: "雨夜场景需要更压抑。"
      },
      {
        id: "attachment_reference",
        kind: "image",
        name: "reference.png",
        mediaType: "image/png",
        size: 3,
        data: "AQID"
      }
    ]);

    expect(attachments.map((attachment) => attachment.kind)).toEqual([
      "text",
      "image"
    ]);
    expect(() =>
      UserPromptAttachmentsSchema.parse([
        {
          id: "too_large",
          kind: "image",
          name: "too-large.png",
          mediaType: "image/png",
          size: PROMPT_IMAGE_ATTACHMENT_MAX_BYTES + 1,
          data: "AQID"
        }
      ])
    ).toThrow();
    expect(() =>
      UserPromptAttachmentsSchema.parse([
        {
          id: "forged_size",
          kind: "image",
          name: "forged.png",
          mediaType: "image/png",
          size: 1,
          data: "AQID"
        }
      ])
    ).toThrow();
  });

  it("accepts delta and completion events with consistent envelope identity", () => {
    const delta = createEnvelope(
      "agent.message_delta",
      {
        sessionId: "session_1",
        runId: "run_1",
        messageId: "message_1",
        delta: "第一段",
        runtime
      },
      {
        id: "event_delta",
        context: { sessionId: "session_1", runId: "run_1" }
      }
    );
    const completed = createEnvelope(
      "agent.message_completed",
      {
        sessionId: "session_1",
        runId: "run_1",
        messageId: "message_1",
        role: "assistant" as const,
        content: "第一段",
        thinking: "先理解上下文。",
        stopReason: "stop",
        runtime
      },
      {
        id: "event_completed",
        context: { sessionId: "session_1", runId: "run_1" }
      }
    );

    expect(
      AgentMessageDeltaEventEnvelopeSchema.parse(delta).payload.delta
    ).toBe("第一段");
    expect(
      AgentMessageCompletedEventEnvelopeSchema.parse(completed).payload.content
    ).toBe("第一段");
    expect(SystemEventEnvelopeSchema.parse(completed).type).toBe(
      "agent.message_completed"
    );
  });
});
