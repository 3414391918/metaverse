import { dirname, isAbsolute, join } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import {
  createEmptyLongMarkdownFileReference,
  describeWorkspaceToolSchema,
  longCharacterCoreProfileFileId,
  longCharacterFilePath,
  longCharacterRelationshipsFileId,
  serializeLongCharacterProfileMarkdown,
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
  ToolkitCreateCharacterInputSchema,
  ToolkitAddAppearanceInputSchema,
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
    case "character.create": {
      const parsed = ToolkitCreateCharacterInputSchema.parse(input);
      if (
        !opened.book.workspaceIndex.characterTypes.some(
          ({ id }) => id === parsed.group
        )
      )
        throw new Error("人物分类不存在，请重新读取小说索引。");
      if (
        opened.book.workspaceIndex.characters.some(
          ({ group, name }) => group === parsed.group && name === parsed.name
        )
      )
        throw new Error("该分类中已有同名人物，请先读取现有档案。");
      const characterId = `character_${randomUUID().replaceAll("-", "")}`;
      const updatedAt = new Date().toISOString();
      const coreProfile = createEmptyLongMarkdownFileReference(
        longCharacterCoreProfileFileId(characterId),
        longCharacterFilePath(characterId, "core-profile.md"),
        updatedAt
      );
      const relationships = createEmptyLongMarkdownFileReference(
        longCharacterRelationshipsFileId(characterId),
        longCharacterFilePath(characterId, "relationships.md"),
        updatedAt
      );
      const appearances = (parsed.appearances ?? []).map((appearance) => ({
        id: `appearance_${randomUUID().replaceAll("-", "")}`,
        ...appearance
      }));
      const profile = {
        name: parsed.name,
        keywords: parsed.keywords ?? "",
        faceDescription: parsed.faceDescription,
        settingDescription: parsed.settingDescription,
        appearances
      };
      const batch = LongWorkspaceOperationBatchSchema.parse({
        updatedAt,
        operations: [
          {
            type: "character.create",
            character: {
              id: characterId,
              name: parsed.name,
              group: parsed.group,
              order: 1,
              aliases: []
            },
            files: { characterId, coreProfile, relationships }
          }
        ],
        documentWrites: [
          {
            proposalId: `proposal_${randomUUID().replaceAll("-", "")}`,
            fileId: coreProfile.id,
            mode: "create",
            content: serializeLongCharacterProfileMarkdown(profile),
            updatedAt,
            reason: "创建人物核心档案"
          }
        ]
      });
      await applyWorkspaceOperations(ctx, directory, { batch });
      for (const { id: appearanceId } of appearances)
        await prepareCharacterAppearanceDirectory(ctx, directory, {
          bookId,
          characterId,
          appearanceId
        });
      return readCharacterProfile(ctx, directory, { bookId, characterId });
    }
    case "appearance.add": {
      const parsed = ToolkitAddAppearanceInputSchema.parse(input);
      const current = await readCharacterProfile(ctx, directory, {
        bookId,
        characterId: parsed.characterId
      });
      if (current.revision !== parsed.expectedRevision)
        throw new Error("角色档案已更新，请重新读取后再新增形象。");
      if (current.profile.appearances.some(({ name }) => name === parsed.name))
        throw new Error("该角色已有同名形象，请先核对现有形象。");
      const appearanceId = `appearance_${randomUUID().replaceAll("-", "")}`;
      await saveCharacterProfile(ctx, directory, {
        bookId,
        characterId: parsed.characterId,
        expectedRevision: parsed.expectedRevision,
        profile: {
          ...current.profile,
          appearances: [
            ...current.profile.appearances,
            {
              id: appearanceId,
              name: parsed.name,
              description: parsed.description
            }
          ]
        }
      });
      const prepared = await prepareCharacterAppearanceDirectory(
        ctx,
        directory,
        {
          bookId,
          characterId: parsed.characterId,
          appearanceId
        }
      );
      return { appearanceId, ...prepared };
    }
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
