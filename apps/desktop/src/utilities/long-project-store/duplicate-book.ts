import { mkdir, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import {
  LongBookIdSchema,
  LongLedgerCommitRecordSchema,
  LongProjectManifestSchema,
  LongWorkspaceFileReferenceSchema,
  LongWorkspaceIndexSnapshotSchema,
  LONG_AGENTS_MD_PATH,
  LONG_WORKSPACE_INDEX_PATH,
  type LongLedgerCommitRecord
} from "@deepwrite/contracts";
import { createId, randomHex8 } from "@deepwrite/shared";
import { assertLongLedgerRecordMatchesIndex } from "../long-portable-bundle";
import { parseLongLedgerCommitRecord } from "../long-version-metadata";
import type { ProjectTransactionFileOperation } from "../project-transaction";
import { readAgentsMdContentOrDefault } from "./agents-md";
import { characterAssetCopyOperations } from "./character-assets-lifecycle";
import {
  commitLongProjectTransaction,
  ensureSecureDirectory,
  parseJson,
  readSecureTextFile,
  requireMissing,
  secureDirectory,
  serializeJson
} from "./io";
import { loadProject } from "./load-project";
import { indexedFileSlots } from "./paths";
import type { LongProjectStoreContext } from "./store-context";
import {
  MANIFEST_PATH,
  MAX_DOCUMENT_BYTES,
  MAX_LEDGER_RECORD_BYTES,
  type CreatedLongBook
} from "./types";

export function replaceExactIdentity<T>(
  value: T,
  sourceId: string,
  targetId: string
): T {
  if (typeof value === "string") {
    return (value === sourceId ? targetId : value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) =>
      replaceExactIdentity(item, sourceId, targetId)
    ) as T;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        replaceExactIdentity(item, sourceId, targetId)
      ])
    ) as T;
  }
  return value;
}

export async function duplicateBook(
  ctx: LongProjectStoreContext,
  parentDirectory: string,
  sourceProjectDirectory: string,
  title: string
): Promise<CreatedLongBook> {
  const parent = await ensureSecureDirectory(parentDirectory, "长篇项目父目录");
  const sourceDirectory = await secureDirectory(
    sourceProjectDirectory,
    "长篇项目目录"
  );
  return await runDuplicateQueues(ctx, parent, sourceDirectory, async () => {
    const source = await loadProject(ctx, sourceDirectory);
    const now = ctx.timestamp();
    const bookId = LongBookIdSchema.parse(createId("longbook"));
    const projectDirectory = join(parent, bookId);
    await requireMissing(projectDirectory, "长篇项目目录已存在。");
    const stagingDirectory = join(parent, `.${bookId}.staging-${randomHex8()}`);
    await requireMissing(stagingDirectory, "长篇项目暂存目录已存在。");
    await mkdir(stagingDirectory, { mode: 0o700 });

    try {
      const index = LongWorkspaceIndexSnapshotSchema.parse(
        replaceExactIdentity(
          structuredClone(source.index),
          source.book.id,
          bookId
        )
      );
      index.updatedAt = now;
      const operations: ProjectTransactionFileOperation[] = [];
      const records: LongLedgerCommitRecord[] = [];

      for (const slot of indexedFileSlots(source.index)) {
        const disk = await readSecureTextFile(
          source.projectDirectory,
          slot.reference.path,
          slot.kind === "json" ? MAX_LEDGER_RECORD_BYTES : MAX_DOCUMENT_BYTES
        );
        if (slot.kind === "json") {
          const sourceRecord = parseLongLedgerCommitRecord(
            parseJson(disk.content, `长篇账本 ${slot.reference.id}`)
          );
          const record = LongLedgerCommitRecordSchema.parse({
            ...replaceExactIdentity(
              structuredClone(sourceRecord),
              source.book.id,
              bookId
            )
          });
          const content = serializeJson(record);
          const entry = index.ledger.commits.find(
            (candidate) => candidate.id === record.id
          );
          if (!entry) {
            throw new Error(`长篇副本缺少账本索引：${record.id}。`);
          }
          entry.recordFile = LongWorkspaceFileReferenceSchema.parse({
            ...entry.recordFile,
            updatedAt: now
          });
          records.push(record);
          operations.push({
            path: entry.recordFile.path,
            content,
            expectedSha256: null
          });
        } else {
          operations.push({
            path: slot.reference.path,
            content: disk.content,
            expectedSha256: null
          });
        }
      }

      operations.push(...(await characterAssetCopyOperations(source)));
      const validatedIndex = LongWorkspaceIndexSnapshotSchema.parse(index);
      for (const record of records) {
        const entry = validatedIndex.ledger.commits.find(
          (candidate) => candidate.id === record.id
        );
        if (!entry) throw new Error(`长篇副本缺少账本索引：${record.id}。`);
        const recordOperation = operations.find(
          (operation) => operation.path === entry.recordFile.path
        );
        const content =
          recordOperation &&
          recordOperation.action !== "delete" &&
          recordOperation.action !== "check" &&
          typeof recordOperation.content === "string"
            ? recordOperation.content
            : undefined;
        assertLongLedgerRecordMatchesIndex(
          validatedIndex,
          entry,
          record,
          content
        );
      }
      const indexContent = serializeJson(validatedIndex);
      const manifest = LongProjectManifestSchema.parse({
        ...replaceExactIdentity(
          structuredClone(source.manifest),
          source.book.id,
          bookId
        ),
        id: bookId,
        title,
        createdAt: now,
        updatedAt: now,
        workspaceIndexFile: {
          ...source.manifest.workspaceIndexFile,
          updatedAt: now
        }
      });
      operations.push(
        {
          path: LONG_AGENTS_MD_PATH,
          content: await readAgentsMdContentOrDefault(source.projectDirectory),
          expectedSha256: null
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
      );

      await commitLongProjectTransaction({
        projectRoot: stagingDirectory,
        operations,
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

/** Deterministic ordering also prevents two reverse copies from deadlocking. */
async function runDuplicateQueues<T>(
  ctx: LongProjectStoreContext,
  parent: string,
  source: string,
  task: () => Promise<T>
): Promise<T> {
  const [first, second] = [parent, source].sort();
  return await ctx.runExclusive(first!, async () => {
    return first === second
      ? await task()
      : await ctx.runExclusive(second!, task);
  });
}
