import { SKILL_KINDS, type CatalogSnapshot } from "@deepwrite/contracts";
import type { ResourceTreeNode, ResourceTreeSection } from "../types/workspace";
import {
  createMaterialGroupNodes,
  createMaterialKindNode,
  createMaterialDocuments
} from "./materialLibraryProjection";
import {
  createSkillGroupNodes,
  createSkillLibraryNode,
  createSkillDocuments
} from "./skillLibraryProjection";
import { catalogNodeId } from "./catalogContentProjection";
import {
  MATERIAL_TREE_KIND_ORDER,
  SKILL_KIND_LABELS,
  createCatalogWorkspaceProjectionIndex,
  type CatalogWorkspaceProjection,
  type DraftDirectoryProjection
} from "./catalogWorkspaceIndex";
export * from "./catalogWorkspaceIndex";

/**
 * Projects the persisted catalog into the renderer's generic resource trees and
 * editor documents. A library owned by a group is shown only inside that group;
 * dissolving or changing the group makes it return to its canonical kind.
 */
export function projectCatalogWorkspace(
  snapshot: CatalogSnapshot
): CatalogWorkspaceProjection {
  const materialGroupNodes = createMaterialGroupNodes(snapshot);
  const groupedMaterialLibraryIds = new Set(
    snapshot.materialGroups.flatMap((group) =>
      Object.values(group.members).filter((libraryId): libraryId is string =>
        Boolean(libraryId)
      )
    )
  );
  const materialKindNodes = MATERIAL_TREE_KIND_ORDER.flatMap<ResourceTreeNode>(
    (kind) => {
      const libraries = snapshot.materials.filter(
        (library) =>
          !groupedMaterialLibraryIds.has(library.id) &&
          (library.materialKind === kind ||
            (kind === "other" && library.materialKind === "mixed"))
      );
      return libraries.length ? [createMaterialKindNode(kind, libraries)] : [];
    }
  );
  const skillGroupNodes = createSkillGroupNodes(snapshot);
  const groupedSkillLibraryIds = new Set(
    snapshot.skillGroups.flatMap((group) =>
      Object.values(group.members).filter((libraryId): libraryId is string =>
        Boolean(libraryId)
      )
    )
  );
  const diagnosticSkillNodes: ResourceTreeNode[] = (
    snapshot.projectDiagnostics ?? []
  )
    .filter(({ kind }) => kind === "deepwrite.skill-library")
    .map((diagnostic) => ({
      id: diagnostic.projectId,
      label: `无法读取的技能库（${diagnostic.projectId}）`,
      icon: "library",
      badge: diagnostic.code === "unavailable" ? "不可用" : "配置损坏",
      muted: true,
      unavailable: true,
      catalogNodeType: "library",
      libraryId: diagnostic.projectId
    }));
  const diagnosticMaterialNodes: ResourceTreeNode[] = (
    snapshot.projectDiagnostics ?? []
  )
    .filter(({ kind }) => kind === "deepwrite.material-library")
    .map((diagnostic) => ({
      id: diagnostic.projectId,
      label: `无法读取的素材库（${diagnostic.projectId}）`,
      icon: "archive",
      badge: diagnostic.code === "unavailable" ? "不可用" : "配置损坏",
      muted: true,
      unavailable: true,
      catalogNodeType: "library",
      libraryId: diagnostic.projectId
    }));
  const skillKindNodes = SKILL_KINDS.flatMap<ResourceTreeNode>((kind) => {
    const libraries = snapshot.skills.filter(
      (library) =>
        library.skillKind === kind && !groupedSkillLibraryIds.has(library.id)
    );
    return libraries.length
      ? [
          {
            id: catalogNodeId("skill-kind", kind),
            label: SKILL_KIND_LABELS[kind],
            icon: "library",
            badge: String(libraries.length),
            catalogNodeType: "category",
            skillKind: kind,
            children: libraries.map(createSkillLibraryNode)
          }
        ]
      : [];
  });

  const resourceSections: ResourceTreeSection[] = [
    {
      id: "creation",
      label: "创作空间",
      icon: "book",
      nodes: []
    },
    {
      id: "skill",
      label: "技能库",
      icon: "library",
      nodes: [...diagnosticSkillNodes, ...skillGroupNodes, ...skillKindNodes]
    },
    {
      id: "material",
      label: "素材库",
      icon: "archive",
      nodes: [
        ...diagnosticMaterialNodes,
        ...materialGroupNodes,
        ...materialKindNodes
      ]
    }
  ];
  const workspaceDocuments = [
    ...snapshot.skills.flatMap(createSkillDocuments),
    ...snapshot.materials.flatMap(createMaterialDocuments)
  ];
  const draftDirectories: DraftDirectoryProjection[] = [];

  return {
    resourceSections,
    workspaceDocuments,
    draftDirectories,
    index: createCatalogWorkspaceProjectionIndex(
      resourceSections,
      workspaceDocuments,
      draftDirectories
    )
  };
}

export const buildCatalogWorkspace = projectCatalogWorkspace;
