import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BrowserWindow } from "electron";
import {
  createEnvelope,
  IPC_COMMAND_CHANNEL,
  type CommandResult
} from "@deepwrite/contracts";
import type { IpcCommandContext } from "./ipc/command-types";

const mocks = vi.hoisted(() => ({ handle: vi.fn(), dispatch: vi.fn() }));
vi.mock("electron", () => ({ ipcMain: { handle: mocks.handle } }));
vi.mock("./ipc/dispatch-command", () => ({ dispatchCommand: mocks.dispatch }));
import { registerDesktopCommandIpc } from "./ipc/register-command-ipc";

function register(destroyed = false, missingWindow = false) {
  const sender = { id: 17 };
  const window = {
    webContents: sender,
    isDestroyed: () => destroyed
  } as unknown as BrowserWindow;
  const context = { senderWebContentsId: sender.id } as IpcCommandContext;
  const getContext = vi.fn(() => context);
  registerDesktopCommandIpc({
    getMainWindow: () => (missingWindow ? undefined : window),
    getContext
  });
  expect(mocks.handle).toHaveBeenCalledWith(
    IPC_COMMAND_CHANNEL,
    expect.any(Function)
  );
  const handler = mocks.handle.mock.calls[0]![1] as (
    event: { sender: { id: number } },
    raw: unknown
  ) => Promise<CommandResult>;
  return {
    sender,
    context,
    getContext,
    invoke: (raw: unknown, eventSender = sender) =>
      handler({ sender: eventSender }, raw)
  };
}

describe("desktop command IPC security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects another window even if it reports the same webContents id", async () => {
    const ipc = register();
    const result = await ipc.invoke(
      createEnvelope("system.health", {}, { id: "health_1" }),
      { id: 17 }
    );
    expect(result).toMatchObject({
      status: "rejected",
      requestId: "health_1",
      error: { code: "ipc.untrusted_sender" }
    });
    expect(ipc.getContext).not.toHaveBeenCalled();
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it.each([
    [true, false],
    [false, true]
  ])(
    "rejects when the active window is unavailable (%s, %s)",
    async (destroyed, missing) => {
      const ipc = register(destroyed, missing);
      expect(await ipc.invoke({ id: "  original_request  " })).toMatchObject({
        requestId: "original_request",
        error: { code: "ipc.untrusted_sender" }
      });
      expect(mocks.dispatch).not.toHaveBeenCalled();
    }
  );

  it("preserves the request id and limits validation details for malformed commands", async () => {
    const ipc = register();
    const result = await ipc.invoke({
      id: "  malformed_request  ",
      type: "session.prompt",
      payload: {}
    });
    expect(result).toMatchObject({
      status: "rejected",
      requestId: "malformed_request",
      error: { code: "ipc.invalid_command" }
    });
    if (result.status !== "rejected") throw new Error("Expected rejection");
    const details = result.error.details as {
      issueCount: number;
      issues: unknown[];
    };
    expect(details.issueCount).toBeGreaterThan(0);
    expect(details.issues.length).toBeLessThanOrEqual(3);
    expect(ipc.getContext).not.toHaveBeenCalled();
  });

  it("rejects retired workflows before creating a dispatch context", async () => {
    const ipc = register();
    expect(
      await ipc.invoke(
        createEnvelope(
          "catalog.createShortBook",
          { title: "旧入口" },
          { id: "retired_create" }
        )
      )
    ).toMatchObject({
      status: "rejected",
      error: { code: "ipc.invalid_command" }
    });
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it("passes a validated command and the trusted sender context to dispatch", async () => {
    const ipc = register();
    const command = createEnvelope("system.health", {}, { id: "health_2" });
    const expected = {
      status: "accepted",
      requestId: command.id,
      payload: { status: "ok" }
    };
    mocks.dispatch.mockResolvedValueOnce(expected);
    expect(await ipc.invoke(command)).toEqual(expected);
    expect(ipc.getContext).toHaveBeenCalledWith(17);
    expect(mocks.dispatch).toHaveBeenCalledWith(ipc.context, command);
  });

  it("returns a bounded fallback id for commands with no usable id", async () => {
    const ipc = register();
    expect(await ipc.invoke(null)).toMatchObject({
      requestId: "unknown",
      error: { code: "ipc.invalid_command" }
    });
  });
});
