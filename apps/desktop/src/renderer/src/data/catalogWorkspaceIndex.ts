import {
  type MaterialKind,
  type MaterialLibraryKind,
  type MaterialStageId,
  type SkillKind,
  type SkillStageId
} from "@deepwrite/contracts";
import type {
  ResourceTreeNode,
  ResourceTreeSection,
  WorkspaceDocument
} from "../types/workspace";

export const MATERIAL_KIND_LABELS: Record<MaterialLibraryKind, string> = {
  character: "人设素材库",
  gimmick: "梗素材库",
  plot: "剧情素材库",
  draft: "正文素材库",
  other: "其他素材库",
  mixed: "综合素材库"
};

export const MATERIAL_STAGE_LABELS: Record<MaterialStageId, string> = {
  gimmick: "梗",
  character: "人设",
  pacing: "剧情设计",
  intro: "导语设计",
  plot_refine: "剧情细化",
  draft_excerpt: "优秀正文片段",
  other: "其他素材"
};

export { MATERIAL_STAGE_KINDS } from "@deepwrite/contracts/renderer";

export const SKILL_KIND_LABELS: Record<SkillKind, string> = {
  general: "通用技能库",
  plot: "剧情设计技能库",
  style: "文风写作技能库",
  other: "其他技能库"
};

export const SKILL_STAGE_LABELS: Record<SkillStageId, string> = {
  character_design: "人物技能",
  plot_design: "剧情技能",
  outline: "大纲技能",
  draft: "正文专家编写技能",
  expert_section_writer: "分节写手技能"
};

export const MATERIAL_TREE_KIND_ORDER: readonly MaterialKind[] = [
  "character",
  "plot",
  "gimmick",
  "draft",
  "other"
];

export const MATERIAL_TREE_KIND_LABELS: Record<MaterialKind, string> = {
  character: "人设",
  plot: "剧情",
  gimmick: "梗",
  draft: "正文",
  other: "其他"
};

export const SKILL_KIND_TAG_LABELS: Record<SkillKind, string> = {
  general: "通用",
  plot: "剧情",
  style: "文风",
  other: "其他"
};

export interface CatalogWorkspaceProjection {
  resourceSections: ResourceTreeSection[];
  workspaceDocuments: WorkspaceDocument[];
  draftDirectories: DraftDirectoryProjection[];
  /**
   * Read-only lookup tables built alongside the projection. Keeping these on
   * the projection makes selection, navigation and draft recovery independent
   * of repeated full-tree walks as a catalog grows.
   */
  index: CatalogWorkspaceProjectionIndex;
}

export interface CatalogWorkspaceProjectionIndex {
  resourceNodeById: ReadonlyMap<string, ResourceTreeNode>;
  workspaceDocumentById: ReadonlyMap<string, WorkspaceDocument>;
  resourceIdByDocumentId: ReadonlyMap<string, string>;
  resourceTargetDocumentIdById: ReadonlyMap<string, string>;
  draftDirectoryById: ReadonlyMap<string, DraftDirectoryProjection>;
  draftDirectoryByWorkspaceId: ReadonlyMap<string, DraftDirectoryProjection>;
  preferredResourceIdByWorkspaceId: ReadonlyMap<string, string>;
  workspaceIdByResourceId: ReadonlyMap<string, string>;
}

export interface DraftSectionProjection {
  id: string;
  title: string;
  wordCountRequirement: string;
  bodyDocumentId: string;
  characterStateDocumentId: string;
}

export interface DraftDirectoryProjection {
  id: string;
  workspaceId: string;
  workspaceType: "short" | "script";
  title: string;
  sections: DraftSectionProjection[];
}

export function resolvePreferredBookResourceId(
  projection: CatalogWorkspaceProjection | undefined,
  workspaceId: string
): string | undefined {
  return projection?.index.preferredResourceIdByWorkspaceId.get(workspaceId);
}

export function findProjectedResourceNode(
  projection: CatalogWorkspaceProjection | undefined,
  resourceId: string
): ResourceTreeNode | undefined {
  return projection?.index.resourceNodeById.get(resourceId);
}

export function resolveProjectedResourceIdForDocumentId(
  projection: CatalogWorkspaceProjection | undefined,
  documentId: string
): string | undefined {
  return projection?.index.resourceIdByDocumentId.get(documentId);
}

export function resolveProjectedResourceTargetDocumentId(
  projection: CatalogWorkspaceProjection | undefined,
  resourceId: string
): string {
  return (
    projection?.index.resourceTargetDocumentIdById.get(resourceId) ?? resourceId
  );
}

export function resolveBookWorkspaceId(
  projection: CatalogWorkspaceProjection | undefined,
  resourceId: string
): string | undefined {
  return projection?.index.workspaceIdByResourceId.get(resourceId);
}

export function findProjectedWorkspaceDocument(
  projection: CatalogWorkspaceProjection | undefined,
  documentId: string
): WorkspaceDocument | undefined {
  return projection?.index.workspaceDocumentById.get(documentId);
}

