import { describe, expect, it } from "vitest";
import appSource from "./test-support/workspaceShellSource";
import libraryTransactionsSource from "./composables/useCatalogLibraryTransactionsCoordinator.ts?raw";
import longBookLifecycleSource from "./composables/useLongBookLifecycleCoordinator.ts?raw";

describe("project duplicate integration", () => {
  it("saves catalog drafts, calls the duplicate API and navigates to normal copies", () => {
    expect(appSource).toContain("prepareLibraryProjectsForDuplicate");
    expect(libraryTransactionsSource).toContain(
      'payload.action === "duplicate-group"'
    );
    expect(libraryTransactionsSource).toContain(
      "duplicated.copiedMemberLibraryIds.length"
    );
    expect(libraryTransactionsSource).toContain("api.duplicateProject({");
  });

  it("saves the active long editor and opens the copy", () => {
    expect(longBookLifecycleSource).toContain('case "duplicate"');
    expect(longBookLifecycleSource).toContain(
      "await session.saveActiveEditorChanges()"
    );
    expect(longBookLifecycleSource).toContain(
      "await api.duplicateBook({ bookId })"
    );
    expect(longBookLifecycleSource).toContain(
      "await resources.selectBook(duplicated.book.id)"
    );
  });
});
