import { vi } from "vitest";
import type { DeepWriteApi } from "@deepwrite/contracts";
export function createUnusedLongApi(): DeepWriteApi["long"] {
  const unused = vi.fn(async () => {
    throw new Error("Character assets are not used by conversation tests.");
  });
  return {
    getCharacterAppearanceReferences: unused,
    prepareCharacterAppearanceDirectory: unused,
    deleteCharacterAppearance: unused,
    readChapterImage: unused,
    addChapterImage: unused,
    replaceChapterImage: unused,
    deleteChapterImage: unused,
    copyChapterImage: unused,
    readClipboardImage: unused,
    readChapterVideo: unused,
    addChapterVideo: unused,
    replaceChapterVideo: unused,
    deleteChapterVideo: unused,
    copyChapterVideo: unused,
    readCharacterProfile: unused,
    saveCharacterProfile: unused,
    importCharacterAssets: unused,
    renameCharacterAsset: unused,
    deleteCharacterAsset: unused,
    copyCharacterAsset: unused,
    resolveConflicts: vi.fn(async () => {
      throw new Error("Long workspace is not used by conversation tests.");
    }),
    list: vi.fn(async () => {
      throw new Error("Long workspace is not used by conversation tests.");
    }),
    create: vi.fn(async () => null),
    duplicateBook: vi.fn(async () => {
      throw new Error("Long workspace is not used by conversation tests.");
    }),
    rename: vi.fn(async () => {
      throw new Error("Long workspace is not used by conversation tests.");
    }),
    updateBindings: vi.fn(async () => {
      throw new Error("Long workspace is not used by conversation tests.");
    }),
    chooseLegacySyncSource: vi.fn(async () => null),
    applyLegacySync: vi.fn(async () => {
      throw new Error("Long workspace is not used by conversation tests.");
    }),
    importPortable: vi.fn(async () => null),
    chooseContinuationImportSource: vi.fn(async () => null),
    importContinuation: vi.fn(async () => null),
    open: vi.fn(async () => {
      throw new Error("Long workspace is not used by conversation tests.");
    }),
    openExisting: vi.fn(async () => null),
    getWorkspaceIndex: vi.fn(async () => {
      throw new Error("Long workspace is not used by conversation tests.");
    }),
    readDocument: vi.fn(async () => {
      throw new Error("Long workspace is not used by conversation tests.");
    }),
    search: vi.fn(async () => {
      throw new Error("Long workspace is not used by conversation tests.");
    }),
    writeDocument: vi.fn(async () => {
      throw new Error("Long workspace is not used by conversation tests.");
    }),
    readAgentsMd: vi.fn(async () => {
      throw new Error("Long workspace is not used by conversation tests.");
    }),
    writeAgentsMd: vi.fn(async () => {
      throw new Error("Long workspace is not used by conversation tests.");
    }),
    previewOperations: vi.fn(async () => {
      throw new Error("Long workspace is not used by conversation tests.");
    }),
    applyOperations: vi.fn(async () => {
      throw new Error("Long workspace is not used by conversation tests.");
    }),
    writeChapter: vi.fn(async () => {
      throw new Error("Long workspace is not used by conversation tests.");
    }),
    commitChapter: vi.fn(async () => {
      throw new Error("Long workspace is not used by conversation tests.");
    }),
    deleteLedgerCommit: vi.fn(async () => {
      throw new Error("Long workspace is not used by conversation tests.");
    }),
    unregister: vi.fn(async () => {
      throw new Error("Long workspace is not used by conversation tests.");
    }),
    delete: vi.fn(async () => {
      throw new Error("Long workspace is not used by conversation tests.");
    })
  };
}
