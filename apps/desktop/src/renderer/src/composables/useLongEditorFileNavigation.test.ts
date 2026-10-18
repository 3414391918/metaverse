import { computed, effectScope, reactive, ref } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LongWorkspaceSelection } from "../types/longWorkspace";
import type { LongDocumentState } from "./useLongEditorDocumentSession";
import { useLongEditorStructureSelection } from "./useLongEditorStructureSelection";

const scopes: ReturnType<typeof effectScope>[] = [];
afterEach(() => scopes.splice(0).forEach((scope) => scope.stop()));

function selection(characterId = "character_one"): LongWorkspaceSelection {
  return {
    key: "character-group:protagonist",
    root: "character_design",
    characterId,
    characterGroup: "protagonist",
    title: "临时人物",
    breadcrumbs: ["人物设计", "临时人物"],
    preferredRole: "core-profile",
    files: [
      {
        role: "core-profile",
        label: "核心档案",
        file: {
          id: `${characterId}_core`,
          path: `long/characters/${characterId}/core-profile.md`,
          updatedAt: "2026-10-01T00:00:00.000Z"
        }
      },
      {
        role: "relationships",
        label: "人物关系",
        file: {
          id: `${characterId}_relationships`,
          path: `long/characters/${characterId}/relationships.md`,
          updatedAt: "2026-10-01T00:00:00.000Z"
        }
      }
    ]
  };
}

