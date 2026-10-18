import {
  SKILL_KINDS,
  type CatalogSnapshot,
  type SkillLibrary
} from "@deepwrite/contracts";
import type { ResourceTreeNode, WorkspaceDocument } from "../types/workspace";
import {
  catalogNodeId,
  catalogContentState,
  catalogContentPresent,
  skillEntryDocumentId,
  skillOverviewDocumentId
} from "./catalogContentProjection";
import {
  SKILL_KIND_LABELS,
  SKILL_STAGE_LABELS,
  SKILL_KIND_TAG_LABELS
} from "./catalogWorkspaceIndex";
import { missingLibraryNode } from "./materialLibraryProjection";
export function createSkillLibraryNode(
  library: SkillLibrary
): ResourceTreeNode {
  return {
    id: library.id,
    label: library.title,
    icon: "library",
    catalogNodeType: "library",
    libraryId: library.id,
    readOnly: library.isBuiltin,
    skillKind: library.skillKind,
    workspaceType: library.skillType,
    children: [
      {
        id: skillOverviewDocumentId(library.id),
        label: "库说明",
        icon: "file",
        muted: !catalogContentPresent(
          library,
          library.overview,
          "overviewContentBytes"
        ),
        catalogNodeType: "document",
        libraryId: library.id,
        workspaceType: library.skillType,
        readOnly: library.isBuiltin,
        skillKind: library.skillKind
      },
      ...library.entries.map((entry) => ({
        id: skillEntryDocumentId(library.id, entry.id),
        label: entry.title,
        icon: "wand" as const,
        catalogNodeType: "document" as const,
        libraryId: library.id,
        workspaceType: library.skillType,
        catalogEntryId: entry.id,
        readOnly: library.isBuiltin,
        skillKind: library.skillKind,
        stageCategoryId: entry.stageId
      }))
    ]
  };
}

export function createSkillDocuments(
  library: SkillLibrary
): WorkspaceDocument[] {
  const typeLabel = "技能";
  const readOnly = library.isBuiltin ? { readOnly: true as const } : {};
  return [
    {
      id: skillOverviewDocumentId(library.id),
      domain: "skill",
      title: `${library.title} · 库说明`,
      eyebrow: `${typeLabel} · ${SKILL_KIND_LABELS[library.skillKind]}`,
      path: [library.title, "库说明"],
      content: library.overview,
      ...catalogContentState(library, "overviewContentBytes"),
      format: "技能",
      catalogLibraryField: "overview",
      libraryId: library.id,
      ...(library.projectRevision === undefined
        ? {}
        : { catalogProjectRevision: library.projectRevision }),
      skillKind: library.skillKind,
      ...readOnly
    },
    ...library.entries.map((entry) => ({
      id: skillEntryDocumentId(library.id, entry.id),
      domain: "skill" as const,
      title: entry.title,
      eyebrow: `${typeLabel} · ${SKILL_KIND_LABELS[library.skillKind]}`,
      path: [
        library.title,
        SKILL_KIND_LABELS[library.skillKind],
        SKILL_STAGE_LABELS[entry.stageId],
        entry.title
      ],
      content: entry.body,
      ...catalogContentState(entry),
      format: "技能" as const,
      catalogEntryId: entry.id,
      libraryId: library.id,
      ...(library.projectRevision === undefined
        ? {}
        : { catalogProjectRevision: library.projectRevision }),
      skillKind: library.skillKind,
      stageCategoryId: entry.stageId,
      ...readOnly
    }))
  ];
}

export function createSkillGroupNodes(
  snapshot: CatalogSnapshot
): ResourceTreeNode[] {
  const librariesById = new Map(
    snapshot.skills.map((library) => [library.id, library])
  );
  return snapshot.skillGroups.map((group) => {
    const memberNodes = SKILL_KINDS.flatMap<ResourceTreeNode>((kind) => {
      const libraryId = group.members[kind];
      if (!libraryId) {
        return [];
      }
      const library = librariesById.get(libraryId);
      const node = library
        ? createSkillLibraryNode(library)
        : missingLibraryNode("skill", libraryId);
      return [
        { ...node, categoryTag: SKILL_KIND_TAG_LABELS[kind], groupId: group.id }
      ];
    });
    return {
      id: catalogNodeId("skill-group", group.id),
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
