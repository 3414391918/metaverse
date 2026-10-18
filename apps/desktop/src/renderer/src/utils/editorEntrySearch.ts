import type { EditorEntrySearchSource } from "../types/editorEntrySearch";
import type { WorkspaceDocument } from "../types/workspace";

function searchEntryTitle(document: WorkspaceDocument): string {
  if (document.draftFileKind === "body") return `${document.title} · 正文`;
  if (document.draftFileKind === "character-state") {
    return `${document.title} · 人物状态`;
  }
  if (document.characterFileKind === "overview") return "人物概览";
  return document.title;
}

export function editorEntrySearchDocuments(
  documents: readonly WorkspaceDocument[],
  active: WorkspaceDocument
): WorkspaceDocument[] {
  const matchesScope = (candidate: WorkspaceDocument): boolean => {
    if (active.libraryId) return candidate.libraryId === active.libraryId;
    if (active.workspaceId && active.stageId) {
      return (
        candidate.workspaceId === active.workspaceId &&
        candidate.stageId === active.stageId
      );
    }
    return candidate.id === active.id;
  };

  return documents.filter(matchesScope);
}

export function editorEntrySearchSources(
  documents: readonly WorkspaceDocument[],
  active: WorkspaceDocument
): EditorEntrySearchSource[] {
  return editorEntrySearchDocuments(documents, active).map((document) => ({
    id: document.id,
    title: searchEntryTitle(document),
    content: document.content
  }));
}
