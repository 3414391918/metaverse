import type { LongWorkspaceRuntimeContext } from "./long-workspace-api";

export function longWorkspaceRuntimeFixture(): LongWorkspaceRuntimeContext {
  return {
    bookId: "longbook_contracts",
    title: "契约测试创作",
    activeRoot: "draft",
    activeAgentId: "long",
    navigation: {
      schemaVersion: 1,
      bookId: "longbook_contracts",
      updatedAt: "2026-10-03T00:00:00.000Z",
      counts: {
        worldbuildingCategories: 0,
        characters: 0,
        volumes: 0,
        arcs: 0,
        chapterCards: 0,
        storyEvents: 0,
        storyPlots: 0,
        foreshadowingThreads: 0,
        committedChapters: 0
      },
      worldbuilding: [],
      characterTypes: [],
      characters: [],
      volumes: [],
      arcs: [],
      chapterCards: [],
      committedThroughChapterId: null
    }
  };
}
