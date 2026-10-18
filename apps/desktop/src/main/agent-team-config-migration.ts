import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  AgentTeamCatalogSnapshotSchema,
  type AgentTeamCatalogSnapshot,
  type LongAgentTeamSettings
} from "@deepwrite/contracts";
import { invalidAgentTeamConfig } from "./agent-team-config-error";
import {
  createAgentTeamProfile,
  defaultAgentTeamName
} from "./agent-team-profile-factory";
import { migrateLegacyLongAgentTeamSettings } from "./legacy-long-agent-team-migration";

export {
  migrateVersionOneCatalog,
  tryMigrateCombinedCatalog
} from "./agent-team-catalog-migration";
export { invalidAgentTeamConfig } from "./agent-team-config-error";
export { createAgentTeamProfile } from "./agent-team-profile-factory";

export const AGENT_TEAM_CATALOG_DISK_VERSION = 5 as const;

export interface AgentTeamDiskCatalog extends AgentTeamCatalogSnapshot {
  version: typeof AGENT_TEAM_CATALOG_DISK_VERSION;
}

export interface LegacyAgentTeamPaths {
  long: string;
}

export async function readAgentTeamJson(path: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as unknown;
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

export async function atomicWriteAgentTeamJson(
  path: string,
  value: unknown
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600
  });
  await rename(temporary, path);
}

function catalogFromLongSettings(
  settings: readonly LongAgentTeamSettings[],
  enabled: boolean
): AgentTeamCatalogSnapshot {
  const teams = settings.map((candidate, index) =>
    createAgentTeamProfile(
      index === 0 ? defaultAgentTeamName() : `迁移创作团队 ${index + 1}`,
      candidate
    )
  );
  return AgentTeamCatalogSnapshotSchema.parse({
    enabledTeamIds: enabled ? { long: teams[0]!.id } : {},
    teams
  });
}

export async function createCatalogFromLegacyFiles(
  paths: LegacyAgentTeamPaths
): Promise<AgentTeamCatalogSnapshot> {
  const raw = await readAgentTeamJson(paths.long);
  if (raw === undefined)
    return catalogFromLongSettings([createAgentTeamProfile().settings], false);
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw invalidAgentTeamConfig();
  const { version: _version, ...settings } = raw as Record<string, unknown>;
  const migrated = migrateLegacyLongAgentTeamSettings(settings);
  if (!migrated) throw invalidAgentTeamConfig();
  return catalogFromLongSettings(migrated, true);
}

export function tryMigrateStandaloneCatalog(
  raw: Record<string, unknown>
): AgentTeamCatalogSnapshot | undefined {
  const migrated = migrateLegacyLongAgentTeamSettings(raw);
  return migrated ? catalogFromLongSettings(migrated, true) : undefined;
}
