import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (value: string) => Buffer.from(value, "utf8"),
    decryptString: (value: Buffer) => value.toString("utf8")
  }
}));

const { FishAudioService } = await import("./fish-audio-service");
const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
  );
});

async function service() {
  const root = await mkdtemp(join(tmpdir(), "fish-audio-test-"));
  roots.push(root);
  const instance = new FishAudioService(root);
  await instance.execute({ action: "settings.save", apiKey: "sk-test-only" });
  return { instance, root };
}

describe("FishAudioService", () => {
  it("cancels an in-flight creation request by operation ID", async () => {
    const { instance } = await service();
    let notifyStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      notifyStarted = resolve;
    });
    const requester = vi.fn((_url: string, init?: RequestInit) => {
      notifyStarted();
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
    });
    const creating = instance.execute(
      {
        action: "voice.create",
        operationId: "operation-test",
        bookId: "book",
        characterId: "character",
        characterName: "测试角色",
        title: "测试声音",
        mode: "clone",
        files: [
          {
            name: "sample.wav",
            mimeType: "audio/wav",
            durationSeconds: 10,
            base64: Buffer.from("RIFFsample").toString("base64")
          }
        ]
      },
      requester
    );
    const rejection = expect(creating).rejects.toThrow("任务已取消");
    await started;
    await expect(
      instance.execute(
        {
          action: "operation.cancel",
          operationId: "operation-test"
        },
        async () => Response.json({})
      )
    ).resolves.toEqual({ cancelled: true });
    await rejection;
    expect(requester).toHaveBeenCalledOnce();
  });

  it("stops a stalled platform request and reports a timeout", async () => {
    const { instance } = await service();
    let requestStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      requestStarted = resolve;
    });
    vi.useFakeTimers();
    try {
      const stalled = instance.execute({ action: "catalog.list" }, () => {
        requestStarted();
        return new Promise<Response>(() => undefined);
      });
      const assertion = expect(stalled).rejects.toThrow("连接超时");
      await started;
      await vi.advanceTimersByTimeAsync(15_000);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it("lists voices across pages without requesting agents or storing local records", async () => {
    const { instance, root } = await service();
    const requests: string[] = [];
    const requester = vi.fn(async (url: string) => {
      requests.push(url);
      if (url.includes("page_number=1"))
        return Response.json({
          items: [
            {
              _id: "platform-voice",
              title: "平台声音",
              created_at: "2026-10-01T00:00:00Z"
            }
          ],
          has_more: true
        });
      if (url.includes("page_number=2"))
        return Response.json({
          items: [
            {
              _id: "second-voice",
              title: "第二个声音",
              created_at: "2026-10-03T00:00:00Z"
            }
          ],
          has_more: false
        });
      throw new Error(`Unexpected FishAudio request: ${url}`);
    });
    expect(
      await instance.execute({ action: "catalog.list" }, requester)
    ).toEqual([
      expect.objectContaining({ id: "second-voice", kind: "voice" }),
      expect.objectContaining({ id: "platform-voice", kind: "voice" })
    ]);
    expect(
      requests.some((url) =>
        url.endsWith("/model?self=true&page_size=100&page_number=1")
      )
    ).toBe(true);
    expect(requests).toHaveLength(2);
    expect(requests.every((url) => url.includes("/model?"))).toBe(true);
    const disk = JSON.parse(
      await readFile(join(root, "config", "fish-audio.json"), "utf8")
    ) as Record<string, unknown>;
    expect(disk).not.toHaveProperty("records");
  });

  it("can view and delete a platform resource without a local record", async () => {
    const { instance } = await service();
    const requests: Array<{ url: string; method: string }> = [];
    const requester = vi.fn(async (url: string, init?: RequestInit) => {
      requests.push({ url, method: init?.method ?? "GET" });
      if (url.endsWith("/model/platform-voice") && init?.method === "GET")
        return Response.json({ _id: "platform-voice", title: "平台声音" });
      return new Response(null, { status: 204 });
    });
    expect(
      await instance.execute(
        { action: "voice.detail", id: "platform-voice" },
        requester
      )
    ).toEqual(expect.objectContaining({ _id: "platform-voice" }));
    expect(
      await instance.execute(
        { action: "record.delete", kind: "voice", id: "platform-voice" },
        requester
      )
    ).toEqual({ deleted: true });
    expect(
      requests.some(
        ({ url, method }) =>
          url.endsWith("/model/platform-voice") && method === "DELETE"
      )
    ).toBe(true);
  });

  it("stores the key encrypted and keeps it out of renderer responses", async () => {
    const { instance, root } = await service();
    expect(await instance.execute({ action: "settings.get" })).toEqual({
      hasApiKey: true
    });
    const disk = await readFile(
      join(root, "config", "fish-audio.json"),
      "utf8"
    );
    expect(disk).not.toContain("sk-test-only");
  });

  it("uploads clone audio without creating an agent", async () => {
    const { instance } = await service();
    const requests: Array<{
      url: string;
      method: string;
      auth: string | null;
      body: BodyInit | null | undefined;
    }> = [];
    const requester = vi.fn(async (url: string, init?: RequestInit) => {
      requests.push({
        url,
        method: init?.method ?? "GET",
        auth: new Headers(init?.headers).get("Authorization"),
        body: init?.body
      });
      if (url.endsWith("/model") && init?.method === "POST")
        return Response.json({ _id: "voice-test" }, { status: 201 });
      throw new Error(`Unexpected FishAudio request: ${url}`);
    });
    const voice = (await instance.execute(
      {
        action: "voice.create",
        bookId: "book",
        characterId: "character",
        characterName: "测试角色",
        title: "测试声音",
        mode: "clone",
        files: [
          {
            name: "sample.wav",
            mimeType: "audio/wav",
            durationSeconds: 10,
            base64: Buffer.from("RIFFsample").toString("base64")
          }
        ]
      },
      requester
    )) as { id: string };
    expect(voice.id).toBe("voice-test");
    expect(requests[0]?.body).toBeInstanceOf(FormData);
    expect(requests[0]?.auth).toBe("Bearer sk-test-only");
    expect(requests).toHaveLength(1);
  });

  it("includes a safe platform error message in failed requests", async () => {
    const { instance } = await service();
    await expect(
      instance.execute({ action: "catalog.list" }, async () =>
        Response.json({ message: "声音权限不足" }, { status: 403 })
      )
    ).rejects.toThrow("HTTP 403：声音权限不足");
  });

  it("rejects audio over the combined duration cap before contacting FishAudio", async () => {
    const { instance } = await service();
    const requester = vi.fn();
    await expect(
      instance.execute(
        {
          action: "voice.create",
          bookId: "book",
          characterId: "character",
          characterName: "测试角色",
          title: "测试声音",
          mode: "clone",
          files: [
            {
              name: "a.wav",
              mimeType: "audio/wav",
              durationSeconds: 70,
              base64: "AAAA"
            },
            {
              name: "b.wav",
              mimeType: "audio/wav",
              durationSeconds: 70,
              base64: "AAAA"
            }
          ]
        },
        requester
      )
    ).rejects.toThrow("120 秒");
    expect(requester).not.toHaveBeenCalled();
  });
});
