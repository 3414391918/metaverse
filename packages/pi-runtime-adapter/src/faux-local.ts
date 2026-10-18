import type { AgentRuntimeRef } from "@deepwrite/contracts";
import type { AgentRunInput } from "./runtime-types";

export const DEEPWRITE_FAUX_RUNTIME: AgentRuntimeRef = {
  provider: "deepwrite",
  model: "deepwrite-writing-faux",
  mode: "local-faux"
};

export function buildLocalThinking(input: AgentRunInput): string {
  if (
    input.mode === "chat-assistant" &&
    input.chatAssistantRuntimeContext?.mode === "roleplay"
  )
    return "正在根据人物定义组织回复。";
  if (input.mode === "chat-assistant") {
    return input.chatAssistantRuntimeContext?.mode === "project"
      ? "正在结合当前项目结构与只读查询工具核对信息。"
      : "正在结合 虚拟世界当前状态与只读查询工具组织回复。";
  }
  const title = input.workspaceContext?.activeResource?.title ?? "未命名资源";
  const selectedProfile = input.longAgentProfile ?? input.libraryAgentProfile;
  const agent = selectedProfile ? `，由「${selectedProfile.label}」处理` : "";
  return `正在读取发送瞬间的创作上下文快照，确认当前工作对象为《${title}》${agent}，并区分用户要求、作品事实与参考信息。`;
}

export function buildLocalWritingResponse(input: AgentRunInput): string {
  if (
    input.mode === "chat-assistant" &&
    input.chatAssistantRuntimeContext?.mode === "roleplay"
  )
    return "人物扮演聊天链路已就绪，未装配工具。请选择真实模型开始人物扮演。";
  if (input.mode === "chat-assistant") {
    const request = input.prompt.replace(/\s+/g, " ").slice(0, 220);
    return [
      `${input.chatAssistantRuntimeContext?.mode === "project" ? "项目" : "普通"}聊天助手的本地 Faux 流式链路已就绪。`,
      "",
      `我收到了你的消息：${request}`,
      "",
      "当前是用于验证客户端聊天链路的本地模型。只读工具已按当前模式装配；不会修改任何项目或配置。配置真实模型后，可以继续正式交流。"
    ].join("\n");
  }
  const active = input.workspaceContext?.activeResource;
  const request = input.prompt.replace(/\s+/g, " ").slice(0, 220);
  const activeLabel = active ? `《${active.title}》` : "当前创作资源";
  const contentLength = active?.content.replace(/\s/g, "").length ?? 0;
  const snapshotLabel = active?.truncated
    ? `${activeLabel} 前 ${active.content.length.toLocaleString("zh-CN")} 个字符的上下文快照（原文 ${active.originalLength?.toLocaleString("zh-CN") ?? "超过限制"} 个字符）`
    : `${activeLabel} 上下文快照（约 ${contentLength} 字）`;

  return [
    "本地 Faux 流式链路已就绪。",
    "",
    `我已读取本轮发送时的 ${snapshotLabel}，并收到请求：${request}`,
    "",
    "本轮可验证结果",
    "",
    "- 回复由 pi-agent-core 驱动，并通过 Agent Utility 流式返回。",
    "- Thinking 与回复内容使用独立事件，Renderer 会绑定到同一条助手消息。",
    "- 当前是无需 API Key 的本地 Faux 模型，用于验证客户端链路和上下文边界。",
    "- 本轮没有调用写入工具，也没有修改或保存右侧文稿。",
    input.libraryAgentProfile
      ? `- 当前已选择「${input.libraryAgentProfile.label}」，并且装配当前资料库读写工具与按需 load_skill。`
      : input.longAgentProfile
        ? `- 当前已按创作根节点选择「${input.longAgentProfile.label}」智能体；结构与正文只会通过创作工具按需读取。`
        : "",
    "",
    "下一切片接入真实模型配置后，可以在保持同一协议的前提下生成正式续写、润色和一致性检查结果。"
  ]
    .filter(Boolean)
    .join("\n");
}
