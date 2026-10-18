const API = "https://api.fish.audio";
const PAGE = "https://fish.audio/zh-CN/app/m/";

export const createSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "instruction"],
  properties: {
    title: { type: "string", minLength: 1, maxLength: 120 },
    instruction: { type: "string", minLength: 1, maxLength: 2000 }
  }
};

function validate(input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("声音设计输入必须是对象。");
  const title = input.title?.trim();
  const instruction = input.instruction?.trim();
  if (!title || title.length > 120) throw new Error("声音名称需为 1～120 字。");
  if (!instruction || instruction.length > 2000)
    throw new Error("声音设计提示词需为 1～2000 字。");
  return { title, instruction };
}

async function jsonResponse(url, init, fetcher, key) {
  let response;
  try {
    response = await fetcher(url, init);
  } catch {
    throw new Error("无法连接 FishAudio，请检查网络后重试。");
  }
  if (!response.ok) {
    const raw = await response.text().catch(() => "");
    let detail = "";
    try {
      const error = JSON.parse(raw);
      detail = String(error?.message ?? error?.detail ?? error?.error ?? "");
    } catch {
      // HTML error bodies are intentionally omitted.
    }
    detail = detail.replaceAll(key, "[密钥已隐藏]").slice(0, 500);
    throw new Error(
      `FishAudio 请求失败（HTTP ${response.status}${detail ? `：${detail}` : ""}）。`
    );
  }
  try {
    return await response.json();
  } catch {
    throw new Error("FishAudio 返回了无法识别的数据。");
  }
}

export async function createDesignedVoice(rawInput, key, fetcher = fetch) {
  const { title, instruction } = validate(rawInput);
  if (!key?.trim()) throw new Error("请在运行环境中配置 FISH_AUDIO_API_KEY。");
  const authorization = `Bearer ${key.trim()}`;
  const designed = await jsonResponse(
    `${API}/v1/voice-design`,
    {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
        model: "voice-design-1"
      },
      body: JSON.stringify({ instruction, language: "zh", n: 1 })
    },
    fetcher,
    key
  );
  const candidate = designed?.candidates?.[0];
  if (!candidate?.audio_base64)
    throw new Error("FishAudio 未返回可用的设计声音。");
  const audio = Buffer.from(candidate.audio_base64, "base64");
  if (!audio.byteLength) throw new Error("FishAudio 返回的声音样本为空。");
  const form = new FormData();
  form.set("type", "tts");
  form.set("title", title);
  form.set("train_mode", "fast");
  form.set("visibility", "private");
  form.append(
    "voices",
    new Blob([audio], { type: "audio/wav" }),
    "voice-design.wav"
  );
  if (candidate.text) form.append("texts", candidate.text);
  const created = await jsonResponse(
    `${API}/model`,
    { method: "POST", headers: { Authorization: authorization }, body: form },
    fetcher,
    key
  );
  if (typeof created?._id !== "string" || !created._id)
    throw new Error("FishAudio 未返回声音 ID。");
  return {
    id: created._id,
    title,
    url: `${PAGE}${encodeURIComponent(created._id)}/`
  };
}
