import type { ModelUsageModule } from "@deepwrite/contracts";

export const MODULE_META: Record<
  ModelUsageModule,
  { label: string; detail: string }
> = {
  "short-writing": { label: "创作（历史）", detail: "创作（历史）空间" },
  "script-writing": { label: "创作（历史）", detail: "创作（历史）空间" },
  "long-writing": { label: "小说创作", detail: "小说创作空间" },
  "skill-library": { label: "技能库", detail: "技能库对话与处理" },
  "material-library": { label: "素材库", detail: "素材库对话与处理" },
  "learning-imitation": { label: "学习仿写", detail: "学习和仿写流程" },
  "style-comparison": { label: "文风比对", detail: "两份文本的文风相似度分析" },
  "revision-analysis": { label: "修改分析", detail: "学习文稿修改方向" },
  "short-book-analysis": { label: "分析（历史）", detail: "文本分析（历史）" },
  "long-book-analysis": {
    label: "分析（历史）",
    detail: "分析（历史）分析流程"
  },
  "subagent-authoring": { label: "子智能体", detail: "子智能体生成与执行" },
  "assistant-chat": { label: "聊天助手", detail: "独立聊天助手" },
  "model-test": { label: "模型测试", detail: "模型连接测试" },
  unknown: { label: "其他", detail: "未能归类的模型调用" }
};
