import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_LONG_AGENT_PROFILES,
  type CommandEnvelope,
  type MaterialCatalogEntry,
  type MaterialReadScope
} from "@deepwrite/contracts";
import { workspace } from "../../../../packages/pi-runtime-adapter/src/long-agent-tools.test-support";
const fixtureWorkspace = () => workspace("long", "character_design");
import {
  prepareMaterialRunContext,
  resolveMaterialReadScope
} from "./material-run-context";
import { authorizeMainInternalCommand } from "./internal-command-authorizer";
import {
  CatalogQueryMaterialsCommandEnvelopeSchema,
  createEnvelope
} from "@deepwrite/contracts";

const scope: MaterialReadScope = {
  bookId: "book-test",
  bookType: "long",
  stageId: "character_design",
  kinds: ["character"]
};
const entry: MaterialCatalogEntry = {
  id: "material:library:entry",
  title: "库 · 条目",
  libraryId: "library",
  entryId: "entry",
  kind: "character",
  revision: "v1:1:00000000",
  metadata: {
    name: "条目",
    description: "正文摘录",
    nameSource: "title",
    descriptionSource: "excerpt"
  }
};

describe("Main-owned material queries", () => {
  it("derives kind restrictions from the profile and ignores a supplied catalog scope", async () => {
    const workspace = fixtureWorkspace();
    const longAgentProfile = DEFAULT_LONG_AGENT_PROFILES.find(
      (profile) => profile.id === "long"
    )!;
    const workspaceContext = {
      longWorkspace: workspace,
      materialCatalog: { scope, entries: [entry], total: 1, notices: [] }
    };
    const trusted = resolveMaterialReadScope({
      workspaceContext,
      longAgentProfile
    })!;
    expect(trusted.bookId).toBe(workspace.bookId);
    const request = vi.fn(async (command: CommandEnvelope) => ({
      status: "accepted" as const,
      requestId: command.id,
      payload: {
        status: "ok",
        entries: [entry],
        total: 70,
        nextCursor: 64,
        notices: []
      }
    }));
    const prepared = await prepareMaterialRunContext(
      { workspaceContext, longAgentProfile },
      request
    );
    expect(prepared?.materialCatalog?.scope).toEqual(trusted);
    expect(prepared?.attachedMaterials).toEqual([]);
    expect(request).toHaveBeenCalledTimes(1);
    expect(prepared?.materialCatalog?.total).toBe(70);
  });

  it("supports an explicit fallback to bounded original snapshots", async () => {
    const request = vi.fn(async (command: CommandEnvelope) => ({
      status: "accepted" as const,
      requestId: command.id,
      payload: {
        status: "ok",
        entries: [entry],
        total: 1,
        notices: [],
        ...(command.type === "catalog.queryMaterials" &&
        command.payload.mode === "read"
          ? { content: "旧素材原文" }
          : {})
      }
    }));
    const result = await prepareMaterialRunContext(
      {
        workspaceContext: { longWorkspace: fixtureWorkspace() },
        longAgentProfile: DEFAULT_LONG_AGENT_PROFILES[0]!,
        snapshotMode: true
      },
      request
    );
    expect(result?.materialCatalog).toBeUndefined();
    expect(result?.attachedMaterials?.[0]?.content).toBe("旧素材原文");
    expect(result?.materialReadNotice).toContain("附件快照");
  });

  it("rejects stale runs, different prompts, expanded scopes and unrelated sessions", () => {
    const command = CatalogQueryMaterialsCommandEnvelopeSchema.parse(
      createEnvelope(
        "catalog.queryMaterials",
        { scope, mode: "list" },
        {
          id: "query",
          context: {
            runId: "run",
            sessionId: "session",
            resourceId: scope.bookId
          }
        }
      )
    );
    const context = {
      source: "agent" as const,
      target: "core" as const,
      message: {
        kind: "utility.internal.command.request" as const,
        worker: "agent" as const,
        target: "core" as const,
        requestId: "query",
        parentRequestId: "prompt",
        timeoutMs: 1000,
        command
      }
    };
    const run = {
      sessionId: "session",
      promptRequestId: "prompt",
      accepted: true,
      materialScope: scope
    };
    expect(authorizeMainInternalCommand(context, new Map([["run", run]]))).toBe(
      true
    );
    for (const deniedRun of [
      { ...run, accepted: false },
      { ...run, promptRequestId: "other" },
      { ...run, sessionId: "other" },
      { ...run, materialScope: { ...scope, kinds: [] } },
      { ...run, materialScope: { ...scope, bookId: "another-book" } }
    ]) {
      expect(
        authorizeMainInternalCommand(context, new Map([["run", deniedRun]]))
      ).toMatchObject({ authorized: false });
    }
    expect(authorizeMainInternalCommand(context, new Map())).toMatchObject({
      authorized: false
    });
  });
});
