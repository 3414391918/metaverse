import { vi } from "vitest";
import type { DeepWriteApi } from "@deepwrite/contracts/renderer";

export function createConversationCatalogTestApi(): DeepWriteApi["catalog"] {
  return {
    loadDraftRecovery: vi.fn(async () => ({})),
    saveDraftRecovery: vi.fn(async () => undefined),
    index: vi.fn(async () => {
      throw new Error("Catalog is not used by conversation tests.");
    }),
    readDocument: vi.fn(async () => {
      throw new Error("Catalog is not used by conversation tests.");
    }),
    readWritingContext: vi.fn(async ({ bookId }) => ({
      bookId,
      workspaceType: bookId.startsWith("script_")
        ? ("script" as const)
        : ("short" as const),
      content: "# 测试作品上下文",
      truncated: false
    })),
    writeWritingContext: vi.fn(async () => {
      throw new Error(
        "Writing context save is not used by conversation tests."
      );
    }),
    snapshot: vi.fn(async () => {
      throw new Error("Catalog is not used by conversation tests.");
    }),
    openProject: vi.fn(async () => null),
    importLegacyLibrary: vi.fn(async () => null),
    chooseExternalLibraryEntries: vi.fn(async () => null),
    importLibraryEntries: vi.fn(),
    createLibrary: vi.fn(async () => {
      throw new Error("Catalog is not used by conversation tests.");
    }),
    updateLibrary: vi.fn(async () => {
      throw new Error("Catalog is not used by conversation tests.");
    }),
    createLibraryGroup: vi.fn(async () => {
      throw new Error("Catalog is not used by conversation tests.");
    }),
    updateBook: vi.fn(async () => {
      throw new Error("Catalog is not used by conversation tests.");
    }),
    updateLibraryGroup: vi.fn(async () => {
      throw new Error("Catalog is not used by conversation tests.");
    }),
    deleteBook: vi.fn(async () => {
      throw new Error("Catalog is not used by conversation tests.");
    }),
    saveDocument: vi.fn(async () => {
      throw new Error("Catalog is not used by conversation tests.");
    }),
    saveLibraryEntry: vi.fn(async () => {
      throw new Error("Catalog is not used by conversation tests.");
    }),
    createLibraryEntry: vi.fn(async () => {
      throw new Error("Catalog is not used by conversation tests.");
    }),
    removeLibraryEntry: vi.fn(async () => {
      throw new Error("Catalog is not used by conversation tests.");
    }),
    moveLibraryEntry: vi.fn(async () => {
      throw new Error("Catalog is not used by conversation tests.");
    }),
    unregisterProject: vi.fn(async () => {
      throw new Error("Catalog is not used by conversation tests.");
    }),
    deleteProject: vi.fn(async () => {
      throw new Error("Catalog is not used by conversation tests.");
    }),
    duplicateProject: vi.fn(async () => {
      throw new Error("Catalog is not used by conversation tests.");
    })
  };
}
