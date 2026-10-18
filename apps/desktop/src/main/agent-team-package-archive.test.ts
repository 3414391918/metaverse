import { describe, expect, it } from "vitest";
import {
  DEFAULT_LONG_AGENT_TEAM_SETTINGS,
  type AgentTeamProfile
} from "@deepwrite/contracts";
import {
  AGENT_TEAM_PACKAGE_MAX_BYTES,
  createAgentTeamPackage,
  readAgentTeamPackage
} from "./agent-team-package-archive";

function team(): AgentTeamProfile {
  const settings = structuredClone(DEFAULT_LONG_AGENT_TEAM_SETTINGS);
  settings.teams[0]!.subagents.push({
    id: "reviewer",
    name: "审阅智能体",
    description: "检查成稿",
    systemPrompt: "完整检查成稿。",
    enabled: true,
    modelMode: "inherit"
  });
  return {
    id: "team_package_source",
    name: "雨夜审稿团队",
    workspaceType: "long",
    settings
  };
}

function legacyArchive(workspaceType: "short" | "script"): Buffer {
  const manifest = {
    format: "deepwrite-agent-team",
    version: 1,
    exportedAt: "2026-08-27T08:00:00.000Z",
    team: {
      ...team(),
      workspaceType,
      settings: {
        workspaceType,
        teams: [{ parentAgentId: workspaceType, subagents: [] }]
      }
    }
  };
  const name = Buffer.from("deepwrite-agent-team.json");
  const data = Buffer.from(JSON.stringify(manifest));
  let checksum = 0xffffffff;
  for (const byte of data) {
    checksum ^= byte;
    for (let bit = 0; bit < 8; bit += 1)
      checksum = checksum & 1 ? 0xedb88320 ^ (checksum >>> 1) : checksum >>> 1;
  }
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt32LE((checksum ^ 0xffffffff) >>> 0, 14);
  header.writeUInt32LE(data.length, 18);
  header.writeUInt32LE(data.length, 22);
  header.writeUInt16LE(name.length, 26);
  const end = Buffer.alloc(4);
  end.writeUInt32LE(0x06054b50);
  return Buffer.concat([header, name, data, end]);
}

describe("agent team package archive", () => {
  it.each(["short", "script"] as const)(
    "explicitly refuses old %s archives",
    (workspaceType) => {
      expect(() => readAgentTeamPackage(legacyArchive(workspaceType))).toThrow(
        "仅支持当前主智能体"
      );
    }
  );
  it("round-trips the complete versioned team manifest", () => {
    const source = team();
    const archive = createAgentTeamPackage(
      source,
      new Date("2026-08-27T08:00:00.000Z")
    );

    expect(archive.readUInt32LE(0)).toBe(0x04034b50);
    expect(readAgentTeamPackage(archive)).toEqual(source);
  });

  it("rejects corrupted and oversized uploads", () => {
    const corrupted = createAgentTeamPackage(team());
    const nameLength = corrupted.readUInt16LE(26);
    const dataOffset = 30 + nameLength;
    corrupted[dataOffset] = (corrupted[dataOffset] ?? 0) ^ 0xff;

    expect(() => readAgentTeamPackage(corrupted)).toThrow();
    expect(() =>
      readAgentTeamPackage(Buffer.alloc(AGENT_TEAM_PACKAGE_MAX_BYTES + 1))
    ).toThrow("5 MB");
  });
});
