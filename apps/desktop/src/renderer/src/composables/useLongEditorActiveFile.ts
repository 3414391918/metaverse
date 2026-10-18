import { ref, watch } from "vue";
import type {
  LongWorkspaceFileRole,
  LongWorkspaceSelection
} from "../types/longWorkspace";

export function useLongEditorActiveFile(props: {
  bookId: string;
  selection: LongWorkspaceSelection | null;
}) {
  const activeRole = ref<LongWorkspaceFileRole>("content");
  const activeFileId = ref<string | null>(null);

  // A refreshed snapshot is not navigation: compare the individual targets.
  watch(
    [
      () => props.bookId,
      () => props.selection?.key,
      () => props.selection?.preferredRole,
      () => props.selection?.preferredFileId
    ],
    () => {
      const preferredRole = props.selection?.preferredRole ?? "content";
      activeRole.value = preferredRole;
      activeFileId.value =
        props.selection?.preferredFileId ??
        props.selection?.files.find(({ role }) => role === preferredRole)?.file
          .id ??
        props.selection?.files[0]?.file.id ??
        null;
    },
    { immediate: true, flush: "sync" }
  );

  return { activeRole, activeFileId };
}
