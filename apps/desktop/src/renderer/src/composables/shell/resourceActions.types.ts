import type { BookTransferAction } from "../../components/BookTransferDialog.vue";
import type { ResourceSectionActionPayload } from "../../types/workspace";
export interface ResourceActionsRuntime {
  handleResourceAction: (
    payload: ResourceSectionActionPayload
  ) => Promise<void>;
  handleBookTransferSelect: (action: BookTransferAction) => void;
}
