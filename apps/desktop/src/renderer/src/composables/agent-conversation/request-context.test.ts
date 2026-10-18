import { ref } from "vue";
import { describe, expect, it, vi } from "vitest";
import type { DeepWriteApi } from "@deepwrite/contracts";
import type { AgentConversationContext } from "./context";
import { preparePromptContext } from "./request-context";

vi.mock("@deepwrite/contracts/renderer", () => ({
  LibraryAgentWorkspaceSnapshotSchema: { parse: (value: unknown) => value }
}));

describe("creation prompt context", () => {
  it.each(["short", "script"] as const)(
    "rejects a legacy %s creation document before prompting",
    (workspaceType) => {
      const ctx = { epoch: 1, sessionId: ref("session"), options: {} } as Pick<
        AgentConversationContext,
        "epoch" | "sessionId" | "options"
      >;
      expect(() =>
        preparePromptContext(
          ctx,
          {} as DeepWriteApi,
          {
            id: "old",
            domain: "creation",
            title: "旧书",
            eyebrow: "",
            path: [],
            content: "旧文稿",
            workspaceType
          },
          [],
          {},
          undefined,
          "workspace",
          1,
          "session"
        )
      ).toThrow("请选择小说创作空间后再发送");
    }
  );
});
