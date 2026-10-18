import type { ShellRuntimePorts } from "./runtimePorts";
import type { TreeRuntime } from "./tree.types";
import { useWorkspaceResourceTreeCoordinator } from "../../composables/useWorkspaceResourceTreeCoordinator";
import { uiMessage } from "../../ui-feedback";
import { resourceSections } from "../../data/workspaceResourceSections";

/** tree assembly for the novel and library workspace. */
export function useShellTree(ports: ShellRuntimePorts): TreeRuntime {
  const {
    collectResourceNodeIds,
    longBookResourceNodes,
    preferredLongResourceIdForSelection,
    resourceTreeLookup,
    resourceTreeSections,
    synchronizeSelectedLongResourceForLayout
  } = useWorkspaceResourceTreeCoordinator({
    catalogProjection: ports.state.catalogProjection,
    fallbackSections: resourceSections,
    longBooks: ports.state.longBooks,
    longCatalogDiagnostics: ports.state.longCatalogDiagnostics,
    activeLongBookId: ports.state.activeLongBookId,
    activeLongWorkspaceIndex: ports.state.activeLongWorkspaceIndex,
    activeLongSelection: ports.state.activeLongSelection,
    selectedResourceId: ports.state.selectedResourceId,
    storage: () => window.localStorage,
    notifications: uiMessage
  });
  return {
    collectResourceNodeIds,
    longBookResourceNodes,
    preferredLongResourceIdForSelection,
    resourceTreeLookup,
    resourceTreeSections,
    synchronizeSelectedLongResourceForLayout
  };
}
