import { useLazyApprovalNavigationCoordinator } from "../../composables/useLazyApprovalNavigationCoordinator";
import { useWorkspaceResourceNavigation } from "../../composables/useWorkspaceResourceNavigation";
import type { EditorTextReferenceNavigation } from "../../types/conversation";
import type {
  EditorDraftState,
  WorkspaceDocument
} from "../../types/workspace";
import type { ApprovalNavigationTarget } from "../../utils/approvalNavigation";
export interface ResourcesRuntime {
  activeAgentDocument: ReturnType<
    typeof useWorkspaceResourceNavigation
  >["activeAgentDocument"];
  activeRightPanePreferenceKey: ReturnType<
    typeof useWorkspaceResourceNavigation
  >["activeRightPanePreferenceKey"];
  clearEditorSelectionReferences: ReturnType<
    typeof useWorkspaceResourceNavigation
  >["clearEditorSelectionReferences"];
  disposeWorkspaceResources: ReturnType<
    typeof useWorkspaceResourceNavigation
  >["dispose"];
  ensureCatalogDocumentLoaded: ReturnType<
    typeof useWorkspaceResourceNavigation
  >["ensureCatalogDocumentLoaded"];
  ensureCatalogDocumentsLoaded: ReturnType<
    typeof useWorkspaceResourceNavigation
  >["ensureCatalogDocumentsLoaded"];
  findResourceNodeIn: ReturnType<
    typeof useWorkspaceResourceNavigation
  >["findResourceNodeIn"];
  hydratedCatalogSnapshot: ReturnType<
    typeof useWorkspaceResourceNavigation
  >["hydratedCatalogSnapshot"];
  insertEditorSelectionReference: ReturnType<
    typeof useWorkspaceResourceNavigation
  >["insertEditorSelectionReference"];
  liveWorkspaceDocuments: ReturnType<
    typeof useWorkspaceResourceNavigation
  >["liveWorkspaceDocuments"];
  locateEditorSelectionReference: ReturnType<
    typeof useWorkspaceResourceNavigation
  >["locateEditorSelectionReference"];
  removeEditorSelectionReference: ReturnType<
    typeof useWorkspaceResourceNavigation
  >["removeEditorSelectionReference"];
  resourceNode: ReturnType<
    typeof useWorkspaceResourceNavigation
  >["resourceNode"];
  selectResource: ReturnType<
    typeof useWorkspaceResourceNavigation
  >["selectResource"];
  libraryCatalogContextDocuments: ReturnType<
    typeof useWorkspaceResourceNavigation
  >["libraryCatalogContextDocuments"];
  writingEditorViewModel: import("vue").ComputedRef<{
    document: Readonly<WorkspaceDocument>;
    resourceId: string;
    draftState: EditorDraftState | undefined;
    locateReference: EditorTextReferenceNavigation | undefined;
    locked: boolean;
    lockedLabel: string | undefined;
    saving: boolean;
    manualSaving: boolean;
    autoSaveEnabled: boolean;
    defaultViewMode: "edit" | "preview";
    entrySearchItems: import("./types/editorEntrySearch").EditorEntrySearchSource[];
  }>;
  navigateToApprovalTarget: (
    target: ApprovalNavigationTarget
  ) => Promise<boolean>;
  selectEditorEntrySearchResult: (documentId: string) => Promise<void>;
  prepareEditorEntrySearch: () => Promise<void>;
  selectLongEntrySearchResult: (fileId: string) => Promise<void>;
  disposeLazyApprovalNavigationCoordinator: ReturnType<
    typeof useLazyApprovalNavigationCoordinator
  >["dispose"];
  locateAcceptedEditProposal: (input: {
    runId: string;
    proposalId: string;
  }) => Promise<void>;
  activePromptDocument: ReturnType<
    typeof useWorkspaceResourceNavigation
  >["activePromptDocument"];
}
