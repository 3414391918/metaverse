import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { validateSmokeSummary } from "../apps/desktop/scripts/package-smoke-runner.mjs";

const repoRoot = resolve(import.meta.dirname, "..");

function summary() {
  return {
    health: {
      status: "ok",
      checkedAt: "2026-10-26T00:00:00.000Z",
      workers: [{ name: "core", status: "ok", pid: 1000, details: {} }]
    },
    unifiedCreation: {
      status: "ok",
      created: true,
      retiredApisAbsent: true,
      promptTemplates: {
        status: "ok",
        create: true,
        save: true,
        reopen: true,
        imagePreview: true,
        delete: true
      },
      tools: {
        status: "ok",
        save: true,
        linkedNavigation: true,
        scriptEdit: true,
        relations: true,
        confirmedDelete: true
      }
    },
    conversation: {
      status: "ok",
      staged: true,
      reopened: false,
      chunkPages: 3,
      metadataChunkPages: 4,
      unknownRetained: true,
      proposalRetained: true
    },
    chapterImages: {
      status: "ok",
      copied: true,
      replaced: true,
      reopened: true,
      referenceUnchanged: true,
      rendered: true,
      staleRejected: true
    },
    characterAppearances: {
      status: "ok",
      created: true,
      copied: true,
      referenceIsolated: true,
      persisted: true,
      described: true
    }
  };
}

describe("packaged persistence smoke acceptance", () => {
  it("requires the database path to have been exercised instead of accepting utility health alone", () => {
    const { conversation: _conversation, ...oldSummary } = summary();
    expect(() => validateSmokeSummary(oldSummary, false)).toThrow(
      "invalid smoke summary"
    );
    expect(() => validateSmokeSummary(summary(), false)).not.toThrow();
  });
  it("requires a single healthy Core worker and rejects retired agent/tool workers", () => {
    const multiWorker = summary();
    multiWorker.health.workers = [
      { name: "core", status: "ok", pid: 1, details: {} },
      { name: "agent", status: "ok", pid: 2, details: {} },
      { name: "tool", status: "ok", pid: 3, details: {} }
    ];
    expect(() => validateSmokeSummary(multiWorker, false)).toThrow(
      "invalid smoke summary"
    );
    const unhealthy = summary();
    unhealthy.health.workers[0].status = "error";
    expect(() => validateSmokeSummary(unhealthy, false)).toThrow(
      "invalid smoke summary"
    );
  });
  it("requires unified creation and both renderer smokes to cross the real application IPC routes", () => {
    const { unifiedCreation: _creation, ...missing } = summary();
    expect(() => validateSmokeSummary(missing, false)).toThrow(
      "invalid smoke summary"
    );
    for (const field of ["created", "retiredApisAbsent"]) {
      const incomplete = summary();
      incomplete.unifiedCreation[field] = false;
      expect(() => validateSmokeSummary(incomplete, false)).toThrow(
        "invalid smoke summary"
      );
    }
    for (const field of ["promptTemplates", "tools"]) {
      const incomplete = summary();
      incomplete.unifiedCreation[field] = { status: "error" };
      expect(() => validateSmokeSummary(incomplete, false)).toThrow(
        "invalid smoke summary"
      );
    }
  });
  it("requires chapter image and character appearance packaged flows to complete", () => {
    const { chapterImages: _images, ...noImages } = summary();
    expect(() => validateSmokeSummary(noImages, false)).toThrow(
      "invalid smoke summary"
    );
    const { characterAppearances: _appearances, ...noAppearances } = summary();
    expect(() => validateSmokeSummary(noAppearances, false)).toThrow(
      "invalid smoke summary"
    );
    const stale = summary();
    stale.chapterImages.staleRejected = false;
    expect(() => validateSmokeSummary(stale, false)).toThrow(
      "invalid smoke summary"
    );
  });
  it("requires the second application launch to read the previously committed profile", () => {
    const result = summary();
    expect(() => validateSmokeSummary(result, true)).toThrow(
      "invalid smoke summary"
    );
    result.conversation.reopened = true;
    expect(() => validateSmokeSummary(result, true)).not.toThrow();
    delete result.conversation.metadataChunkPages;
    expect(() => validateSmokeSummary(result, true)).toThrow(
      "invalid smoke summary"
    );
  });
  it("keeps packaged smoke free of the retired built-in faux model runtime", async () => {
    for (const scriptPath of [
      "apps/desktop/scripts/package-smoke-runner.mjs",
      "apps/desktop/scripts/electron-smoke.mjs",
      "apps/desktop/scripts/package-runtime-files.mjs",
      "apps/desktop/src/main/smoke.ts"
    ]) {
      const source = await readFile(resolve(repoRoot, scriptPath), "utf8");
      expect(
        source.includes("local-faux"),
        `${scriptPath} still references the built-in faux model runtime`
      ).toBe(false);
    }
  });
});
