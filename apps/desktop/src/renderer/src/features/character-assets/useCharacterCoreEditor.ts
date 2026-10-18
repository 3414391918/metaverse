import { characterApi } from "./character-api";
import { computed, ref } from "vue";
import type {
  LongWorkspaceSelection,
  LongWorkspaceSelectionFile
} from "../../types/longWorkspace";
import type { LongWriteDocumentResult } from "@deepwrite/contracts";
import { uiMessage } from "../../ui-feedback";
export interface CharacterCoreEditorPort {
  prepareLeave(): Promise<boolean>;
  saveAll(): Promise<boolean>;
}
export function useCharacterCoreEditor(options: {
  bookId: () => string;
  selection: () => LongWorkspaceSelection | null;
  file: () => LongWorkspaceSelectionFile | null | undefined;
  reload: () => Promise<void>;
  saved: (result: LongWriteDocumentResult) => void;
}) {
  const editor = ref<CharacterCoreEditorPort | null>(null);
  const dirty = ref(false);
  const active = computed(
    () =>
      options.selection()?.root === "character_design" &&
      Boolean(options.selection()?.characterId) &&
      options.file()?.role === "core-profile"
  );
  async function saved() {
    const file = options.file()?.file;
    if (!file) return;
    try {
      const result = await characterApi().open({ bookId: options.bookId() });
      options.saved({
        bookId: options.bookId(),
        file,
        summary: result.summary
      });
      await options.reload();
    } catch (e) {
      uiMessage.warning(
        e instanceof Error ? e.message : "档案已保存，请刷新人物列表"
      );
    }
  }
  return { editor, dirty, active, saved };
}
