import type {
  LongArcId,
  LongCharacterId,
  LongWorkspaceOperationBatch
} from "@deepwrite/contracts";
import type { LongStructureLease } from "./lease";
import type { LongStructureSync } from "./sync";
import { booleanMutationCompletion } from "./types";

export function createLongStructureRenameSave(
  host: LongStructureLease,
  sync: LongStructureSync,
  loadLongStructureMutationModule: () => Promise<
    typeof import("../../types/longStructureMutations")
  >
) {
  const {
    uiMessage,
    state,
    isDisposed,
    assertCurrentLongStructureMutationTarget,
    withMutation
  } = host;
  const { executeLongStructureMutation } = sync;
  const { activeBookId: activeLongBookId } = state;

  async function renameLongCharacter(
    input: { characterId: LongCharacterId; name: string },
    completion: (succeeded: boolean) => void
  ): Promise<void> {
    await withMutation(
      activeLongBookId.value,
      (message) => {
        uiMessage.warning(message);
        completion(false);
      },
      async (lease) => {
        const index = lease.target.index;
        const character = index.characters.find(
          ({ id }) => id === input.characterId
        );
        const name = input.name.trim();
        if (!character) {
          uiMessage.warning("该人物已不存在，请刷新后重试。");
          completion(false);
          return;
        }
        if (!name) {
          uiMessage.warning("人物姓名不能为空。");
          completion(false);
          return;
        }
        if (name === character.name) {
          completion(true);
          return;
        }
        let batch: LongWorkspaceOperationBatch;
        try {
          const { createLongStructureMutationBuilder } =
            await loadLongStructureMutationModule();
          assertCurrentLongStructureMutationTarget(lease.target, lease);
          batch = createLongStructureMutationBuilder(index).updateCharacter(
            character.id,
            { name }
          );
        } catch (error: unknown) {
          if (isDisposed()) return;
          uiMessage.warning(
            error instanceof Error ? error.message : "无法修改人物姓名。"
          );
          completion(false);
          return;
        }
        await executeLongStructureMutation(
          lease,
          batch,
          booleanMutationCompletion(completion),
          { successMessage: `已将人物姓名修改为“${name}”` },
          index
        );
      }
    );
  }

  async function renameLongStructureTitle(
    input: {
      kind: "worldbuilding" | "volume" | "plotPoint" | "chapterCard";
      id: string;
      title: string;
    },
    completion: (succeeded: boolean) => void
  ): Promise<void> {
    await withMutation(
      activeLongBookId.value,
      (message) => {
        uiMessage.warning(message);
        completion(false);
      },
      async (lease) => {
        const index = lease.target.index;
        const title = input.title.trim();
        if (!title) {
          uiMessage.warning("标题不能为空。");
          completion(false);
          return;
        }
        let batch: LongWorkspaceOperationBatch | undefined;
        let currentTitle: string | undefined;
        let structureLabel = "结构项";
        try {
          const { createLongStructureMutationBuilder } =
            await loadLongStructureMutationModule();
          assertCurrentLongStructureMutationTarget(lease.target, lease);
          const builder = createLongStructureMutationBuilder(index);
          switch (input.kind) {
            case "worldbuilding": {
              const category = index.worldbuilding.find(
                ({ id }) => id === input.id
              );
              currentTitle = category?.title;
              structureLabel = "世界观分类";
              if (category)
                batch = builder.updateWorldbuilding(category.id, { title });
              break;
            }
            case "volume": {
              const volume = index.plot.volumes.find(
                ({ id }) => id === input.id
              );
              currentTitle = volume?.title;
              structureLabel = "分卷";
              if (volume) batch = builder.updateVolume(volume.id, { title });
              break;
            }
            case "plotPoint": {
              const plotPoint = index.plot.arcs.find(
                ({ id }) => id === input.id
              );
              currentTitle = plotPoint?.title;
              structureLabel = "剧情点";
              if (plotPoint) batch = builder.updateArc(plotPoint.id, { title });
              break;
            }
            case "chapterCard": {
              const chapter = index.plot.chapterCards.find(
                ({ id }) => id === input.id
              );
              currentTitle = chapter?.title;
              structureLabel = "章卡";
              if (chapter) batch = builder.updateChapter(chapter.id, { title });
              break;
            }
          }
        } catch (error: unknown) {
          if (isDisposed()) return;
          uiMessage.warning(
            error instanceof Error ? error.message : "无法修改标题。"
          );
          completion(false);
          return;
        }
        if (currentTitle === undefined || !batch) {
          uiMessage.warning(`该${structureLabel}已不存在，请刷新后重试。`);
          completion(false);
          return;
        }
        if (title === currentTitle) {
          completion(true);
          return;
        }
        await executeLongStructureMutation(
          lease,
          batch,
          booleanMutationCompletion(completion),
          { successMessage: `已将${structureLabel}标题修改为“${title}”` },
          index
        );
      }
    );
  }

  async function saveLongVolumeOutline(
    input: { volumeId: string; outline: string },
    completion: (succeeded: boolean) => void
  ): Promise<void> {
    await withMutation(
      activeLongBookId.value,
      (message) => {
        uiMessage.warning(message);
        completion(false);
      },
      async (lease) => {
        const index = lease.target.index;
        const volume = index.plot.volumes.find(
          ({ id }) => id === input.volumeId
        );
        if (!volume) {
          uiMessage.warning("该分卷已不存在，请刷新后重试。");
          completion(false);
          return;
        }
        let batch: LongWorkspaceOperationBatch;
        try {
          const { createLongStructureMutationBuilder } =
            await loadLongStructureMutationModule();
          assertCurrentLongStructureMutationTarget(lease.target, lease);
          batch = createLongStructureMutationBuilder(index).updateVolume(
            volume.id,
            {
              summary: input.outline
            }
          );
        } catch (error: unknown) {
          if (isDisposed()) return;
          uiMessage.warning(
            error instanceof Error ? error.message : "无法保存分卷卷纲。"
          );
          completion(false);
          return;
        }
        await executeLongStructureMutation(
          lease,
          batch,
          booleanMutationCompletion(completion),
          {
            saveEditor: false,
            successMessage: `已保存“${volume.title}”的卷纲`
          },
          index
        );
      }
    );
  }

  async function saveLongPlotPointContent(
    input: { plotPointId: LongArcId; field: "summary"; content: string },
    completion: (succeeded: boolean) => void
  ): Promise<void> {
    await withMutation(
      activeLongBookId.value,
      (message) => {
        uiMessage.warning(message);
        completion(false);
      },
      async (lease) => {
        const index = lease.target.index;
        const plotPoint = index.plot.arcs.find(
          ({ id }) => id === input.plotPointId
        );
        if (!plotPoint) {
          uiMessage.warning("该剧情点已不存在，请刷新后重试。");
          completion(false);
          return;
        }
        let batch: LongWorkspaceOperationBatch;
        try {
          const { createLongStructureMutationBuilder } =
            await loadLongStructureMutationModule();
          assertCurrentLongStructureMutationTarget(lease.target, lease);
          batch = createLongStructureMutationBuilder(index).updateArc(
            plotPoint.id,
            {
              summary: input.content
            }
          );
        } catch (error: unknown) {
          if (isDisposed()) return;
          uiMessage.warning(
            error instanceof Error ? error.message : "无法保存剧情点内容。"
          );
          completion(false);
          return;
        }
        await executeLongStructureMutation(
          lease,
          batch,
          booleanMutationCompletion(completion),
          {
            saveEditor: false,
            successMessage: `已保存“${plotPoint.title}”的概要`
          },
          index
        );
      }
    );
  }

  return {
    renameLongCharacter,
    renameLongStructureTitle,
    saveLongVolumeOutline,
    saveLongPlotPointContent
  };
}

export type LongStructureRenameSave = ReturnType<
  typeof createLongStructureRenameSave
>;
