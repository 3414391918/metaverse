import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { safeStorage } from "electron";
import {
  type FishAudioCommandPayload,
  type FishAudioCatalogItem,
  type FishAudioProgressPayload,
  type FishAudioRecord
} from "@deepwrite/contracts";

type Requester = (input: string, init?: RequestInit) => Promise<Response>;
export type FishAudioServiceProgress = Omit<
  FishAudioProgressPayload,
  "operationId"
>;
type ProgressReporter = (progress: FishAudioServiceProgress) => void;
type State = {
  version: 1;
  encryptedKey: string | null;
};
const API = "https://api.fish.audio";
const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
const MAX_AUDIO_SECONDS = 120;
const REQUEST_TIMEOUT_MS = 15_000;

function emptyState(): State {
  return { version: 1, encryptedKey: null };
}

export class FishAudioService {
  private readonly path: string;
  private pending: Promise<unknown> = Promise.resolve();
  private readonly operations = new Map<string, AbortController>();

  constructor(userDataPath: string) {
    this.path = join(userDataPath, "config", "fish-audio.json");
  }

  private async read(): Promise<State> {
    let raw: unknown;
    try {
      raw = JSON.parse(await readFile(this.path, "utf8")) as unknown;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        return emptyState();
      throw new Error("FishAudio 本地配置无法读取。", { cause: error });
    }
    if (!raw || typeof raw !== "object" || (raw as State).version !== 1)
      throw new Error("FishAudio 本地配置版本无效。");
    const state = raw as State;
    if (state.encryptedKey !== null && typeof state.encryptedKey !== "string")
      throw new Error("FishAudio 凭据数据无效。");
    const settings: State = {
      version: 1,
      encryptedKey: state.encryptedKey
    };
    if ("records" in state) await this.write(settings);
    return settings;
  }

  private async write(state: State): Promise<void> {
    const directory = dirname(this.path);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const temporary = join(directory, `.fish-audio-${randomUUID()}.tmp`);
    const handle = await open(temporary, "wx", 0o600);
    try {
      await handle.writeFile(`${JSON.stringify(state, null, 2)}\n`);
      await handle.sync();
    } finally {
      await handle.close();
    }
    try {
      await rename(temporary, this.path);
    } finally {
      await rm(temporary, { force: true }).catch(() => undefined);
    }
  }

  private async mutate<T>(change: (state: State) => Promise<T>): Promise<T> {
    const work = this.pending.then(async () => {
      const state = await this.read();
      const value = await change(state);
      await this.write(state);
      return value;
    });
    this.pending = work.catch(() => undefined);
    return work;
  }

  private key(state: State): string {
    if (!state.encryptedKey)
      throw new Error("请先在设置中填写 FishAudio API Key。");
    if (!safeStorage.isEncryptionAvailable())
      throw new Error("系统安全存储不可用，无法读取 FishAudio API Key。");
    try {
      return safeStorage.decryptString(
        Buffer.from(state.encryptedKey, "base64")
      );
    } catch {
      throw new Error("FishAudio API Key 无法解密，请重新配置。");
    }
  }

