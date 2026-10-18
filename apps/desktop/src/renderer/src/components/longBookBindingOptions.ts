import type { MaterialKind, SkillKind } from "@deepwrite/contracts";

export const LONG_MATERIAL_BINDING_KINDS: ReadonlyArray<{
  id: MaterialKind;
  label: string;
  description: string;
}> = [
  { id: "character", label: "人设素材库", description: "人物与关系设定" },
  { id: "gimmick", label: "梗素材库", description: "核心创意与钩子" },
  { id: "plot", label: "剧情素材库", description: "剧情、导语与细化" },
  { id: "draft", label: "正文素材库", description: "正文片段与表达参考" },
  { id: "other", label: "其他素材库", description: "未归入以上分类的素材" }
];

export const LONG_SKILL_BINDING_KINDS: ReadonlyArray<{
  id: SkillKind;
  label: string;
  description: string;
}> = [
  { id: "general", label: "通用技能库", description: "多个阶段均可使用" },
  { id: "plot", label: "剧情设计技能库", description: "人物、剧情与大纲方法" },
  { id: "style", label: "文风写作技能库", description: "正文与章节写作方法" },
  { id: "other", label: "其他技能库", description: "自定义写作方法" }
];
