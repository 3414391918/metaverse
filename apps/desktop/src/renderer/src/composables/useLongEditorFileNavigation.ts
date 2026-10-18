import {
  nextTick,
  onScopeDispose,
  ref,
  watch,
  type ComputedRef,
  type Ref
} from "vue";
import type {
  LongWorkspaceFileRole,
  LongWorkspaceSelection,
  LongWorkspaceSelectionFile
} from "../types/longWorkspace";
import type { LongApprovalEditorFocus } from "../utils/approvalNavigation";
import type { LongDocumentState } from "./useLongEditorDocumentSession";

export function useLongEditorFileNavigation(options: {
  props: { bookId: string; selection: LongWorkspaceSelection | null };
  activeRole: Ref<LongWorkspaceFileRole>;
  activeFileId: Ref<string | null>;
  currentSelectionFile: ComputedRef<LongWorkspaceSelectionFile | undefined>;
  documentStates: Ref<Record<string, LongDocumentState>>;
  stateKey: (fileId: string, bookId?: string) => string;
  loadWorkspaceDocument: (file: LongWorkspaceSelectionFile) => Promise<void>;
  saveAllChanges: () => Promise<boolean>;
  resetTextViewMode: (forcePreview?: boolean) => void;
  selectWorldbuildingItem: (itemId: string) => Promise<void>;
  selectWorldbuildingOverview: () => Promise<void>;
  selectPlotPointTab: (
    tab: "summary" | "storyline" | "foreshadowing"
  ) => Promise<void>;
  selectStoryPlot: (storyPlotId: string) => Promise<void>;
  selectBookLineVolume: (volumeId: string) => void;
  focusForeshadowing: (
    threadId?: string,
    beatId?: string
  ) => Promise<boolean | undefined>;
}) {
  const { props, activeRole, activeFileId, currentSelectionFile } = options;
  const pendingRole = ref<LongWorkspaceFileRole | null>(null);
  const pendingFileId = ref<string | null>(null);
  let request = 0;
  let disposed = false;
  const contextKey = () =>
    JSON.stringify([
      props.bookId,
      props.selection?.key,
      props.selection?.characterId,
      props.selection?.preferredRole,
      props.selection?.preferredFileId
    ]);
  const isCharacterCoreProfile = () =>
    props.selection?.root === "character_design" &&
    Boolean(props.selection.characterId) &&
    currentSelectionFile.value?.role === "core-profile";
  function isCurrent(version: number, context: string) {
    return !disposed && request === version && contextKey() === context;
  }
  function clearPending(version: number) {
    if (request !== version) return;
    pendingRole.value = null;
    pendingFileId.value = null;
  }

  async function selectRole(role: LongWorkspaceFileRole): Promise<void> {
    if (role === activeRole.value || role === pendingRole.value) return;
    const selectedFile = props.selection?.files.find(
      (file) => file.role === role
    );
    if (selectedFile) {
      await selectWorkspaceFile(selectedFile.file.id);
      return;
    }
    const context = contextKey();
    const version = ++request;
    pendingRole.value = role;
    pendingFileId.value = null;
    try {
      if (isCharacterCoreProfile() && !(await options.saveAllChanges())) return;
      if (!isCurrent(version, context)) return;
      activeRole.value = role;
      activeFileId.value = null;
    } finally {
      clearPending(version);
    }
  }

  async function selectWorkspaceFile(fileId: string): Promise<void> {
    if (fileId === activeFileId.value || fileId === pendingFileId.value) return;
    const selectedFile = props.selection?.files.find(
      ({ file }) => file.id === fileId
    );
    if (!selectedFile) return;
    const bookId = props.bookId;
    const context = contextKey();
    const version = ++request;
    pendingRole.value = selectedFile.role;
    pendingFileId.value = fileId;
    const targetStillExists = () =>
      props.selection?.files.some(
        (item) =>
          item.file.id === fileId &&
          item.file.path === selectedFile.file.path &&
          item.role === selectedFile.role
      );
    try {
      // Core-profile drafts live in the form component, so leaving it must
      // finish its save/discard/cancel handshake before loading another file.
      if (isCharacterCoreProfile() && !(await options.saveAllChanges())) return;
      if (!isCurrent(version, context) || !targetStillExists()) return;
      await options.loadWorkspaceDocument(selectedFile);
      if (!isCurrent(version, context) || !targetStillExists()) return;
      const state =
        options.documentStates.value[options.stateKey(fileId, bookId)];
      if (state?.loaded || Boolean(state?.content)) {
        activeRole.value = selectedFile.role;
        activeFileId.value = fileId;
        options.resetTextViewMode(selectedFile.readOnly);
      }
    } finally {
      clearPending(version);
    }
  }

  async function focusFile(fileId: string): Promise<boolean> {
    const selection = props.selection;
    if (!selection?.files.some(({ file }) => file.id === fileId)) return false;
    const context = contextKey();
    if (selection.worldbuildingFormat === "list") {
      const item = selection.worldbuildingItems?.find(
        ({ file }) => file.id === fileId
      );
      if (item) await options.selectWorldbuildingItem(item.id);
      else await options.selectWorldbuildingOverview();
    } else {
      const storyPlot = selection.storyPlots?.find(
        ({ file }) => file.id === fileId
      );
      if (storyPlot) {
        await options.selectPlotPointTab("storyline");
        if (disposed || contextKey() !== context) return false;
        await options.selectStoryPlot(storyPlot.id);
      } else {
        await selectWorkspaceFile(fileId);
      }
    }
    return (
      !disposed &&
      contextKey() === context &&
      currentSelectionFile.value?.file.id === fileId
    );
  }

  async function focusTarget(
    target: LongApprovalEditorFocus
  ): Promise<boolean> {
    const context = contextKey();
    const hasSpecialFocus = Boolean(
      target.bookLineVolumeId ||
      target.foreshadowingThreadId ||
      target.foreshadowingBeatId
    );
    if (hasSpecialFocus && isCharacterCoreProfile()) {
      if (
        !(await options.saveAllChanges()) ||
        disposed ||
        contextKey() !== context
      )
        return false;
    }
    if (target.bookLineVolumeId)
      options.selectBookLineVolume(target.bookLineVolumeId);
    if (target.foreshadowingThreadId || target.foreshadowingBeatId) {
      await nextTick();
      if (disposed || contextKey() !== context) return false;
      if (
        !(await options.focusForeshadowing(
          target.foreshadowingThreadId,
          target.foreshadowingBeatId
        ))
      )
        return false;
      if (disposed || contextKey() !== context) return false;
    }
    return target.fileId ? focusFile(target.fileId) : true;
  }

  watch(
    contextKey,
    () => {
      request += 1;
      pendingRole.value = null;
      pendingFileId.value = null;
    },
    { flush: "sync" }
  );
  onScopeDispose(() => {
    disposed = true;
    request += 1;
  });
  return {
    pendingRole,
    pendingFileId,
    selectRole,
    selectWorkspaceFile,
    focusFile,
    focusTarget
  };
}