export function findProjectedDraftDirectoryForWorkspace(
  projection: CatalogWorkspaceProjection | undefined,
  workspaceId: string
): DraftDirectoryProjection | undefined {
  return projection?.index.draftDirectoryByWorkspaceId.get(workspaceId);
}

export function resolveDraftSectionResourceId(
  directoryNode: ResourceTreeNode | undefined,
  sectionId: string
): string | undefined {
  return directoryNode?.children?.find(
    (child) => child.expertSectionId === sectionId
  )?.id;
}

export function resolveDraftSectionProjection(
  directory: DraftDirectoryProjection,
  selectedSectionId?: string,
  nodeSectionId?: string
): DraftSectionProjection | undefined {
  return (
    (selectedSectionId
      ? directory.sections.find((section) => section.id === selectedSectionId)
      : undefined) ??
    (nodeSectionId
      ? directory.sections.find((section) => section.id === nodeSectionId)
      : undefined) ??
    directory.sections[0]
  );
}

function setIndexValueIfAbsent<Key, Value>(
  index: Map<Key, Value>,
  key: Key,
  value: Value
): void {
  if (!index.has(key)) index.set(key, value);
}

export function createCatalogWorkspaceProjectionIndex(
  resourceSections: readonly ResourceTreeSection[],
  workspaceDocuments: readonly WorkspaceDocument[],
  draftDirectories: readonly DraftDirectoryProjection[]
): CatalogWorkspaceProjectionIndex {
  const resourceNodeById = new Map<string, ResourceTreeNode>();
  const workspaceDocumentById = new Map<string, WorkspaceDocument>();
  const resourceIdByDocumentId = new Map<string, string>();
  const resourceTargetDocumentIdById = new Map<string, string>();
  const draftDirectoryById = new Map<string, DraftDirectoryProjection>();
  const draftDirectoryByWorkspaceId = new Map<
    string,
    DraftDirectoryProjection
  >();
  const preferredResourceIdByWorkspaceId = new Map<string, string>();
  const workspaceIdByResourceId = new Map<string, string>();

  for (const directory of draftDirectories) {
    setIndexValueIfAbsent(draftDirectoryById, directory.id, directory);
    setIndexValueIfAbsent(
      draftDirectoryByWorkspaceId,
      directory.workspaceId,
      directory
    );
    setIndexValueIfAbsent(
      preferredResourceIdByWorkspaceId,
      directory.workspaceId,
      directory.id
    );
    setIndexValueIfAbsent(
      workspaceIdByResourceId,
      directory.id,
      directory.workspaceId
    );
  }

  for (const document of workspaceDocuments) {
    setIndexValueIfAbsent(workspaceDocumentById, document.id, document);
    if (!document.workspaceId) continue;
    setIndexValueIfAbsent(
      preferredResourceIdByWorkspaceId,
      document.workspaceId,
      document.id
    );
    if (document.domain === "creation") {
      setIndexValueIfAbsent(
        workspaceIdByResourceId,
        document.id,
        document.workspaceId
      );
    }
  }

  const visit = (
    nodes: readonly ResourceTreeNode[],
    creationSection: boolean
  ): void => {
    for (const node of nodes) {
      setIndexValueIfAbsent(resourceNodeById, node.id, node);
      setIndexValueIfAbsent(resourceIdByDocumentId, node.id, node.id);
      if (node.targetDocumentId) {
        setIndexValueIfAbsent(
          resourceIdByDocumentId,
          node.targetDocumentId,
          node.id
        );
      }
      if (node.characterStateDocumentId) {
        setIndexValueIfAbsent(
          resourceIdByDocumentId,
          node.characterStateDocumentId,
          node.id
        );
      }
      const targetDocumentId =
        node.targetDocumentId ??
        (node.stageCategoryId === "draft"
          ? node.children?.find((child) => child.targetDocumentId)
              ?.targetDocumentId
          : undefined) ??
        node.id;
      setIndexValueIfAbsent(
        resourceTargetDocumentIdById,
        node.id,
        targetDocumentId
      );

      if (creationSection) {
        if (
          node.catalogNodeType === "book" &&
          draftDirectoryByWorkspaceId.has(node.id)
        ) {
          setIndexValueIfAbsent(workspaceIdByResourceId, node.id, node.id);
        }
        if (node.targetDocumentId) {
          const target = workspaceDocumentById.get(node.targetDocumentId);
          if (target?.domain === "creation" && target.workspaceId) {
            setIndexValueIfAbsent(
              workspaceIdByResourceId,
              node.id,
              target.workspaceId
            );
          }
        }
      }
      visit(node.children ?? [], creationSection);
    }
  };

  for (const section of resourceSections) {
    visit(section.nodes, section.id === "creation");
  }

  return {
    resourceNodeById,
    workspaceDocumentById,
    resourceIdByDocumentId,
    resourceTargetDocumentIdById,
    draftDirectoryById,
    draftDirectoryByWorkspaceId,
    preferredResourceIdByWorkspaceId,
    workspaceIdByResourceId
  };
}