  private async request(
    state: State,
    path: string,
    init: RequestInit,
    requester: Requester,
    signal?: AbortSignal
  ): Promise<unknown> {
    if (signal?.aborted) throw new DOMException("任务已取消", "AbortError");
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${this.key(state)}`);
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let removeCancel: () => void = () => undefined;
    const cancelled = new Promise<never>((_, reject) => {
      if (!signal) return;
      const onAbort = () => {
        controller.abort();
        reject(new DOMException("任务已取消", "AbortError"));
      };
      signal.addEventListener("abort", onAbort, { once: true });
      removeCancel = () => signal.removeEventListener("abort", onAbort);
    });
    const timeoutError = new Error(
      "FishAudio 连接超时，请检查网络，或在个人设置中开启系统代理。"
    );
    const deadline = new Promise<never>((_, reject) => {
      if (signal) return;
      timeout = setTimeout(() => {
        reject(timeoutError);
        controller.abort();
      }, REQUEST_TIMEOUT_MS);
    });
    try {
      return await Promise.race([
        this.readResponse(
          `${API}${path}`,
          { ...init, headers, signal: controller.signal },
          requester
        ),
        signal ? cancelled : deadline
      ]);
    } finally {
      if (timeout) clearTimeout(timeout);
      removeCancel();
    }
  }

  private async readResponse(
    url: string,
    init: RequestInit,
    requester: Requester
  ): Promise<unknown> {
    let response: Response;
    try {
      response = await requester(url, init);
    } catch {
      throw new Error("无法连接 FishAudio，请检查网络或系统代理后重试。");
    }
    if (!response.ok) {
      const raw = await response.text().catch(() => "");
      let detail = "";
      try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const candidate = parsed.message ?? parsed.detail ?? parsed.error;
        if (typeof candidate === "string") detail = candidate;
        else if (
          candidate &&
          typeof candidate === "object" &&
          "message" in candidate
        )
          detail = String(candidate.message);
      } catch {
        // An HTML response is not useful as a user-facing error.
      }
      const key = new Headers(init.headers)
        .get("Authorization")
        ?.replace(/^Bearer\s+/i, "");
      if (key) detail = detail.replaceAll(key, "[密钥已隐藏]");
      detail = detail
        .replace(/sk-[\w-]+/gi, "[密钥已隐藏]")
        .trim()
        .slice(0, 500);
      throw new Error(
        detail
          ? `FishAudio 请求失败（HTTP ${response.status}：${detail}）。`
          : `FishAudio 请求失败（HTTP ${response.status}）。请检查密钥、额度或输入内容。`
      );
    }
    if (
      response.status === 204 ||
      response.headers.get("content-length") === "0"
    )
      return {};
    const body = await response.text();
    try {
      return body ? (JSON.parse(body) as unknown) : {};
    } catch {
      throw new Error("FishAudio 返回了无法识别的数据。");
    }
  }

  async execute(
    payload: FishAudioCommandPayload,
    requester: Requester = fetch,
    onProgress?: ProgressReporter
  ): Promise<unknown> {
    if (payload.action === "operation.cancel") {
      const controller = this.operations.get(payload.operationId);
      controller?.abort();
      return { cancelled: Boolean(controller) };
    }
    if (payload.action === "settings.get") {
      await this.pending;
      return { hasApiKey: Boolean((await this.read()).encryptedKey) };
    }
    if (payload.action === "settings.save")
      return this.mutate(async (state) => {
        if (!safeStorage.isEncryptionAvailable())
          throw new Error("系统安全存储不可用，无法保存 FishAudio API Key。");
        state.encryptedKey = safeStorage
          .encryptString(payload.apiKey)
          .toString("base64");
        return { hasApiKey: true };
      });
    if (payload.action === "settings.clear")
      return this.mutate(async (state) => {
        state.encryptedKey = null;
        return { hasApiKey: false };
      });
    if (payload.action === "catalog.list") {
      await this.pending;
      return this.listCatalog(await this.read(), requester);
    }
    if (payload.action === "voice.create") {
      const controller = new AbortController();
      if (payload.operationId)
        this.operations.set(payload.operationId, controller);
      try {
        return await this.createVoice(
          payload,
          requester,
          onProgress,
          controller.signal
        );
      } finally {
        if (payload.operationId) this.operations.delete(payload.operationId);
      }
    }
    if (payload.action === "record.delete")
      return this.deleteRecord(payload, requester);
    await this.pending;
    const state = await this.read();
    return this.request(
      state,
      `/model/${encodeURIComponent(payload.id)}`,
      { method: "GET" },
      requester
    );
  }

  private async listCatalog(
    state: State,
    requester: Requester
  ): Promise<FishAudioCatalogItem[]> {
    const entries: FishAudioCatalogItem[] = [];
    const add = (id: string, title: string, createdAt?: string) => {
      entries.push({
        id,
        kind: "voice",
        title: title || id,
        ...(createdAt && !Number.isNaN(Date.parse(createdAt))
          ? { createdAt: new Date(createdAt).toISOString() }
          : {})
      });
    };

    for (let page = 1; page <= 100; page += 1) {
      const response = await this.request(
        state,
        `/model?self=true&page_size=100&page_number=${page}`,
        { method: "GET" },
        requester
      );
      if (!isObject(response) || !Array.isArray(response.items))
        throw new Error("FishAudio 声音列表格式无效。");
      for (const item of response.items) {
        if (!isObject(item) || typeof item._id !== "string") continue;
        add(
          item._id,
          typeof item.title === "string" ? item.title : "",
          typeof item.created_at === "string" ? item.created_at : undefined
        );
      }
      const hasMore =
        typeof response.has_more === "boolean"
          ? response.has_more
          : typeof response.total === "number"
            ? page * 100 < response.total
            : response.items.length === 100;
      if (!hasMore) break;
      if (page === 100)
        throw new Error("FishAudio 声音数量过多，无法读取完整列表。");
    }

    return entries.sort(
      (a, b) =>
        (b.createdAt ? Date.parse(b.createdAt) : 0) -
        (a.createdAt ? Date.parse(a.createdAt) : 0)
    );
  }

  private async createVoice(
    payload: Extract<FishAudioCommandPayload, { action: "voice.create" }>,
    requester: Requester,
    onProgress?: ProgressReporter,
    signal?: AbortSignal
  ): Promise<FishAudioRecord> {
    await this.pending;
    const state = await this.read();
    const form = new FormData();
    form.set("type", "tts");
    form.set("title", payload.title);
    form.set("train_mode", "fast");
    form.set("visibility", "private");
    const files = payload.files;
    if (
      !files.length ||
      files.length > 20 ||
      files.reduce((n, f) => n + f.durationSeconds, 0) > MAX_AUDIO_SECONDS
    )
      throw new Error("请选择 1～20 段音频，合计时长不超过 120 秒。");
    let totalBytes = 0;
    for (const file of files) {
      const bytes = Buffer.from(file.base64, "base64");
      totalBytes += bytes.byteLength;
      if (!bytes.byteLength || totalBytes > MAX_AUDIO_BYTES)
        throw new Error("音频文件总大小不能超过 20 MB。");
      form.append(
        "voices",
        new Blob([bytes], { type: file.mimeType }),
        file.name
      );
    }
    onProgress?.({
      stage: "voice.create",
      status: "running",
      detail: "正在上传并创建声音"
    });
    const created = (await this.request(
      state,
      "/model",
      { method: "POST", body: form },
      requester,
      signal
    )) as { _id?: string };
    if (!created._id) throw new Error("FishAudio 未返回声音 ID。");
    onProgress?.({
      stage: "voice.create",
      status: "completed",
      detail: `声音 ID：${created._id}`
    });
    const record: FishAudioRecord = {
      id: created._id,
      kind: "voice",
      bookId: payload.bookId,
      characterId: payload.characterId,
      characterName: payload.characterName,
      title: payload.title,
      mode: payload.mode,
      createdAt: new Date().toISOString()
    };
    return record;
  }

  private async deleteRecord(
    payload: Extract<FishAudioCommandPayload, { action: "record.delete" }>,
    requester: Requester
  ): Promise<{ deleted: boolean }> {
    await this.pending;
    const state = await this.read();
    await this.request(
      state,
      `/model/${encodeURIComponent(payload.id)}`,
      { method: "DELETE" },
      requester
    );
    return { deleted: true };
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
