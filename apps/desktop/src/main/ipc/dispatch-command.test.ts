import { describe, expect, it } from "vitest";
import type { CommandEnvelope } from "@deepwrite/contracts";
import type { IpcCommandContext } from "./command-types";
import { dispatchCommand } from "./dispatch-command";

describe("removed in-app model commands", () => {
  it.each(["models.list", "modelUsage.query", "session.prompt"])(
    "rejects %s before accessing any service",
    async (type) => {
      const ctx = new Proxy({} as IpcCommandContext, {
        get() {
          throw new Error("A removed model command accessed a service.");
        }
      });
      const result = await dispatchCommand(ctx, {
        id: "removed-model-command",
        type,
        payload: {}
      } as CommandEnvelope);
      expect(result).toMatchObject({
        status: "rejected",
        error: { code: "ipc.model_feature_removed" }
      });
    }
  );
});
