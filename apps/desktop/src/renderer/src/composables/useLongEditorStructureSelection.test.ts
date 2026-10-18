import { computed, effectScope, reactive, ref } from "vue";
import { describe, expect, it, vi } from "vitest";
import {
  createLongContinuitySelection,
  reconcileLongWorkspaceSelection
} from "../types/longWorkspace";
import { fixture } from "../types/longWorkspace.test-support";
import { useLongEditorStructureSelection } from "./useLongEditorStructureSelection";

describe("long editor selection after save", () => {
  it.each([
    ["ledger", "character-state"],
    ["ledger", "handoff"]
  ] as const)(
    "preserves %s / %s when the workspace refreshes",
    async (root, role) => {
      const { summary, workspaceIndex } = fixture("commit_one");
      const selection = createLongContinuitySelection(
        summary,
        workspaceIndex,
        "chapter_one"
      )!;
      const props = reactive({ bookId: summary.id, selection, workspaceIndex });
      const selectedFile = selection.files.find(
        (entry) => entry.role === role
      )!;
      const scope = effectScope();
      try {
        const editor = scope.run(() =>
          useLongEditorStructureSelection({
            props,
            host: {
              currentReadOnly: computed(() => false),
              currentIsPlotPointStoryline: computed(() => false),
              currentStructureTitleTarget: computed(() => null),
              currentStructureTitleReadOnly: computed(() => false),
              currentWorldbuildingItem: computed(() => null),
              currentEmptyCollection: computed(() => null),
              currentIsCharacterDocument: computed(() => false),
              currentIsBookLineWorkspace: computed(() => false),
              resetEditorHistory: vi.fn(),
              loadWorkspaceDocument: vi.fn(async () => undefined),
              saveAllChanges: vi.fn(async () => true),
              updateCurrentContent: vi.fn()
            },
            emit: vi.fn(),
            currentWorldbuildingItems: computed(() => []),
            currentWorldbuildingListState: computed(() => ({
              items: [],
              error: null
            })),
            currentStoryPlots: computed(() => []),
            currentPlotPoint: computed(() => null),
            orderedBookLineVolumes: computed(() => []),
            currentCharacterNavigationItems: computed(() => []),
            documentStates: ref({
              [selectedFile.file.id]: {
                bookId: summary.id,
                file: selectedFile.file,
                content: "验收记录",
                savedContent: "验收记录",
                loading: false,
                saving: false,
                loaded: true,
                loadError: null
              }
            }),
            resetTextViewMode: vi.fn(),
            stateKey: (fileId) => fileId
          })
        )!;
        await editor.selectWorkspaceFile(selectedFile.file.id);
        expect(editor.currentSelectionFile.value?.file.id).toBe(
          selectedFile.file.id
        );

        props.selection = reconcileLongWorkspaceSelection(
          summary,
          workspaceIndex,
          props.selection
        )!;
        expect(editor.currentSelectionFile.value?.file.id).toBe(
          selectedFile.file.id
        );
        expect(editor.activeRole.value).toBe(role);

        props.selection = {
          ...props.selection,
          preferredFileId: selection.files[0]!.file.id
        };
        expect(editor.currentSelectionFile.value?.file.id).toBe(
          selection.files[0]!.file.id
        );
      } finally {
        scope.stop();
      }
    }
  );
});
