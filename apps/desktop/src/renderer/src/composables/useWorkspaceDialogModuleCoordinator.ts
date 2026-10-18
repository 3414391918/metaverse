import type { WorkspaceDialogModuleCoordinatorOptions } from "./workspaceDialogState";
import { computed, type Ref } from "vue";
import type {
  WorkspaceDialogKind,
  WorkspaceDialogModule
} from "../components/WorkspaceDialogLayer.types";
export const WORKSPACE_DIALOG_PRIORITY = [
  "startup-alert",
  "save-conflict",
  "continuation-import",
  "legacy-sync",
  "create-long-character",
  "create-long-worldbuilding-item",
  "create-long-plot-point",
  "create-long-chapter-card",
  "delete-long-draft",
  "delete-long-tree",
  "delete-long-ledger-commit",
  "create-long-volume",
  "long-bindings",
  "long-rename",
  "long-removal",
  "long-structure",
  "export-long",
  "library-removal",
  "library-project",
  "external-library-import",
  "library-entry-move",
  "library-group",
  "create-book",
  "book-transfer"
] as const satisfies readonly WorkspaceDialogKind[];

/**
 * Projects coordinator-owned dialog intents into one low-frequency render
 * descriptor. It owns no transactions and deliberately stops reading state as
 * soon as the highest-priority active dialog is found.
 */
