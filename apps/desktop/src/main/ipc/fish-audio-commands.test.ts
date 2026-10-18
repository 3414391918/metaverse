import { describe, expect, it, vi } from "vitest";
import type { CommandEnvelope } from "@deepwrite/contracts";
import type { IpcCommandContext } from "./command-types";
import { handleFishAudioCommands } from "./fish-audio-commands";

vi.mock("electron", () => ({
  shell: { openExternal: vi.fn(async () => undefined) }
}));

const { shell } = await import("electron");

describe("handleFishAudioCommands", () => {
  it("opens the created voice page in the default browser", async () => {
    vi.mocked(shell.openExternal).mockClear();
    const execute = vi.fn(async () => ({
      id: "new-voice",
      kind: "voice",
      bookId: "book-test",
      characterId: "character-test",
      characterName: "测试人物",
      title: "测试声音或角色",
      createdAt: "2026-10-10T00:00:00.000Z"
    }));
    const ctx = {
      requireFishAudioService: () => ({ execute })
    } as unknown as IpcCommandContext;
    const command = {
      type: "fishAudio.execute",
      id: "fish-voice",
      payload: { action: "voice.create" }
    } as CommandEnvelope;

    const result = await handleFishAudioCommands(ctx, command);

    expect(result).toMatchObject({ status: "accepted" });
    expect(shell.openExternal).toHaveBeenCalledOnce();
    const url = new URL(vi.mocked(shell.openExternal).mock.calls[0]![0]);
    expect(url.protocol).toBe("https:");
    expect(url.pathname).toBe("/zh-CN/app/m/new-voice/");
  });

  it("routes Fish Audio commands through their dedicated network transport", async () => {
    const execute = vi.fn(async () => []);
    const fishAudioFetch = vi.fn();
    const remoteFetch = vi.fn();
    const ctx = {
      requireFishAudioService: () => ({ execute }),
      fishAudioFetch,
      remoteFetch
    } as unknown as IpcCommandContext;
    const command = {
      type: "fishAudio.execute",
      id: "fish-list",
      payload: { action: "catalog.list" }
    } as CommandEnvelope;
    await handleFishAudioCommands(ctx, command);
    expect(execute).toHaveBeenCalledWith(command.payload, fishAudioFetch);
  });

  it("finishes the command even when opening the system browser never resolves", async () => {
    vi.mocked(shell.openExternal).mockImplementationOnce(
      () => new Promise<void>(() => undefined)
    );
    const ctx = {
      requireFishAudioService: () => ({
        execute: vi.fn(async () => ({
          id: "voice-test",
          kind: "voice",
          bookId: "book",
          characterId: "character",
          characterName: "测试角色",
          title: "测试声音",
          createdAt: "2026-10-10T00:00:00.000Z"
        }))
      })
    } as unknown as IpcCommandContext;
    const command = {
      type: "fishAudio.execute",
      id: "fish-browser",
      payload: { action: "voice.create" }
    } as CommandEnvelope;
    await expect(
      Promise.race([
        handleFishAudioCommands(ctx, command),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("blocked")), 50)
        )
      ])
    ).resolves.toMatchObject({ status: "accepted" });
  });

  it("keeps a created platform resource successful if browser launch throws", async () => {
    vi.mocked(shell.openExternal).mockImplementationOnce(() => {
      throw new Error("browser unavailable");
    });
    const ctx = {
      requireFishAudioService: () => ({
        execute: vi.fn(async () => ({
          id: "voice-test",
          kind: "voice",
          bookId: "book",
          characterId: "character",
          characterName: "测试角色",
          title: "测试声音",
          createdAt: "2026-10-10T00:00:00.000Z"
        }))
      })
    } as unknown as IpcCommandContext;
    await expect(
      handleFishAudioCommands(ctx, {
        type: "fishAudio.execute",
        id: "fish-browser-throw",
        payload: { action: "voice.create" }
      } as CommandEnvelope)
    ).resolves.toMatchObject({ status: "accepted" });
  });

  it("broadcasts platform stage changes and the stage-specific error", async () => {
    const broadcastEvent = vi.fn();
    const ctx = {
      broadcastEvent,
      requireFishAudioService: () => ({
        execute: async (
          _payload: unknown,
          _requester: unknown,
          progress: (event: unknown) => void
        ) => {
          progress({ stage: "voice.create", status: "running" });
          throw new Error("FishAudio 请求失败（HTTP 403：无权创建）。");
        }
      })
    } as unknown as IpcCommandContext;
    const result = await handleFishAudioCommands(ctx, {
      type: "fishAudio.execute",
      id: "fish-progress",
      payload: { action: "voice.create", operationId: "operation-1" }
    } as CommandEnvelope);
    expect(result).toMatchObject({ status: "rejected" });
    expect(broadcastEvent.mock.calls.map(([event]) => event.payload)).toEqual([
      expect.objectContaining({
        operationId: "operation-1",
        stage: "voice.create",
        status: "running"
      }),
      expect.objectContaining({
        operationId: "operation-1",
        stage: "voice.create",
        status: "error",
        detail: expect.stringContaining("HTTP 403")
      })
    ]);
  });
});
