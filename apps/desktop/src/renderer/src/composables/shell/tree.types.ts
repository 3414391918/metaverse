import { useWorkspaceResourceTreeCoordinator } from "../../composables/useWorkspaceResourceTreeCoordinator";
export interface TreeRuntime {
  collectResourceNodeIds: ReturnType<
    typeof useWorkspaceResourceTreeCoordinator
  >["collectResourceNodeIds"];
  longBookResourceNodes: ReturnType<
    typeof useWorkspaceResourceTreeCoordinator
  >["longBookResourceNodes"];
  preferredLongResourceIdForSelection: ReturnType<
    typeof useWorkspaceResourceTreeCoordinator
  >["preferredLongResourceIdForSelection"];
  resourceTreeLookup: ReturnType<
    typeof useWorkspaceResourceTreeCoordinator
  >["resourceTreeLookup"];
  resourceTreeSections: ReturnType<
    typeof useWorkspaceResourceTreeCoordinator
  >["resourceTreeSections"];
  synchronizeSelectedLongResourceForLayout: ReturnType<
    typeof useWorkspaceResourceTreeCoordinator
  >["synchronizeSelectedLongResourceForLayout"];
}
