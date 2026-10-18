import { mkdir, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import {
  DEFAULT_LONG_AGENTS_MD,
  DEFAULT_LONG_CHARACTER_TYPES,
  LONG_AGENTS_MD_PATH,
  LONG_BOOK_LINE_FILE_ID,
  LONG_CHARACTER_OVERVIEW_FILE_ID,
  LONG_CHARACTER_OVERVIEW_PATH,
  LONG_WORKSPACE_INDEX_FILE_ID,
  LONG_WORKSPACE_INDEX_PATH,
  LongBookIdSchema,
  LongProjectManifestSchema,
  LongWorkspaceIndexSnapshotSchema,
  longChapterBodyFileId,
  longChapterCardFileId,
  longChapterCharacterStateFileId,
  longChapterContinuityFilePath,
  longChapterForeshadowingChangesFileId,
  longChapterHandoffFileId,
  longWorldbuildingOverviewContentPath,
  longWorldbuildingOverviewFileId,
  type LongWorkspaceFileReference
} from "@deepwrite/contracts";
import { createId, randomHex8 } from "@deepwrite/shared";
import {
  commitLongProjectTransaction,
  ensureSecureDirectory,
  requireMissing,
  serializeJson
} from "./io";
import { loadProject } from "./load-project";
import { chapterPath } from "./paths";
import type { LongProjectStoreContext } from "./store-context";
import {
  BOOK_LINE_PATH,
  DEFAULT_WORLD_CATEGORIES,
  EMPTY_LINKED_MATERIALS,
  EMPTY_LINKED_SKILLS,
  MANIFEST_PATH,
  MAX_LEDGER_RECORD_BYTES,
  type CreateLongBookInput,
  type CreatedLongBook,
  type InitialProjectFiles
} from "./types";

export async function createBook(
  ctx: LongProjectStoreContext,
  parentDirectory: string,
  input: CreateLongBookInput
): Promise<CreatedLongBook> {
  const parent = await ensureSecureDirectory(parentDirectory, "长篇项目父目录");
  return await ctx.runExclusive(parent, async () => {
    const bookId = LongBookIdSchema.parse(input.id ?? createId("longbook"));
    const projectDirectory = join(parent, bookId);
    await requireMissing(projectDirectory, "长篇项目目录已存在。");

    const stagingDirectory = join(parent, `.${bookId}.staging-${randomHex8()}`);
    await requireMissing(stagingDirectory, "长篇项目暂存目录已存在。");
    await mkdir(stagingDirectory, { mode: 0o700 });

    try {
      const initial = createInitialProjectFiles(ctx, bookId, input);
      await commitLongProjectTransaction({
        projectRoot: stagingDirectory,
        operations: initial.operations,
        maxFileBytes: MAX_LEDGER_RECORD_BYTES
      });
      await loadProject(ctx, stagingDirectory);
      await requireMissing(projectDirectory, "长篇项目目录已存在。");
      await rename(stagingDirectory, projectDirectory);
      const loaded = await loadProject(ctx, projectDirectory);
      return {
        projectDirectory: loaded.projectDirectory,
        book: loaded.book,
        summary: loaded.summary
      };
    } catch (error: unknown) {
      await rm(stagingDirectory, { recursive: true, force: true });
      throw error;
    }
  });
}

export { duplicateBook } from "./duplicate-book";

export function createInitialProjectFiles(
  ctx: LongProjectStoreContext,
  bookId: string,
  input: CreateLongBookInput
): InitialProjectFiles {
  const timestamp = ctx.timestamp();
  const volumeId = createId("volume");
  const arcId = createId("arc");
  const chapterId = createId("chapter");
  const file = (id: string, path: string): LongWorkspaceFileReference => ({
    id,
    path,
    updatedAt: timestamp
  });
  const worldbuilding = DEFAULT_WORLD_CATEGORIES.map(([id, title], index) => ({
    id,
    title,
    order: index + 1,
    format: "list" as const,
    contentAuthority: "files" as const,
    overview: file(
      longWorldbuildingOverviewFileId(id),
      longWorldbuildingOverviewContentPath(id)
    ),
    items: []
  }));
  const chapterBody = file(
    longChapterBodyFileId(chapterId),
    chapterPath(chapterId, "body.md")
  );
  const chapterCard = file(
    longChapterCardFileId(chapterId),
    chapterPath(chapterId, "card.md")
  );
  const chapterState = file(
    longChapterCharacterStateFileId(chapterId),
    chapterPath(chapterId, "character-state.md")
  );
  const chapterHandoff = file(
    longChapterHandoffFileId(chapterId),
    chapterPath(chapterId, "handoff.md")
  );
  const chapterForeshadowingChanges = file(
    longChapterForeshadowingChangesFileId(chapterId),
    longChapterContinuityFilePath(chapterId, "foreshadowing-changes.md")
  );

  const index = LongWorkspaceIndexSnapshotSchema.parse({
    schemaVersion: 1,
    bookId,
    updatedAt: timestamp,
    bookLine: file(LONG_BOOK_LINE_FILE_ID, BOOK_LINE_PATH),
    featureSettings: {
      worldbuildingItemLayout: "right-list",
      characterAndContinuityItemLayout: "right-list",
      plotItemLayout: "right-list"
    },
    worldbuilding,
    characterOverview: file(
      LONG_CHARACTER_OVERVIEW_FILE_ID,
      LONG_CHARACTER_OVERVIEW_PATH
    ),
    characterTypes: structuredClone(DEFAULT_LONG_CHARACTER_TYPES),
    characters: [],
    characterFiles: [],
    plot: {
      volumes: [{ id: volumeId, title: "第一卷", order: 1, summary: "" }],
      arcs: [
        {
          id: arcId,
          volumeId,
          title: "第一剧情点",
          order: 1,
          outline: ""
        }
      ],
      chapterCards: [
        {
          id: chapterId,
          volumeId,
          primaryArcId: arcId,
          title: "第一章",
          narrativeOrder: 1
        }
      ],
      storyEvents: [],
      storyPlots: [],
      eventConnections: [],
      narrativePlacements: [],
      foreshadowing: []
    },
    chapters: [
      {
        chapterCardId: chapterId,
        body: chapterBody,
        card: chapterCard,
        characterState: chapterState,
        handoff: chapterHandoff,
        foreshadowingChanges: chapterForeshadowingChanges,
        worldReveals: null,
        characterContinuity: [],
        commitId: null
      }
    ],
    ledger: { committedThroughChapterId: null, commits: [] }
  });
  const indexContent = serializeJson(index);
  const manifest = LongProjectManifestSchema.parse({
    schemaVersion: 1,
    kind: "deepwrite.long-book",
    id: bookId,
    title: input.title,
    bookType: "long",
    genre: input.genre,
    status: "editing",
    linkedMaterialIdsByKind:
      input.linkedMaterialIdsByKind ?? EMPTY_LINKED_MATERIALS,
    linkedSkillIdsByKind: input.linkedSkillIdsByKind ?? EMPTY_LINKED_SKILLS,
    createdAt: timestamp,
    updatedAt: timestamp,
    workspaceIndexFile: {
      id: LONG_WORKSPACE_INDEX_FILE_ID,
      path: LONG_WORKSPACE_INDEX_PATH,
      updatedAt: timestamp
    }
  });

  return {
    manifest,
    index,
    operations: [
      {
        path: BOOK_LINE_PATH,
        content: "",
        expectedSha256: null as null
      },
      ...worldbuilding.map(({ overview }) => ({
        path: overview.path,
        content: "",
        expectedSha256: null as null
      })),
      {
        path: LONG_CHARACTER_OVERVIEW_PATH,
        content: "",
        expectedSha256: null as null
      },
      ...[
        chapterBody.path,
        chapterCard.path,
        chapterState.path,
        chapterHandoff.path,
        chapterForeshadowingChanges.path
      ].map((path) => ({
        path,
        content: "",
        expectedSha256: null as null
      })),
      {
        path: LONG_AGENTS_MD_PATH,
        content: DEFAULT_LONG_AGENTS_MD,
        expectedSha256: null as null
      },
      {
        path: LONG_WORKSPACE_INDEX_PATH,
        content: indexContent,
        expectedSha256: null
      },
      {
        path: MANIFEST_PATH,
        content: serializeJson(manifest),
        expectedSha256: null
      }
    ]
  };
}
