import { dirname, isAbsolute, join } from "node:path";
import { createHash } from "node:crypto";
import {
  describeWorkspaceToolSchema,
  WorkspaceToolRequestSchema,
  ToolkitDirectorySchema,
  ToolkitStringSchema,
  ToolkitReadInputSchema,
  ToolkitWriteInputSchema,
  ToolkitSearchInputSchema,
  ToolkitAddIllustrationInputSchema,
  ToolkitDeleteIllustrationInputSchema,
  ToolkitIllustrationReferencesInputSchema,
  ToolkitCharacterAssetsInputSchema,
  CreateLongBookInputSchema,
  LongCommitChapterInputSchema,
  LongDeleteCharacterAppearanceInputSchema,
  LongDeleteLedgerCommitInputSchema,
  LongPrepareCharacterAppearanceDirectoryInputSchema,
  LongReadCharacterProfileInputSchema,
  LongSaveCharacterProfileInputSchema,
  LongWorkspaceOperationBatchSchema,
  LongWriteChapterInputSchema
} from "@deepwrite/contracts";
import { createLongProjectStoreContext } from "../../apps/desktop/src/utilities/long-project-store/store-context";
import { createBook } from "../../apps/desktop/src/utilities/long-project-store/lifecycle";
import {
  openBook,
  readAgentsMd,
  readDocument,
  writeAgentsMd,
  writeDocument
} from "../../apps/desktop/src/utilities/long-project-store/documents";
import {
  applyWorkspaceOperations,
  previewWorkspaceOperations
} from "../../apps/desktop/src/utilities/long-project-store/operations";
import {
  readCharacterProfile,
  saveCharacterProfile
} from "../../apps/desktop/src/utilities/long-project-store/character-profiles";
import { prepareCharacterAppearanceDirectory } from "../../apps/desktop/src/utilities/long-project-store/character-appearance-directory";
import { deleteCharacterAppearance } from "../../apps/desktop/src/utilities/long-project-store/character-appearance-delete";
import { writeChapter } from "../../apps/desktop/src/utilities/long-project-store/write-chapter";
import { commitChapter } from "../../apps/desktop/src/utilities/long-project-store/commit-chapter";
import { deleteLedgerCommit } from "../../apps/desktop/src/utilities/long-project-store/delete-ledger-commit";
import { search } from "../../apps/desktop/src/utilities/long-project-store/search-api";
import { addChapterImageBytes } from "../../apps/desktop/src/utilities/long-project-store/chapter-illustration-transaction";
import { deleteChapterImage } from "../../apps/desktop/src/utilities/long-project-store/chapter-image-delete";
import type { StoreCommitLongChapterInput } from "../../apps/desktop/src/utilities/long-project-store/types";
import { markForDesktopDiscovery } from "./discovery";
import { readIllustrationSource } from "./illustration-source";
import {
  listChapterIllustrations,
  listCharacterAssets
} from "./illustration-context";

const hash = (text: string) => createHash("sha256").update(text).digest("hex");
function absoluteDirectory(raw: unknown): string {
  const path = ToolkitDirectorySchema.parse(raw);
  if (!isAbsolute(path)) throw new Error("请指定目录的绝对路径。");
  return path;
}

