import {
  createShortWorkspaceContentRevision,
  MaterialLibraryProjectManifestSchema,
  MoveLibraryEntryInputSchema,
  SaveLibraryEntryInputSchema,
  SkillLibraryProjectManifestSchema,
  type MaterialEntry,
  type MaterialLibraryProjectManifest,
  type MaterialStageId,
  type MoveLibraryEntryInput,
  type MoveLibraryEntryResult,
  type SaveLibraryEntryInput,
  type SkillEntry,
  type SkillLibraryProjectManifest
} from "@deepwrite/contracts";
import { createCatalogId, randomHex8 } from "@deepwrite/shared";
import { rename } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  assertBaseRevision,
  assertProjectRevision,
  libraryProjectDomain,
  parseId,
  parseLibraryDomain,
  parseNonBlankString
} from "./assertions";
import { readManifest } from "./manifest";
import {
  assertJsonByteLength,
  assertTextByteLength,
  atomicWriteJson,
  commitProjectMarkdownUpdate,
  portableContentPathKey,
  readProjectMarkdown,
  readRequiredUtf8File,
  secureExistingProjectPath,
  secureProjectRoot,
  secureWritableProjectPath,
  uniqueRelativeMarkdownPath,
  unlinkOptional
} from "./paths-io";
import {
  bumpRegistry,
  ensureRegistry,
  findRegistration,
  mutate
} from "./registry";
import {
  FolderCatalogConflictError,
  FolderMaterialProjectManifestSchema,
  FolderSkillProjectManifestSchema,
  MANIFEST_FILE,
  type CreateFolderLibraryEntryInput,
  type FolderCatalogStoreContext,
  type RemoveFolderLibraryEntryInput,
  type RemoveFolderLibraryEntryResult
} from "./types";
export function nextMarketplaceTitle(
  baseTitle: string,
  existingTitles: readonly string[]
): string {
  const normalized = new Set(
    existingTitles.map((title) => title.trim().toLocaleLowerCase())
  );
  if (!normalized.has(baseTitle.trim().toLocaleLowerCase())) return baseTitle;
  let suffix = 2;
  while (
    normalized.has(`${baseTitle} (${suffix})`.trim().toLocaleLowerCase())
  ) {
    suffix += 1;
  }
  return `${baseTitle} (${suffix})`;
}
export async function saveLibraryEntry(
  store: FolderCatalogStoreContext,
  rawInput: SaveLibraryEntryInput
): Promise<MaterialEntry | SkillEntry> {
  const input = SaveLibraryEntryInputSchema.parse(rawInput);
  assertTextByteLength(
    input.content,
    store.maxMarkdownBytes,
    "Markdown content"
  );
  return await mutate(store, async () => {
    const registry = await ensureRegistry(store);
    const resourceDomain =
      input.domain === "material" ? "material-library" : "skill-library";
    const registration = findRegistration(
      registry,
      input.libraryId,
      resourceDomain
    );
    const projectDirectory = await secureProjectRoot(
      registration.projectDirectory
    );
    const expectedKind =
      input.domain === "material"
        ? "deepwrite.material-library"
        : "deepwrite.skill-library";
    const manifest = await readManifest(
      store,
      projectDirectory,
      expectedKind,
      input.libraryId
    );
    if (!input.force) {
      assertBaseRevision(input.baseProjectRevision, manifest.revision);
    }
    const entryIndex = manifest.entries.findIndex(
      ({ id }) => id === input.entryId
    );
    if (entryIndex < 0) {
      throw new Error("素材或技能条目不存在，无法保存。");
    }
    const existing = manifest.entries[entryIndex]!;
    const currentContent = await readProjectMarkdown(
      projectDirectory,
      existing.path,
      store.maxMarkdownBytes
    );
    if (!input.force && input.baseRevision !== undefined) {
      const actualRevision =
        createShortWorkspaceContentRevision(currentContent);
      if (input.baseRevision !== actualRevision) {
        throw new FolderCatalogConflictError(
          input.baseRevision,
          actualRevision
        );
      }
    }
    const now = store.now();
    const nextEntry = {
      ...existing,
      ...(input.title === undefined ? {} : { title: input.title }),
      updatedAt: now
    };
    const entries = [...manifest.entries];
    entries[entryIndex] = nextEntry;
    const target = await secureWritableProjectPath(
      projectDirectory,
      existing.path
    );
    if (manifest.kind === "deepwrite.material-library") {
      const next = FolderMaterialProjectManifestSchema.parse({
        ...manifest,
        revision: manifest.revision + 1,
        updatedAt: now,
        entries
      });
      await commitProjectMarkdownUpdate(
        target,
        input.content,
        currentContent,
        join(projectDirectory, MANIFEST_FILE),
        next,
        store.maxMarkdownBytes,
        store.maxManifestBytes
      );
      await bumpRegistry(store, registry, now);
      return {
        id: nextEntry.id,
        stageId: nextEntry.stageId,
        title: nextEntry.title,
        body: input.content,
        createdAt: nextEntry.createdAt,
        updatedAt: nextEntry.updatedAt
      };
    }
    const next = FolderSkillProjectManifestSchema.parse({
      ...manifest,
      revision: manifest.revision + 1,
      updatedAt: now,
      entries
    });
    await commitProjectMarkdownUpdate(
      target,
      input.content,
      currentContent,
      join(projectDirectory, MANIFEST_FILE),
      next,
      store.maxMarkdownBytes,
      store.maxManifestBytes
    );
    await bumpRegistry(store, registry, now);
    const skillEntry =
      nextEntry as SkillLibraryProjectManifest["entries"][number];
    return {
      id: skillEntry.id,
      stageId: skillEntry.stageId,
      title: skillEntry.title,
      body: input.content,
      createdAt: skillEntry.createdAt,
      updatedAt: skillEntry.updatedAt,
      ...(skillEntry.marketplaceSource
        ? { marketplaceSource: skillEntry.marketplaceSource }
        : {}),
      ...(skillEntry.sourceCommonSkillId === undefined
        ? {}
        : { sourceCommonSkillId: skillEntry.sourceCommonSkillId }),
      ...(skillEntry.sourceSkillId === undefined
        ? {}
        : { sourceSkillId: skillEntry.sourceSkillId }),
      ...(skillEntry.sourceSkillEntryId === undefined
        ? {}
        : { sourceSkillEntryId: skillEntry.sourceSkillEntryId })
    };
  });
}
export async function createLibraryEntry(
  store: FolderCatalogStoreContext,
  rawInput: CreateFolderLibraryEntryInput
): Promise<MaterialEntry | SkillEntry> {
  const domain = parseLibraryDomain(rawInput.domain);
  const libraryId = parseId(rawInput.libraryId);
  const title = parseNonBlankString(rawInput.title, "library entry title");
  if (typeof rawInput.content !== "string") {
    throw new Error("library entry content must be a string.");
  }
  assertTextByteLength(
    rawInput.content,
    store.maxMarkdownBytes,
    "Markdown content"
  );
  if (rawInput.baseProjectRevision !== undefined) {
    assertProjectRevision(rawInput.baseProjectRevision);
  }
  return await mutate(store, async () => {
    const registry = await ensureRegistry(store);
    const projectDomain = libraryProjectDomain(domain);
    const registration = findRegistration(registry, libraryId, projectDomain);
    const projectDirectory = await secureProjectRoot(
      registration.projectDirectory
    );
    const manifest = await readManifest(
      store,
      projectDirectory,
      domain === "material"
        ? "deepwrite.material-library"
        : "deepwrite.skill-library",
      libraryId
    );
    if (!rawInput.force) {
      assertBaseRevision(rawInput.baseProjectRevision, manifest.revision);
    }
    const now = store.now();
    const id = createCatalogId(`${domain}-entry`);
    const path = await uniqueRelativeMarkdownPath(
      projectDirectory,
      "entries",
      id,
      new Set(
        manifest.entries.map((entry) => portableContentPathKey(entry.path))
      )
    );
    const target = await secureWritableProjectPath(projectDirectory, path);
    if (manifest.kind === "deepwrite.material-library") {
      const entry = {
        id,
        stageId:
          rawInput.domain === "material"
            ? (rawInput.stageId ?? "other")
            : "other",
        title,
        path,
        createdAt: now,
        updatedAt: now
      };
      const next = FolderMaterialProjectManifestSchema.parse({
        ...manifest,
        revision: manifest.revision + 1,
        updatedAt: now,
        entries: [...manifest.entries, entry]
      });
      await commitProjectMarkdownUpdate(
        target,
        rawInput.content,
        undefined,
        join(projectDirectory, MANIFEST_FILE),
        next,
        store.maxMarkdownBytes,
        store.maxManifestBytes
      );
      await bumpRegistry(store, registry, now);
      return {
        id: entry.id,
        stageId: entry.stageId,
        title: entry.title,
        body: rawInput.content,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt
      };
    }
    const entry = {
      id,
      stageId:
        rawInput.domain === "skill" ? (rawInput.stageId ?? "draft") : "draft",
      title,
      path,
      createdAt: now,
      updatedAt: now
    };
    const next = FolderSkillProjectManifestSchema.parse({
      ...manifest,
      revision: manifest.revision + 1,
      updatedAt: now,
      entries: [...manifest.entries, entry]
    });
    await commitProjectMarkdownUpdate(
      target,
      rawInput.content,
      undefined,
      join(projectDirectory, MANIFEST_FILE),
      next,
      store.maxMarkdownBytes,
      store.maxManifestBytes
    );
    await bumpRegistry(store, registry, now);
    return {
      id: entry.id,
      stageId: entry.stageId,
      title: entry.title,
      body: rawInput.content,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt
    };
  });
}
export async function moveLibraryEntry(
  store: FolderCatalogStoreContext,
  rawInput: MoveLibraryEntryInput
): Promise<MoveLibraryEntryResult> {
  const input = MoveLibraryEntryInputSchema.parse(rawInput);
  return await mutate(store, async () => {
    const registry = await ensureRegistry(store);
    const sourceDirectory = await secureProjectRoot(
      findRegistration(
        registry,
        input.sourceLibraryId,
        libraryProjectDomain(input.domain)
      ).projectDirectory
    );
    const sourceManifest = await readManifest(
      store,
      sourceDirectory,
      input.domain === "material"
        ? "deepwrite.material-library"
        : "deepwrite.skill-library",
      input.sourceLibraryId
    );
    const entryIndex = sourceManifest.entries.findIndex(
      ({ id }) => id === input.entryId
    );
    if (entryIndex < 0) throw new Error("要移动的资料库条目不存在。");
    if (
      sourceManifest.kind === "deepwrite.skill-library" &&
      sourceManifest.isBuiltin
    ) {
      throw new Error("内置技能库条目不能移动。");
    }
    if (!input.force)
      assertBaseRevision(
        input.sourceBaseProjectRevision,
        sourceManifest.revision
      );
    const sourceEntry = sourceManifest.entries[entryIndex]!;
    const now = store.now();
    if (input.sourceLibraryId === input.targetLibraryId) {
      const remaining = sourceManifest.entries.filter(
        ({ id }) => id !== input.entryId
      );
      const beforeIndex = input.beforeEntryId
        ? remaining.findIndex(({ id }) => id === input.beforeEntryId)
        : -1;
      remaining.splice(
        beforeIndex < 0 ? remaining.length : beforeIndex,
        0,
        sourceEntry
      );
      const next =
        sourceManifest.kind === "deepwrite.material-library"
          ? MaterialLibraryProjectManifestSchema.parse({
              ...sourceManifest,
              revision: sourceManifest.revision + 1,
              updatedAt: now,
              entries: remaining
            })
          : SkillLibraryProjectManifestSchema.parse({
              ...sourceManifest,
              revision: sourceManifest.revision + 1,
              updatedAt: now,
              entries: remaining
            });
      await atomicWriteJson(
        join(sourceDirectory, MANIFEST_FILE),
        next,
        store.maxManifestBytes
      );
      await bumpRegistry(store, registry, now);
      return {
        domain: input.domain,
        sourceLibraryId: input.sourceLibraryId,
        targetLibraryId: input.targetLibraryId,
        entryId: input.entryId
      };
    }
    const targetDirectory = await secureProjectRoot(
      findRegistration(
        registry,
        input.targetLibraryId,
        libraryProjectDomain(input.domain)
      ).projectDirectory
    );
    const targetManifest = await readManifest(
      store,
      targetDirectory,
      input.domain === "material"
        ? "deepwrite.material-library"
        : "deepwrite.skill-library",
      input.targetLibraryId
    );
    if (!input.force)
      assertBaseRevision(
        input.targetBaseProjectRevision,
        targetManifest.revision
      );
    if (
      targetManifest.kind === "deepwrite.skill-library" &&
      targetManifest.isBuiltin
    ) {
      throw new Error("内置技能库为只读内容，不能移入条目。");
    }
    if (
      (sourceManifest.kind === "deepwrite.material-library" &&
        targetManifest.kind === "deepwrite.material-library" &&
        sourceManifest.materialType !== targetManifest.materialType) ||
      (sourceManifest.kind === "deepwrite.skill-library" &&
        targetManifest.kind === "deepwrite.skill-library" &&
        sourceManifest.skillType !== targetManifest.skillType)
    ) {
      throw new Error("不同创作类型的资料库条目不能直接移动。");
    }
    let targetStageId: MaterialStageId | undefined;
    if (
      sourceManifest.kind === "deepwrite.material-library" &&
      targetManifest.kind === "deepwrite.material-library"
    ) {
      const materialEntry =
        sourceEntry as MaterialLibraryProjectManifest["entries"][number];
      const allowed: Record<string, readonly string[]> = {
        character: ["character"],
        gimmick: ["gimmick"],
        plot: ["pacing", "intro", "plot_refine"],
        draft: ["draft_excerpt"],
        other: ["other"],
        mixed: [materialEntry.stageId]
      };
      const selectedTargetStage = input.targetStageId ?? materialEntry.stageId;
      targetStageId = selectedTargetStage;
      if (
        sourceManifest.materialKind !== targetManifest.materialKind &&
        input.targetStageId === undefined
      ) {
        throw new Error("移动到不同素材分类时，请选择目标内容阶段。");
      }
      if (
        !(allowed[targetManifest.materialKind] ?? []).includes(
          selectedTargetStage
        )
      ) {
        throw new Error("目标素材库分类不支持该素材条目的内容阶段。");
      }
    } else if (input.targetStageId !== undefined) {
      throw new Error("只有素材条目可以调整内容阶段。");
    }
    if (targetManifest.entries.some(({ id }) => id === sourceEntry.id)) {
      throw new Error("目标资料库已存在同 ID 条目，无法移动。");
    }
    const sourceContent = await readProjectMarkdown(
      sourceDirectory,
      sourceEntry.path,
      store.maxMarkdownBytes
    );
    const targetPath = await uniqueRelativeMarkdownPath(
      targetDirectory,
      "entries",
      sourceEntry.id,
      new Set(
        targetManifest.entries.map((entry) =>
          portableContentPathKey(entry.path)
        )
      )
    );
    const targetFile = await secureWritableProjectPath(
      targetDirectory,
      targetPath
    );
    const movedEntry = {
      ...sourceEntry,
      path: targetPath,
      updatedAt: now,
      ...(targetStageId === undefined ? {} : { stageId: targetStageId })
    };
    const targetEntries = [...targetManifest.entries];
    const beforeIndex = input.beforeEntryId
      ? targetEntries.findIndex(({ id }) => id === input.beforeEntryId)
      : -1;
    targetEntries.splice(
      beforeIndex < 0 ? targetEntries.length : beforeIndex,
      0,
      movedEntry
    );
    const nextTarget =
      targetManifest.kind === "deepwrite.material-library"
        ? MaterialLibraryProjectManifestSchema.parse({
            ...targetManifest,
            revision: targetManifest.revision + 1,
            updatedAt: now,
            entries: targetEntries
          })
        : SkillLibraryProjectManifestSchema.parse({
            ...targetManifest,
            revision: targetManifest.revision + 1,
            updatedAt: now,
            entries: targetEntries
          });
    const nextSourceEntries = sourceManifest.entries.filter(
      ({ id }) => id !== input.entryId
    );
    const nextSource =
      sourceManifest.kind === "deepwrite.material-library"
        ? MaterialLibraryProjectManifestSchema.parse({
            ...sourceManifest,
            revision: sourceManifest.revision + 1,
            updatedAt: now,
            entries: nextSourceEntries
          })
        : SkillLibraryProjectManifestSchema.parse({
            ...sourceManifest,
            revision: sourceManifest.revision + 1,
            updatedAt: now,
            entries: nextSourceEntries
          });
    await commitProjectMarkdownUpdate(
      targetFile,
      sourceContent,
      undefined,
      join(targetDirectory, MANIFEST_FILE),
      nextTarget,
      store.maxMarkdownBytes,
      store.maxManifestBytes
    );
    await atomicWriteJson(
      join(sourceDirectory, MANIFEST_FILE),
      nextSource,
      store.maxManifestBytes
    );
    const sourceFile = await secureExistingProjectPath(
      sourceDirectory,
      sourceEntry.path,
      true
    );
    await unlinkOptional(sourceFile);
    await bumpRegistry(store, registry, now);
    return {
      domain: input.domain,
      sourceLibraryId: input.sourceLibraryId,
      targetLibraryId: input.targetLibraryId,
      entryId: input.entryId
    };
  });
}
export async function removeLibraryEntry(
  store: FolderCatalogStoreContext,
  rawInput: RemoveFolderLibraryEntryInput
): Promise<RemoveFolderLibraryEntryResult> {
  const domain = parseLibraryDomain(rawInput.domain);
  const libraryId = parseId(rawInput.libraryId);
  const entryId = parseId(rawInput.entryId);
  if (rawInput.baseProjectRevision !== undefined) {
    assertProjectRevision(rawInput.baseProjectRevision);
  }
  return await mutate(store, async () => {
    const registry = await ensureRegistry(store);
    const projectDomain = libraryProjectDomain(domain);
    const registration = findRegistration(registry, libraryId, projectDomain);
    const projectDirectory = await secureProjectRoot(
      registration.projectDirectory
    );
    const manifest = await readManifest(
      store,
      projectDirectory,
      domain === "material"
        ? "deepwrite.material-library"
        : "deepwrite.skill-library",
      libraryId
    );
    if (!rawInput.force) {
      assertBaseRevision(rawInput.baseProjectRevision, manifest.revision);
    }
    const entryIndex = manifest.entries.findIndex(({ id }) => id === entryId);
    if (entryIndex < 0) {
      return { libraryId, entryId, deleted: false };
    }
    const existing = manifest.entries[entryIndex]!;
    const target = await secureExistingProjectPath(
      projectDirectory,
      existing.path,
      true
    );
    const entries = manifest.entries.filter(({ id }) => id !== entryId);
    const now = store.now();
    const next =
      manifest.kind === "deepwrite.material-library"
        ? FolderMaterialProjectManifestSchema.parse({
            ...manifest,
            revision: manifest.revision + 1,
            updatedAt: now,
            entries
          })
        : FolderSkillProjectManifestSchema.parse({
            ...manifest,
            revision: manifest.revision + 1,
            updatedAt: now,
            entries
          });
    assertJsonByteLength(next, store.maxManifestBytes);
    const stagedDeletion = join(
      dirname(target),
      `.deepwrite-delete-${randomHex8()}.tmp`
    );
    await rename(target, stagedDeletion);
    try {
      if (!rawInput.force && rawInput.baseRevision !== undefined) {
        const stagedContent = await readRequiredUtf8File(
          stagedDeletion,
          store.maxMarkdownBytes,
          "Markdown content"
        );
        const actualRevision =
          createShortWorkspaceContentRevision(stagedContent);
        if (rawInput.baseRevision !== actualRevision) {
          throw new FolderCatalogConflictError(
            rawInput.baseRevision,
            actualRevision
          );
        }
      }
      await atomicWriteJson(
        join(projectDirectory, MANIFEST_FILE),
        next,
        store.maxManifestBytes
      );
    } catch (error: unknown) {
      await rename(stagedDeletion, target);
      throw error;
    }
    await bumpRegistry(store, registry, now);
    try {
      await unlinkOptional(stagedDeletion);
    } catch {
      // The manifest no longer references this hidden backup, so deletion is
      // already logically committed. A cleanup failure must not be reported
      // as if the user's entry were still present.
    }
    return { libraryId, entryId, deleted: true };
  });
}