export function useWorkspaceDialogModuleCoordinator(
  options: WorkspaceDialogModuleCoordinatorOptions
): Readonly<Ref<WorkspaceDialogModule | null>> {
  return computed<WorkspaceDialogModule | null>(() => {
    const startupMessages = options.startup.messages.value;
    if (startupMessages.length > 0) {
      return {
        kind: "startup-alert",
        messages: startupMessages
      };
    }

    const conflict = options.save.conflict.value;
    if (conflict) {
      return {
        kind: "save-conflict",
        title: conflict.payload.title,
        draftContent: conflict.payload.content,
        diskContent: conflict.diskContent,
        submitting: options.save.submitting.value
      };
    }

    const continuationPreview = options.longLifecycle.continuationPreview.value;
    if (continuationPreview) {
      return {
        kind: "continuation-import",
        preview: continuationPreview,
        submitting: options.longLifecycle.mutationPending.value
      };
    }

    const legacyPreview = options.longLifecycle.legacyPreview.value;
    const legacyResult = options.longLifecycle.legacyResult.value;
    if (legacyPreview || legacyResult) {
      return {
        kind: "legacy-sync",
        preview: legacyPreview,
        result: legacyResult,
        pending: options.longLifecycle.mutationPending.value
      };
    }

    const characterCreation = options.longStructure.characterCreation.value;
    if (characterCreation) {
      return {
        kind: "create-long-character",
        groupLabel: characterCreation.groupLabel,
        pending: options.longLifecycle.bookActionPending.value
      };
    }

    const worldbuildingItemCreation =
      options.longStructure.worldbuildingItemCreation.value;
    if (worldbuildingItemCreation) {
      return {
        kind: "create-long-worldbuilding-item",
        categoryTitle: worldbuildingItemCreation.categoryTitle,
        pending: options.longLifecycle.bookActionPending.value
      };
    }

    const plotPointCreation = options.longStructure.plotPointCreation.value;
    if (plotPointCreation) {
      return {
        kind: "create-long-plot-point",
        volumeTitle: plotPointCreation.volumeTitle,
        pending: options.longLifecycle.bookActionPending.value
      };
    }

    const chapterCardCreation = options.longStructure.chapterCardCreation.value;
    if (chapterCardCreation) {
      return {
        kind: "create-long-chapter-card",
        volumeTitle: chapterCardCreation.volumeTitle,
        arcOptions: chapterCardCreation.arcOptions,
        source: chapterCardCreation.source,
        pending: options.longLifecycle.bookActionPending.value
      };
    }

    const draftDeletion = options.longStructure.draftDeletion.value;
    if (draftDeletion) {
      return {
        kind: "delete-long-draft",
        sectionTitle: draftDeletion.title,
        description: draftDeletion.description,
        pending: options.longLifecycle.bookActionPending.value
      };
    }

    const treeDeletion = options.longStructure.treeDeletion.value;
    if (treeDeletion) {
      return {
        kind: "delete-long-tree",
        sectionTitle: treeDeletion.title,
        itemLabel: treeDeletion.label,
        description: treeDeletion.description,
        pending: options.longLifecycle.bookActionPending.value
      };
    }

    const ledgerCommitDeletion =
      options.longStructure.ledgerCommitDeletion.value;
    if (ledgerCommitDeletion) {
      return {
        kind: "delete-long-ledger-commit",
        title: ledgerCommitDeletion.title,
        chapterCount: ledgerCommitDeletion.chapterCardIds.length,
        pending: options.longLifecycle.bookActionPending.value
      };
    }

    const volumeCreation = options.longStructure.volumeCreation.value;
    if (volumeCreation) {
      return {
        kind: "create-long-volume",
        source: volumeCreation.source,
        pending: options.longLifecycle.bookActionPending.value
      };
    }

    const bindingsMode = options.longLifecycle.bindingsMode.value;
    if (bindingsMode) {
      const summary = options.longLifecycle.activeBookSummary.value;
      if (summary) {
        const snapshot = options.catalog.snapshot.value;
        return {
          kind: "long-bindings",
          mode: bindingsMode,
          bookTitle: summary.title,
          materials: snapshot?.materials ?? [],
          skills: snapshot?.skills ?? [],
          linkedMaterialIdsByKind: summary.linkedMaterialIdsByKind,
          linkedSkillIdsByKind: summary.linkedSkillIdsByKind,
          linkedResourceStageScopes: summary.linkedResourceStageScopes ?? {
            materials: {},
            skills: {}
          },
          submitting: options.longLifecycle.bookActionPending.value
        };
      }
    }

    const renameTarget = options.longLifecycle.renameTarget.value;
    if (renameTarget) {
      return {
        kind: "long-rename",
        title: renameTarget.title,
        pending: options.longLifecycle.bookActionPending.value
      };
    }

    const removalTarget = options.longLifecycle.removalTarget.value;
    if (removalTarget) {
      return {
        kind: "long-removal",
        action: removalTarget.action,
        title: removalTarget.title,
        pending: options.longLifecycle.bookActionPending.value
      };
    }

    if (options.longStructure.dialogOpen.value) {
      return {
        kind: "long-structure",
        bookTitle: options.longLifecycle.activeBookSummary.value?.title ?? "",
        bookId: options.longLifecycle.activeBookId.value,
        agentsMd: options.longStructure.agentsMd.value,
        agentsMdPending: options.longStructure.agentsMdPending.value,
        syncBookOptions: options.longStructure.syncBookOptions.value,
        snapshot: options.longLifecycle.workspaceIndex.value,
        pending: options.longLifecycle.bookActionPending.value
      };
    }

    const longExportTarget = options.longLifecycle.exportTarget.value;
    if (longExportTarget) {
      return {
        kind: "export-long",
        bookTitle: longExportTarget.title,
        bookId: longExportTarget.bookId,
        submitting: options.longLifecycle.manuscriptExportPending.value
      };
    }

    const libraryRemoval = options.library.removalDialog.value;
    if (libraryRemoval) {
      return {
        kind: "library-removal",
        action: libraryRemoval.action,
        domain: libraryRemoval.payload.domain,
        label: libraryRemoval.payload.node.label,
        submitting: options.catalog.mutationPending.value
      };
    }

    const libraryProject = options.library.projectDialog.value;
    if (libraryProject) {
      return {
        kind: "library-project",
        operation: libraryProject.operation,
        domain: libraryProject.domain,
        ...(libraryProject.libraryId
          ? { libraryId: libraryProject.libraryId }
          : {}),
        ...(libraryProject.libraryTitle
          ? { libraryTitle: libraryProject.libraryTitle }
          : {}),
        ...(libraryProject.materialKind
          ? { materialKind: libraryProject.materialKind }
          : {}),
        ...(libraryProject.entryId ? { entryId: libraryProject.entryId } : {}),
        ...(libraryProject.entryTitle
          ? { entryTitle: libraryProject.entryTitle }
          : {}),
        ...(libraryProject.workspaceType
          ? { workspaceType: libraryProject.workspaceType }
          : {}),
        submitting: options.catalog.mutationPending.value
      };
    }

    const externalLibraryImport =
      options.library.externalLibraryImportDialog.value;
    if (externalLibraryImport) {
      const snapshot = options.catalog.snapshot.value;
      const libraries =
        externalLibraryImport.domain === "skill"
          ? (snapshot?.skills ?? []).filter((library) => !library.isBuiltin)
          : (snapshot?.materials ?? []);
      return {
        kind: "external-library-import",
        domain: externalLibraryImport.domain,
        libraries,
        ...(externalLibraryImport.preselectedLibraryId
          ? {
              preselectedLibraryId: externalLibraryImport.preselectedLibraryId
            }
          : {}),
        ...(externalLibraryImport.selection
          ? { selection: externalLibraryImport.selection }
          : {}),
        pending: options.catalog.mutationPending.value
      };
    }

    const entryMove = options.library.entryMove.value;
    if (entryMove) {
      return {
        kind: "library-entry-move",
        entryTitle: entryMove.entryTitle,
        targetLibraryTitle: entryMove.targetLibraryTitle,
        options: options.catalog.materialStageOptions(
          entryMove.targetMaterialKind
        ),
        initialStageId: entryMove.initialStageId,
        submitting: options.catalog.mutationPending.value
      };
    }

    const groupDialog = options.library.groupDialog.value;
    if (groupDialog) {
      const snapshot = options.catalog.snapshot.value;
      return {
        kind: "library-group",
        domain: groupDialog.domain,
        group: options.library.activeGroup.value,
        materials: snapshot?.materials ?? [],
        materialGroups: snapshot?.materialGroups ?? [],
        skills: snapshot?.skills ?? [],
        skillGroups: snapshot?.skillGroups ?? [],
        submitting: options.catalog.mutationPending.value
      };
    }

    if (options.creation.createDialogOpen.value) {
      const snapshot = options.catalog.snapshot.value;
      return {
        kind: "create-book",
        materials: snapshot?.materials ?? [],
        materialGroups: snapshot?.materialGroups ?? [],
        skills: snapshot?.skills ?? [],
        skillGroups: snapshot?.skillGroups ?? [],
        loading: options.catalog.loading.value,
        submitting:
          options.catalog.mutationPending.value ||
          options.longLifecycle.mutationPending.value
      };
    }

    const transferMode = options.creation.transferMode.value;
    if (transferMode) {
      return {
        kind: "book-transfer",
        mode: transferMode,
        pending:
          options.catalog.mutationPending.value ||
          options.longLifecycle.mutationPending.value
      };
    }

    return null;
  });
}

export type {
  WorkspaceDialogStartupState,
  WorkspaceDialogSaveState,
  WorkspaceDialogLongStructureState,
  WorkspaceDialogLongLifecycleState,
  WorkspaceDialogLibraryState,
  WorkspaceDialogCatalogState,
  WorkspaceDialogModuleCoordinatorOptions
} from "./workspaceDialogState";
