import {
  createCatalogDraftDirectory,
  createDefaultBookCharacterStructure,
  createDefaultBookPlotStages,
  createScriptCatalogDraftDirectory,
  ScriptBookSchema,
  ShortBookSchema,
  type Book,
  type CreateScriptBookInput,
  type CreateShortBookInput,
  type ScriptBook,
  type ShortBook,
  type CreativePlotStage
} from "@deepwrite/contracts";
import { createCatalogId } from "@deepwrite/shared";
export const DEFAULT_SHORT_DOCUMENTS = [
  ["character_design", "人物设计"],
  ["worldbuilding", "世界观"],
  ["plot_design", "剧情设计"],
  ["intro_design", "导语设计"],
  ["plot_refine", "剧情细化"],
  ["narrative_perspective", "叙事视角"],
  ["outline", "大纲"]
] as const;

export const DEFAULT_SCRIPT_DOCUMENTS = [
  ["character_design", "人物设计"],
  ["worldbuilding", "世界观"],
  ["plot_design", "剧情设计"],
  ["intro_design", "导语设计"],
  ["plot_refine", "剧情细化"],
  ["narrative_perspective", "叙事视角"],
  ["outline", "大纲"]
] as const;

export function linkedMaterialIdsFromInput(
  value:
    | CreateShortBookInput["linkedMaterialIdsByKind"]
    | CreateScriptBookInput["linkedMaterialIdsByKind"]
): Book["linkedMaterialIdsByKind"] {
  return {
    character: [...(value?.character ?? [])],
    gimmick: [...(value?.gimmick ?? [])],
    plot: [...(value?.plot ?? [])],
    draft: [...(value?.draft ?? [])],
    other: [...(value?.other ?? [])]
  };
}

export function linkedSkillIdsFromInput(
  value:
    | CreateShortBookInput["linkedSkillIdsByKind"]
    | CreateScriptBookInput["linkedSkillIdsByKind"]
): Book["linkedSkillIdsByKind"] {
  return {
    general: [...(value?.general ?? [])],
    plot: [...(value?.plot ?? [])],
    style: [...(value?.style ?? [])],
    other: [...(value?.other ?? [])]
  };
}

export function createNewShortBook(
  input: CreateShortBookInput,
  now: string
): ShortBook {
  return ShortBookSchema.parse({
    id: createCatalogId("book"),
    title: input.title,
    bookType: "short",
    genre: input.genre,
    status: "editing",
    linkedMaterialIdsByKind: linkedMaterialIdsFromInput(
      input.linkedMaterialIdsByKind
    ),
    linkedSkillIdsByKind: linkedSkillIdsFromInput(input.linkedSkillIdsByKind),
    characterStructure:
      input.characterFormat === "list"
        ? { format: "list", items: [] }
        : createDefaultBookCharacterStructure(),
    plotStages: createDefaultBookPlotStages(),
    documents: DEFAULT_SHORT_DOCUMENTS.map(([id, title]) => ({
      id,
      title:
        id === "character_design" && input.characterFormat === "list"
          ? "概览"
          : title,
      content: "",
      createdAt: now,
      updatedAt: now
    })),
    draft: createCatalogDraftDirectory(now),
    createdAt: now,
    updatedAt: now
  });
}
export function createNewScriptBook(
  input: CreateScriptBookInput,
  now: string
): ScriptBook {
  return ScriptBookSchema.parse({
    id: createCatalogId("book"),
    title: input.title,
    bookType: "script",
    genre: input.genre,
    status: "editing",
    linkedMaterialIdsByKind: linkedMaterialIdsFromInput(
      input.linkedMaterialIdsByKind
    ),
    linkedSkillIdsByKind: linkedSkillIdsFromInput(input.linkedSkillIdsByKind),
    characterStructure:
      input.characterFormat === "list"
        ? { format: "list", items: [] }
        : createDefaultBookCharacterStructure(),
    plotStages: createDefaultBookPlotStages(),
    documents: DEFAULT_SCRIPT_DOCUMENTS.map(([id, title]) => ({
      id,
      title:
        id === "character_design" && input.characterFormat === "list"
          ? "概览"
          : title,
      content: "",
      createdAt: now,
      updatedAt: now
    })),
    draft: createScriptCatalogDraftDirectory(now),
    createdAt: now,
    updatedAt: now
  });
}
export function assertCreationPlotStages(
  ids: readonly string[] | undefined,
  stages: readonly CreativePlotStage[]
): void {
  if (ids?.some((id) => !stages.some((stage) => stage.id === id)))
    throw new Error("模板中的剧情阶段已失效，请编辑模板后重试。");
}
