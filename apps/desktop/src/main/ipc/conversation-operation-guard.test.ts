import { describe, expect, it } from "vitest";
import { acquireConversationOperation } from "./conversation-operation-guard";

describe("Main conversation operation ownership", () => {
  it("blocks concurrent management operations per session and releases afterwards", () => {
    const release = acquireConversationOperation("session", "management")!;
    expect(release).toBeTypeOf("function");
    expect(
      acquireConversationOperation("session", "management")
    ).toBeUndefined();
    const unrelated = acquireConversationOperation("other", "management");
    expect(unrelated).toBeTypeOf("function");
    unrelated!();
    release();
    const next = acquireConversationOperation("session", "management")!;
    expect(next).toBeTypeOf("function");
    next();
  });

  it("ignores duplicate releases", () => {
    const release = acquireConversationOperation("session", "management")!;
    release();
    release();
    expect(acquireConversationOperation("session", "management")).toBeTypeOf(
      "function"
    );
  });
});