function setup(
  saveAllChanges = vi.fn(async () => true),
  characterCoreOnly = false
) {
  const props = reactive({
    bookId: "longbook_one",
    selection: selection(),
    workspaceIndex: null
  });
  const documentStates = ref<Record<string, LongDocumentState>>({});
  for (const { file } of props.selection.files) {
    documentStates.value[file.id] = {
      bookId: props.bookId,
      file,
      content: "原文",
      savedContent: "原文",
      loading: false,
      saving: false,
      loaded: true,
      loadError: null
    };
  }
  const loadWorkspaceDocument = vi.fn(async (): Promise<void> => undefined);
  const scope = effectScope();
  scopes.push(scope);
  const editor = scope.run(() =>
    useLongEditorStructureSelection({
      characterCoreOnly,
      props,
      host: {
        currentReadOnly: computed(() => false),
        currentIsPlotPointStoryline: computed(() => false),
        currentStructureTitleTarget: computed(() => null),
        currentStructureTitleReadOnly: computed(() => false),
        currentWorldbuildingItem: computed(() => null),
        currentEmptyCollection: computed(() => null),
        currentIsCharacterDocument: computed(() => true),
        currentIsBookLineWorkspace: computed(() => false),
        resetEditorHistory: vi.fn(),
        loadWorkspaceDocument,
        saveAllChanges,
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
      documentStates,
      resetTextViewMode: vi.fn(),
      stateKey: (fileId) => fileId
    })
  )!;
  return {
    props,
    editor,
    saveAllChanges,
    loadWorkspaceDocument,
    documentStates
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

describe("角色核心档案内部导航", () => {
  it("可将人物设计界面固定在核心档案，而不移除底层人物文件", () => {
    const { props, editor } = setup(
      vi.fn(async () => true),
      true
    );
    props.selection = { ...props.selection, preferredRole: "relationships" };
    expect(editor.currentSelectionFile.value?.role).toBe("core-profile");
    expect(props.selection.files).toHaveLength(2);
  });
  it.each(["file", "role", "focus-file", "focus-target"] as const)(
    "%s 在取消或操作忙碌时保留当前档案",
    async (route) => {
      const { editor, saveAllChanges, loadWorkspaceDocument } = setup(
        vi.fn(async () => false)
      );
      const fileId = "character_one_relationships";
      if (route === "file") await editor.selectWorkspaceFile(fileId);
      else if (route === "role") await editor.selectRole("relationships");
      else if (route === "focus-file")
        expect(await editor.focusFile(fileId)).toBe(false);
      else expect(await editor.focusTarget({ fileId })).toBe(false);
      expect(saveAllChanges).toHaveBeenCalledOnce();
      expect(loadWorkspaceDocument).not.toHaveBeenCalled();
      expect(editor.activeFileId.value).toBe("character_one_core");
      expect(editor.currentSelectionFile.value?.role).toBe("core-profile");
      expect(editor.pendingFileId.value).toBeNull();
    }
  );

  it("保存完成后才加载并切换目标文件", async () => {
    const save = deferred<boolean>();
    const { editor, loadWorkspaceDocument } = setup(vi.fn(() => save.promise));
    const switching = editor.selectWorkspaceFile("character_one_relationships");
    await Promise.resolve();
    expect(editor.currentSelectionFile.value?.role).toBe("core-profile");
    expect(loadWorkspaceDocument).not.toHaveBeenCalled();
    save.resolve(true);
    await switching;
    expect(loadWorkspaceDocument).toHaveBeenCalledOnce();
    expect(editor.currentSelectionFile.value?.role).toBe("relationships");
  });

  it("取消审批定位时不继续跳转伏笔", async () => {
    const { editor, saveAllChanges } = setup(vi.fn(async () => false));
    const focusTarget = vi.fn(async () => true);
    editor.foreshadowingWorkspace.value = {
      captureFocus: () => ({ threadId: null, beatId: null }),
      focusTarget
    };
    expect(
      await editor.focusTarget({ foreshadowingThreadId: "thread_one" })
    ).toBe(false);
    expect(saveAllChanges).toHaveBeenCalledOnce();
    expect(focusTarget).not.toHaveBeenCalled();
    expect(editor.currentSelectionFile.value?.role).toBe("core-profile");
  });

  it.each(["book", "character", "preferred-file"] as const)(
    "等待保存期间改变 %s 后忽略旧导航",
    async (change) => {
      const save = deferred<boolean>();
      const { props, editor, loadWorkspaceDocument } = setup(
        vi.fn(() => save.promise)
      );
      const switching = editor.selectWorkspaceFile(
        "character_one_relationships"
      );
      if (change === "book") props.bookId = "longbook_other";
      else if (change === "character")
        props.selection = selection("character_other");
      else
        props.selection = {
          ...props.selection,
          preferredFileId: "character_one_core"
        };
      save.resolve(true);
      await switching;
      expect(loadWorkspaceDocument).not.toHaveBeenCalled();
      expect(editor.currentSelectionFile.value?.role).toBe("core-profile");
      expect(editor.pendingFileId.value).toBeNull();
    }
  );

  it("缺少目标文件的角色切换也遵守取消保护", async () => {
    const { editor, saveAllChanges } = setup(vi.fn(async () => false));
    await editor.selectRole("history");
    expect(saveAllChanges).toHaveBeenCalledOnce();
    expect(editor.activeRole.value).toBe("core-profile");
    expect(editor.activeFileId.value).toBe("character_one_core");
  });

  it("等待保存期间目标文件被移除后保留当前档案", async () => {
    const save = deferred<boolean>();
    const { props, editor, loadWorkspaceDocument } = setup(
      vi.fn(() => save.promise)
    );
    const switching = editor.selectWorkspaceFile("character_one_relationships");
    props.selection.files = props.selection.files.filter(
      (item) => item.role === "core-profile"
    );
    save.resolve(true);
    await switching;
    expect(loadWorkspaceDocument).not.toHaveBeenCalled();
    expect(editor.currentSelectionFile.value?.role).toBe("core-profile");
    expect(editor.pendingFileId.value).toBeNull();
  });

  it("目标文件读取期间切换角色后忽略读取结果", async () => {
    const { props, editor, loadWorkspaceDocument } = setup();
    props.selection = { ...props.selection, preferredRole: "relationships" };
    const load = deferred<void>();
    loadWorkspaceDocument.mockImplementation(() => load.promise);
    const switching = editor.selectWorkspaceFile("character_one_core");
    props.selection = selection("character_other");
    load.resolve();
    await switching;
    expect(editor.currentSelectionFile.value?.file.id).toBe(
      "character_other_core"
    );
    expect(editor.pendingFileId.value).toBeNull();
  });

  it("从普通文档切换保留草稿，并保持先加载后切换的行为", async () => {
    const {
      props,
      editor,
      saveAllChanges,
      loadWorkspaceDocument,
      documentStates
    } = setup();
    props.selection = { ...props.selection, preferredRole: "relationships" };
    documentStates.value.character_one_relationships!.content =
      "尚未保存的关系描述";
    const load = deferred<void>();
    loadWorkspaceDocument.mockImplementation(() => load.promise);
    const switching = editor.selectWorkspaceFile("character_one_core");
    expect(saveAllChanges).not.toHaveBeenCalled();
    expect(editor.currentSelectionFile.value?.role).toBe("relationships");
    load.resolve();
    await switching;
    expect(editor.currentSelectionFile.value?.role).toBe("core-profile");
    expect(documentStates.value.character_one_relationships!.content).toBe(
      "尚未保存的关系描述"
    );
  });
});
