import {
  type CatalogIndexSnapshot,
  type CatalogSnapshot,
  type GeneralPermissionMode,
  type LibraryAgentDomain,
  type LibraryAgentSettings
} from "@deepwrite/contracts";
import { computed, type ComputedRef, type Ref } from "vue";
import type { AgentConversationController } from "./useAgentConversation";
import type {
  ComposerReferenceOption,
  EditorTextReference
} from "../types/conversation";
import type { WorkspaceDocument } from "../types/workspace";

export function composerStageLabel(
  descriptor: LibraryConversationDocumentDescriptor
): string {
  if (descriptor.domain === "skill") return "技能库";
  if (descriptor.domain === "material") return "素材库";
  return "未选择阶段";
}

interface LibraryConversationNotifications {
  info(message: string): void;
  warning(message: string): void;
  error(message: string): void;
}

interface LibraryConversationQueuedEdit {
  conversation: AgentConversationController;
  sessionId: string;
}

interface LibraryConversationDocumentDescriptor {
  id: string;
  domain: WorkspaceDocument["domain"];
  title: string;
  pathRoot: string;
  workspaceTitle?: string;
  workspaceType?: WorkspaceDocument["workspaceType"];
  libraryId?: string;
  catalogEntryId?: string;
}

export interface LibraryConversationSendTarget {
  requestId: number;
  conversation: AgentConversationController;
  conversationKey: string;
  sessionId: string;
  selectedResourceId: string;
  documentId: string;
  draft: string;
}

export interface LibraryConversationCoordinatorOptions {
  runtime: {
    conversationForKey(
      key: string,
      scope?: string
    ): AgentConversationController;
    synchronizeSessionModelSelection(source: AgentConversationController): void;
    synchronizeRunPreferences(
      scope: string,
      source: AgentConversationController
    ): void;
  };
  resource: {
    selectedResourceId: Ref<string>;
    activeAgentDocument: Readonly<Ref<WorkspaceDocument>>;
    activePromptDocument: Readonly<Ref<WorkspaceDocument>>;
    liveWorkspaceDocuments: Readonly<Ref<WorkspaceDocument[]>>;
    pendingEditorReferences: Readonly<Ref<EditorTextReference[]>>;
    leftCollapsed: Readonly<Ref<boolean>>;
    rightCollapsed: Readonly<Ref<boolean>>;
    clearEditorSelectionReferences(): void;
    contextDocuments(): WorkspaceDocument[];
    ensureDocumentsLoaded(
      documents: readonly WorkspaceDocument[]
    ): Promise<boolean>;
    hydratedCatalogSnapshot(): CatalogSnapshot | null;
  };
  catalog: {
    snapshot: Readonly<Ref<CatalogIndexSnapshot | null>>;
  };
  profiles: {
    libraryAgents: Readonly<Ref<LibraryAgentSettings>>;
  };
  edits: {
    acceptingDocumentIds: Readonly<Ref<Set<string>>>;
    acceptingWorkspaceIds: Readonly<Ref<Set<string>>>;
    hasQueued(): boolean;
    schedule(
      predicate: (queued: LibraryConversationQueuedEdit) => boolean
    ): void;
    resumeRecovered(
      conversations: readonly AgentConversationController[]
    ): void;
  };
  settings: {
    permissionMode(): GeneralPermissionMode;
    updatePermissionMode(mode: GeneralPermissionMode): void;
  };
  runtimeAvailable(): boolean;
  showConversation(): void;
  notifications: LibraryConversationNotifications;
}

export function descriptorFor(
  document: WorkspaceDocument
): LibraryConversationDocumentDescriptor {
  return {
    id: document.id,
    domain: document.domain,
    title: document.title,
    pathRoot: document.path[0] ?? "",
    ...(document.workspaceTitle
      ? { workspaceTitle: document.workspaceTitle }
      : {}),
    ...(document.workspaceType
      ? { workspaceType: document.workspaceType }
      : {}),
    ...(document.workspaceId ? { workspaceId: document.workspaceId } : {}),
    ...(document.stageId ? { stageId: document.stageId } : {}),
    ...(document.libraryId ? { libraryId: document.libraryId } : {}),
    ...(document.catalogEntryId
      ? { catalogEntryId: document.catalogEntryId }
      : {})
  };
}

export function descriptorSignature(
  descriptor: LibraryConversationDocumentDescriptor
): string {
  return [
    descriptor.id,
    descriptor.domain,
    descriptor.title,
    descriptor.pathRoot,
    descriptor.workspaceTitle ?? "",
    descriptor.workspaceType ?? "",
    descriptor.libraryId ?? "",
    descriptor.catalogEntryId ?? ""
  ].join("\u0000");
}

export function stableDocumentDescriptor(
  source: Readonly<Ref<WorkspaceDocument>>
): ComputedRef<LibraryConversationDocumentDescriptor> {
  let previous: LibraryConversationDocumentDescriptor | undefined;
  let previousSignature = "";
  return computed(() => {
    const next = descriptorFor(source.value);
    const signature = descriptorSignature(next);
    if (previous && signature === previousSignature) return previous;
    previous = next;
    previousSignature = signature;
    return next;
  });
}

export function catalogDocumentId(
  domain: "material" | "skill",
  libraryId: string,
  entryId: string
): string {
  return ["catalog", `${domain}-entry`, libraryId, entryId]
    .map((part) => encodeURIComponent(part))
    .join(":");
}

export function libraryEntryReferences(
  snapshot: CatalogIndexSnapshot | null,
  descriptor: LibraryConversationDocumentDescriptor,
  domain: LibraryAgentDomain | undefined
): ComposerReferenceOption[] {
  if (!snapshot || !domain || !descriptor.libraryId) return [];
  const libraries =
    domain === "material" ? snapshot.materials : snapshot.skills;
  const groups =
    domain === "material" ? snapshot.materialGroups : snapshot.skillGroups;
  const current = libraries.find(({ id }) => id === descriptor.libraryId);
  if (!current) return [];
  const group = groups.find((candidate) =>
    Object.values(candidate.members).includes(current.id)
  );
  const memberIds = group
    ? [
        current.id,
        ...Object.values(group.members).filter(
          (id): id is string => Boolean(id) && id !== current.id
        )
      ]
    : [current.id];
  const references: ComposerReferenceOption[] = [];
  for (const libraryId of memberIds) {
    const library = libraries.find(({ id }) => id === libraryId);
    if (!library) continue;
    for (const entry of library.entries) {
      if (library.id === current.id && entry.id === descriptor.catalogEntryId) {
        continue;
      }
      references.push({
        id: catalogDocumentId(domain, library.id, entry.id),
        label: entry.title,
        detail:
          library.id === current.id
            ? group
              ? `当前${domain === "skill" ? "技能" : "素材"}库 · ${group.title}`
              : `当前${domain === "skill" ? "技能" : "素材"}库`
            : `分组 · ${library.title}`
      });
    }
  }
  return references;
}
