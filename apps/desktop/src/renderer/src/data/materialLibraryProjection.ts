import { MATERIAL_STAGE_KINDS } from "@deepwrite/contracts/renderer";
import {
  MATERIAL_KINDS,
  type CatalogSnapshot,
  type MaterialKind,
  type MaterialLibrary
} from "@deepwrite/contracts";
import type { ResourceTreeNode, WorkspaceDocument } from "../types/workspace";
import {
  catalogNodeId,
  catalogContentState,
  catalogContentPresent,
  materialEntryDocumentId,
  materialOverviewDocumentId
} from "./catalogContentProjection";
import {
  MATERIAL_KIND_LABELS,
  MATERIAL_STAGE_LABELS,
  MATERIAL_TREE_KIND_LABELS
} from "./catalogWorkspaceIndex";
export function materialGenreParts(library: MaterialLibrary): string[] {
  return [library.parentGenre.trim(), library.subGenre.trim()].filter(Boolean);
}

export function createMaterialLibraryNode(
  library: MaterialLibrary
): ResourceTreeNode {
  return {
    id: library.id,
    label: library.title,
    icon: "archive",
    catalogNodeType: "library",
    libraryId: library.id,
    ...(library.projectRevision === undefined
      ? {}
      : { projectRevision: library.projectRevision }),
    materialKind: library.materialKind,
    workspaceType: library.materialType,
    ...(library.parentGenre.trim()
      ? { parentGenre: library.parentGenre.trim() }
      : {}),
    ...(library.subGenre.trim() ? { subGenre: library.subGenre.trim() } : {}),
    children: [
      {
        id: materialOverviewDocumentId(library.id),
        label: "库介绍",
        icon: "file",
        muted: !catalogContentPresent(
          library,
          library.overview,
          "overviewContentBytes"
        ),
        catalogNodeType: "document",
        libraryId: library.id,
        workspaceType: library.materialType,
        ...(library.materialKind === "mixed"
          ? {}
          : { materialKind: library.materialKind })
      },
      ...library.entries.map((entry) => ({
        id: materialEntryDocumentId(library.id, entry.id),
        label: entry.title,
        icon: "file" as const,
        catalogNodeType: "document" as const,
        libraryId: library.id,
        workspaceType: library.materialType,
        catalogEntryId: entry.id,
        materialKind: MATERIAL_STAGE_KINDS[entry.stageId],
        stageCategoryId: entry.stageId,
        ...(library.parentGenre.trim()
          ? { parentGenre: library.parentGenre.trim() }
          : {}),
        ...(library.subGenre.trim()
          ? { subGenre: library.subGenre.trim() }
          : {})
      }))
    ]
  };
}

export function createMaterialDocuments(
  library: MaterialLibrary
): WorkspaceDocument[] {
  const typeLabel = "素材";
  const genreParts = materialGenreParts(library);
  const overviewKind =
    library.materialKind === "mixed" ? undefined : library.materialKind;
  const overview: WorkspaceDocument = {
    id: materialOverviewDocumentId(library.id),
    domain: "material",
    title: `${library.title} · 库介绍`,
    eyebrow: [
      typeLabel,
      ...genreParts,
      MATERIAL_KIND_LABELS[library.materialKind]
    ].join(" · "),
    path: [library.title, "库介绍"],
    content: library.overview,
    ...catalogContentState(library, "overviewContentBytes"),
    format: "素材",
    catalogLibraryField: "overview",
    libraryId: library.id,
    ...(library.projectRevision === undefined
      ? {}
      : { catalogProjectRevision: library.projectRevision }),
    ...(overviewKind ? { materialKind: overviewKind } : {}),
    ...(library.parentGenre.trim()
      ? { parentGenre: library.parentGenre.trim() }
      : {}),
    ...(library.subGenre.trim() ? { subGenre: library.subGenre.trim() } : {})
  };
  return [
    overview,
    ...library.entries.map((entry) => {
      const kind = MATERIAL_STAGE_KINDS[entry.stageId];
      return {
        id: materialEntryDocumentId(library.id, entry.id),
        domain: "material" as const,
        title: entry.title,
        eyebrow: [typeLabel, ...genreParts, MATERIAL_KIND_LABELS[kind]].join(
          " · "
        ),
        path: [
          library.title,
          MATERIAL_KIND_LABELS[kind],
          ...genreParts,
          MATERIAL_STAGE_LABELS[entry.stageId],
          entry.title
        ],
        content: entry.body,
        ...catalogContentState(entry),
        format: "素材" as const,
        catalogEntryId: entry.id,
        libraryId: library.id,
        ...(library.projectRevision === undefined
          ? {}
          : { catalogProjectRevision: library.projectRevision }),
        materialKind: kind,
        stageCategoryId: entry.stageId,
        ...(library.parentGenre.trim()
          ? { parentGenre: library.parentGenre.trim() }
          : {}),
        ...(library.subGenre.trim()
          ? { subGenre: library.subGenre.trim() }
          : {})
      };
    })
  ];
}

export function createMaterialKindNode(
  kind: MaterialKind,
  libraries: readonly MaterialLibrary[]
): ResourceTreeNode {
  return {
    id: catalogNodeId("material-kind", kind),
    label: MATERIAL_TREE_KIND_LABELS[kind],
    icon: "archive",
    badge: String(libraries.length),
    catalogNodeType: "category",
    materialKind: kind,
    children: libraries.map(createMaterialLibraryNode)
  };
}

export function missingLibraryNode(
  domain: "material" | "skill",
  libraryId: string
): ResourceTreeNode {
  return {
    id: catalogNodeId(domain, "missing-library", libraryId),
    label: `已丢失的${domain === "material" ? "素材" : "技能"}库（${libraryId}）`,
    icon: domain === "material" ? "archive" : "library",
    badge: "缺失",
    muted: true,
    missing: true,
    catalogNodeType: "library",
    libraryId
  };
}

export function createMaterialGroupNodes(
  snapshot: CatalogSnapshot
): ResourceTreeNode[] {
  const librariesById = new Map(
    snapshot.materials.map((library) => [library.id, library])
  );
  return snapshot.materialGroups.map((group) => {
    const seenLibraryIds = new Set<string>();
    const memberNodes = MATERIAL_KINDS.flatMap<ResourceTreeNode>((kind) => {
      const libraryId = group.members[kind];
      if (!libraryId || seenLibraryIds.has(libraryId)) {
        return [];
      }
      seenLibraryIds.add(libraryId);
      const library = librariesById.get(libraryId);
      const node = library
        ? createMaterialLibraryNode(library)
        : missingLibraryNode("material", libraryId);
      return [
        {
          ...node,
          categoryTag: MATERIAL_TREE_KIND_LABELS[kind],
          groupId: group.id
        }
      ];
    });
    return {
      id: catalogNodeId("material-group", group.id),
      label: group.title,
      icon: "folder",
      catalogNodeType: "group",
      groupId: group.id,
      ...(group.projectRevision === undefined
        ? {}
        : { projectRevision: group.projectRevision }),
      children: memberNodes
    };
  });
}