/** Independent CLI facade: no Electron, IPC, model credentials or desktop registry. */
export async function runWorkspaceAction(
  bookPath: string | undefined,
  rawRequest: unknown
): Promise<unknown> {
  const { action, input } = WorkspaceToolRequestSchema.parse(rawRequest);
  if (action === "schema") {
    return describeWorkspaceToolSchema(input.name);
  }
  const ctx = createLongProjectStoreContext();
  if (action === "create") {
    const { parentDirectory, ...book } = input;
    const parent = absoluteDirectory(parentDirectory);
    const parsed = CreateLongBookInputSchema.parse(book);
    const materials = parsed.linkedMaterialIdsByKind;
    const skills = parsed.linkedSkillIdsByKind;
    const created = await createBook(ctx, parent, {
      title: parsed.title,
      genre: parsed.genre,
      linkedMaterialIdsByKind: {
        character: materials?.character ?? [],
        gimmick: materials?.gimmick ?? [],
        plot: materials?.plot ?? [],
        draft: materials?.draft ?? [],
        other: materials?.other ?? []
      },
      linkedSkillIdsByKind: {
        general: skills?.general ?? [],
        plot: skills?.plot ?? [],
        style: skills?.style ?? [],
        other: skills?.other ?? []
      }
    });
    await markForDesktopDiscovery(created.projectDirectory);
    return created;
  }
  const directory = absoluteDirectory(bookPath);
  const opened = await openBook(ctx, directory);
  const bookId = opened.book.id;
  const characterInput = { ...input, bookId };
  switch (action) {
    case "index":
      return {
        directory,
        summary: opened.summary,
        workspaceIndex: opened.book.workspaceIndex
      };
    case "read": {
      const parsed = ToolkitReadInputSchema.parse(input);
      const first = await readDocument(ctx, directory, {
        fileId: parsed.fileId,
        ...(parsed.full
          ? { offset: 0 }
          : parsed.offset !== undefined
            ? { offset: parsed.offset }
            : {}),
        ...(parsed.limit !== undefined ? { limit: parsed.limit } : {})
      });
      if (!parsed.full) return first;
      let content = first.content;
      let offset = first.nextOffset;
      while (offset !== null) {
        const page = await readDocument(ctx, directory, {
          fileId: parsed.fileId,
          offset,
          limit: 262144
        });
        content += page.content;
        offset = page.nextOffset;
      }
      return { ...first, content, nextOffset: null, sha256: hash(content) };
    }
    case "write": {
      const parsed = ToolkitWriteInputSchema.parse(input);
      if (parsed.expectedSha256) {
        const current = (await runWorkspaceAction(directory, {
          action: "read",
          input: { fileId: parsed.fileId }
        })) as { sha256: string };
        if (current.sha256 !== parsed.expectedSha256)
          throw new Error("正文已被修改，请重新读取后再写入。");
      }
      const result = await writeDocument(ctx, directory, parsed);
      return { fileId: result.fileId, summary: result.summary };
    }
    case "search": {
      const parsed = ToolkitSearchInputSchema.parse(input);
      return search(ctx, directory, {
        query: parsed.query,
        fileIds: parsed.fileIds,
        ...(parsed.maxResults !== undefined
          ? { maxResults: parsed.maxResults }
          : {}),
        ...(parsed.contextCharacters !== undefined
          ? { contextCharacters: parsed.contextCharacters }
          : {}),
        ...(parsed.resume !== undefined ? { resume: parsed.resume } : {})
      });
    }
    case "preview":
      return previewWorkspaceOperations(
        ctx,
        directory,
        LongWorkspaceOperationBatchSchema.parse(input)
      );
    case "apply":
      return applyWorkspaceOperations(ctx, directory, {
        batch: LongWorkspaceOperationBatchSchema.parse(input)
      });
    case "writeChapter": {
      const { bookId: _book, ...parsed } =
        LongWriteChapterInputSchema.parse(characterInput);
      return writeChapter(ctx, directory, parsed);
    }
    case "commitChapter": {
      const { bookId: _book, ...parsed } =
        LongCommitChapterInputSchema.parse(characterInput);
      return commitChapter(
        ctx,
        directory,
        parsed as StoreCommitLongChapterInput
      );
    }
    case "deleteLedgerCommit": {
      const { bookId: _book, ...parsed } =
        LongDeleteLedgerCommitInputSchema.parse(characterInput);
      return deleteLedgerCommit(ctx, directory, parsed);
    }
    case "character.read":
      return readCharacterProfile(
        ctx,
        directory,
        LongReadCharacterProfileInputSchema.parse(characterInput)
      );
    case "character.assets": {
      const { characterId } = ToolkitCharacterAssetsInputSchema.parse(input);
      const profileFile = opened.book.workspaceIndex.characterFiles.find(
        (entry) => entry.characterId === characterId
      );
      if (!profileFile) throw new Error("找不到指定角色的核心档案。");
      const profile = await readCharacterProfile(ctx, directory, {
        bookId,
        characterId
      });
      return {
        characterId,
        assets: await listCharacterAssets(
          directory,
          profileFile.coreProfile.path,
          profile
        )
      };
    }
    case "character.save":
      return saveCharacterProfile(
        ctx,
        directory,
        LongSaveCharacterProfileInputSchema.parse(characterInput)
      );
    case "appearance.prepare":
      return prepareCharacterAppearanceDirectory(
        ctx,
        directory,
        LongPrepareCharacterAppearanceDirectoryInputSchema.parse(characterInput)
      );
    case "appearance.delete":
      return deleteCharacterAppearance(
        ctx,
        directory,
        LongDeleteCharacterAppearanceInputSchema.parse(characterInput)
      );
    case "illustration.add": {
      const parsed = ToolkitAddIllustrationInputSchema.parse(input);
      const chapter = opened.book.workspaceIndex.chapters.find(
        ({ chapterCardId }) => chapterCardId === parsed.chapterCardId
      );
      if (!chapter) throw new Error("找不到指定章节。");
      const body = (await runWorkspaceAction(directory, {
        action: "read",
        input: { fileId: chapter.body.id }
      })) as { content: string; sha256: string };
      if (body.sha256 !== parsed.expectedSha256)
        throw new Error("章节正文已更新，请重新读取并确定插图位置。");
      if (parsed.offset > body.content.length)
        throw new Error("插图位置超出章节正文长度。");
      const png = await readIllustrationSource(parsed.imagePath);
      const result = await addChapterImageBytes(
        ctx,
        directory,
        {
          bookId,
          chapterCardId: parsed.chapterCardId,
          content: body.content,
          expectedContent: body.content,
          offset: parsed.offset
        },
        png
      );
      return {
        filename: result.filename,
        imagePath: join(
          directory,
          dirname(result.document.file.path),
          "images",
          result.filename
        ),
        reference: `![](images/${result.filename})`,
        bodyFileId: result.document.file.id,
        contentSha256: hash(result.content)
      };
    }
    case "illustration.delete": {
      const parsed = ToolkitDeleteIllustrationInputSchema.parse(input);
      const chapter = opened.book.workspaceIndex.chapters.find(
        ({ chapterCardId }) => chapterCardId === parsed.chapterCardId
      );
      if (!chapter) throw new Error("找不到指定章节。");
      const body = (await runWorkspaceAction(directory, {
        action: "read",
        input: { fileId: chapter.body.id }
      })) as { content: string; sha256: string };
      if (body.sha256 !== parsed.expectedSha256)
        throw new Error("章节正文已更新，请重新读取并确定图片位置。");
      const target = {
        bookId,
        chapterCardId: parsed.chapterCardId,
        filename: parsed.filename
      };
      const result = await deleteChapterImage(ctx, directory, {
        ...target,
        offset: parsed.offset,
        expectedContent: body.content
      });
      return {
        bodyFileId: result.document.file.id,
        contentSha256: hash(result.content),
        fileDeleted: result.fileDeleted
      };
    }
    case "illustration.references": {
      const { chapterCardId } =
        ToolkitIllustrationReferencesInputSchema.parse(input);
      const chapter = opened.book.workspaceIndex.chapters.find(
        (item) => item.chapterCardId === chapterCardId
      );
      if (!chapter) throw new Error("找不到指定章节。");
      const body = (await runWorkspaceAction(directory, {
        action: "read",
        input: { fileId: chapter.body.id }
      })) as { content: string };
      return {
        chapterCardId,
        references: await listChapterIllustrations(
          directory,
          chapter.body.path,
          body.content
        )
      };
    }
    case "agents.read":
      return readAgentsMd(ctx, directory);
    case "agents.write":
      return writeAgentsMd(
        ctx,
        directory,
        ToolkitStringSchema.parse(input.content)
      );
  }
}
