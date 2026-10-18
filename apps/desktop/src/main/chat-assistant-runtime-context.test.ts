import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CommandEnvelopeSchema, createEnvelope } from "@deepwrite/contracts";

describe("chat assistant runtime context", () => {
  it("uses registered Core command discriminators for every authority query", () => {
    const resolverSource = readFileSync(
      new URL("./chat-assistant-runtime-context.ts", import.meta.url),
      "utf8"
    );

    expect(resolverSource).toContain(
      'requireCorePayload(supervisor, "long.list", LongListBooksResultSchema)'
    );
    expect(resolverSource).not.toContain("long.listBooks");

    for (const type of [
      "catalog.index",
      "catalog.snapshot",
      "long.list"
    ] as const) {
      expect(() =>
        CommandEnvelopeSchema.parse(
          createEnvelope(
            type,
            {},
            {
              id: `cmd_chat_assistant_${type}`,
              correlationId: `cmd_chat_assistant_${type}`
            }
          )
        )
      ).not.toThrow();
    }
  });
});
