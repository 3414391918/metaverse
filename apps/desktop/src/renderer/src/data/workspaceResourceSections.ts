import type { ResourceTreeSection } from "../types/workspace";
/** Stable resource areas before the local catalog has loaded. */
export const resourceSections: ResourceTreeSection[] = [
  { id: "creation", label: "创作空间", icon: "book", nodes: [] },
  { id: "skill", label: "技能库", icon: "library", nodes: [] },
  { id: "material", label: "素材库", icon: "archive", nodes: [] }
];
