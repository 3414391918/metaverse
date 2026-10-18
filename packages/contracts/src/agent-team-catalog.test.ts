import { describe, expect, it } from "vitest";
import {
  AgentTeamCatalogSnapshotSchema,
  AgentTeamPackageExportResultSchema,
  AgentTeamPackageInstallResultSchema,
  AgentTeamPackageManifestSchema,
  CommandEnvelopeSchema,
  AgentTeamProfileCreateInputSchema,
  AgentTeamProfileSaveInputSchema,
  DEFAULT_LONG_AGENT_TEAM_SETTINGS,
  createEnvelope
} from "./index";

function longProfile(id = "team_long", name = "创作团队") {
  return {
    id,
    name,
    workspaceType: "long" as const,
    settings: DEFAULT_LONG_AGENT_TEAM_SETTINGS
  };
}

describe("agent team catalog contracts", () => {
  it("creates by name and rejects discontinued create/save inputs", () => {
    expect(AgentTeamProfileCreateInputSchema.parse({ name: "新团队" })).toEqual(
      { name: "新团队" }
    );
    for (const workspaceType of ["short", "script"]) {
      expect(
        AgentTeamProfileCreateInputSchema.safeParse({
          name: "旧团队",
          workspaceType
        }).success
      ).toBe(false);
      expect(
        AgentTeamProfileSaveInputSchema.safeParse({
          teamId: "team_old",
          settings: { workspaceType, teams: [] }
        }).success
      ).toBe(false);
    }
  });
  it("allows the main agent to be disabled and validates enabled references", () => {
    expect(
      AgentTeamCatalogSnapshotSchema.parse({
        enabledTeamIds: {},
        teams: [longProfile()]
      }).enabledTeamIds
    ).toEqual({});
    expect(() =>
      AgentTeamCatalogSnapshotSchema.parse({
        enabledTeamIds: { long: "team_missing" },
        teams: [longProfile()]
      })
    ).toThrow();
  });

  it("requires unique ids and case-insensitively unique names", () => {
    expect(() =>
      AgentTeamCatalogSnapshotSchema.parse({
        enabledTeamIds: {},
        teams: [longProfile(), longProfile("team_second", "创作团队")]
      })
    ).toThrow();
    expect(() =>
      AgentTeamCatalogSnapshotSchema.parse({
        enabledTeamIds: {},
        teams: [longProfile("team_same"), longProfile("team_same", "另一团队")]
      })
    ).toThrow();
  });

  it("registers all catalog lifecycle commands", () => {
    const commands = [
      createEnvelope("agentTeams.list", {}, { id: "list" }),
      createEnvelope(
        "agentTeams.create",
        { name: "审稿团队" },
        { id: "create" }
      ),
      createEnvelope(
        "agentTeams.rename",
        { teamId: "team_long", name: "主团队" },
        { id: "rename" }
      ),
      createEnvelope(
        "agentTeams.setEnabled",
        { teamId: "team_long", enabled: true },
        { id: "enable" }
      ),
      createEnvelope(
        "agentTeams.delete",
        { teamId: "team_second" },
        { id: "delete" }
      ),
      createEnvelope(
        "agentTeams.save",
        { teamId: "team_long", settings: DEFAULT_LONG_AGENT_TEAM_SETTINGS },
        { id: "save" }
      ),
      createEnvelope(
        "agentTeams.exportPackage",
        { teamId: "team_long" },
        { id: "export" }
      ),
      createEnvelope("agentTeams.installPackage", {}, { id: "install" })
    ];
    expect(
      commands.every(
        (command) => CommandEnvelopeSchema.safeParse(command).success
      )
    ).toBe(true);
  });

  it("validates versioned package manifests and file operation results", () => {
    expect(
      AgentTeamPackageManifestSchema.parse({
        format: "deepwrite-agent-team",
        version: 1,
        exportedAt: "2026-08-27T08:00:00.000Z",
        team: longProfile()
      }).team.name
    ).toBe("创作团队");
    expect(
      AgentTeamPackageExportResultSchema.parse({
        status: "saved",
        filePath: "/tmp/team.zip"
      }).status
    ).toBe("saved");
    expect(
      AgentTeamPackageInstallResultSchema.parse({
        status: "installed",
        teamId: "team_installed",
        teamName: "已安装团队",
        catalog: {
          enabledTeamIds: {},
          teams: [longProfile("team_installed", "已安装团队")]
        }
      }).status
    ).toBe("installed");
  });
});
