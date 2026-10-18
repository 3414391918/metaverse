import {
  AGENT_TEAM_PROFILE_NAME_MAX_LENGTH,
  AgentTeamCatalogSnapshotSchema,
  AgentTeamProfileIdSchema,
  AgentTeamProfileNameSchema,
  type AgentTeamCatalogSnapshot,
  type AgentTeamProfile
} from "@deepwrite/contracts";
import { invalidAgentTeamConfig } from "./agent-team-config-error";
import {
  createAgentTeamProfile,
  defaultAgentTeamName
} from "./agent-team-profile-factory";
import { migrateLegacyLongAgentTeamSettings } from "./legacy-long-agent-team-migration";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function migrationName(base: string, index: number, used: Set<string>): string {
  if (index === 0 && !used.has(base.toLocaleLowerCase())) {
    used.add(base.toLocaleLowerCase());
    return base;
  }
  for (let sequence = index + 1; ; sequence += 1) {
    const suffix = ` · 迁移 ${sequence}`;
    const name = `${base.slice(0, AGENT_TEAM_PROFILE_NAME_MAX_LENGTH - suffix.length)}${suffix}`;
    if (!used.has(name.toLocaleLowerCase())) {
      used.add(name.toLocaleLowerCase());
      return name;
    }
  }
}

function appendLongProfiles(
  candidate: Record<string, unknown>,
  settings: Record<string, unknown>,
  teams: AgentTeamProfile[],
  used: Set<string>
): boolean {
  const id = AgentTeamProfileIdSchema.safeParse(candidate.id);
  const name = AgentTeamProfileNameSchema.safeParse(candidate.name);
  const migrated = migrateLegacyLongAgentTeamSettings(settings);
  if (!id.success || !name.success || !migrated) return false;
  if (
    teams.some(
      (team) =>
        team.id === id.data ||
        team.name.toLocaleLowerCase() === name.data.toLocaleLowerCase()
    )
  )
    return false;
  migrated.forEach((longSettings, index) => {
    const profile = createAgentTeamProfile(
      migrationName(name.data, index, used),
      longSettings
    );
    if (index === 0) profile.id = id.data;
    teams.push(profile);
  });
  return true;
}

export function migrateVersionOneCatalog(
  raw: Record<string, unknown>
): AgentTeamCatalogSnapshot {
  const active = AgentTeamProfileIdSchema.safeParse(raw.activeTeamId);
  if (!active.success || !Array.isArray(raw.teams) || raw.teams.length === 0)
    throw invalidAgentTeamConfig();
  const teams: AgentTeamProfile[] = [];
  const usedNames = new Set<string>();
  for (const candidate of raw.teams) {
    if (!isRecord(candidate) || !isRecord(candidate.longSettings))
      throw invalidAgentTeamConfig();
    const normalized = {
      ...candidate,
      name:
        raw.teams.length === 1 && candidate.name === "默认团队"
          ? defaultAgentTeamName()
          : candidate.name
    };
    if (
      !appendLongProfiles(normalized, candidate.longSettings, teams, usedNames)
    )
      throw invalidAgentTeamConfig();
  }
  return AgentTeamCatalogSnapshotSchema.parse({
    enabledTeamIds: { long: active.data },
    ...(raw.builtinSubagents === undefined
      ? {}
      : { builtinSubagents: raw.builtinSubagents }),
    teams
  });
}

function migrateProfileCatalog(
  raw: Record<string, unknown>
): AgentTeamCatalogSnapshot | undefined {
  if (
    !isRecord(raw.enabledTeamIds) ||
    !Array.isArray(raw.teams) ||
    raw.teams.length === 0
  )
    return undefined;
  const teams: AgentTeamProfile[] = [];
  const usedNames = new Set<string>();
  for (const candidate of raw.teams) {
    if (!isRecord(candidate)) return undefined;
    if (
      candidate.workspaceType === "short" ||
      candidate.workspaceType === "script"
    )
      continue;
    if (candidate.workspaceType !== "long" || !isRecord(candidate.settings))
      return undefined;
    if (!appendLongProfiles(candidate, candidate.settings, teams, usedNames))
      return undefined;
  }
  if (teams.length === 0) teams.push(createAgentTeamProfile());
  const parsed = AgentTeamCatalogSnapshotSchema.safeParse({
    enabledTeamIds:
      typeof raw.enabledTeamIds.long === "string"
        ? { long: raw.enabledTeamIds.long }
        : {},
    ...(raw.builtinSubagents === undefined
      ? {}
      : { builtinSubagents: raw.builtinSubagents }),
    teams
  });
  return parsed.success ? parsed.data : undefined;
}

export function tryMigrateCombinedCatalog(
  raw: Record<string, unknown>
): AgentTeamCatalogSnapshot | undefined {
  const profileCatalog = migrateProfileCatalog(raw);
  if (profileCatalog) return profileCatalog;
  try {
    return migrateVersionOneCatalog(raw);
  } catch {
    return undefined;
  }
}
