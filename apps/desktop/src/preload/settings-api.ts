import {
  ExportLongManuscriptInputSchema,
  ExportLongManuscriptResultSchema,
  GeneralSettingsSchema,
  GeneralSettingsSnapshotSchema,
  LibraryAgentDomainSchema,
  LibraryAgentSettingsInputSchema,
  LibraryAgentSettingsSchema,
  LongAgentIdSchema,
  LongAgentSettingsInputSchema,
  LongAgentSettingsSchema,
  WorkspaceDirectorySettingsSchema,
  createEnvelope,
  type ExportLongManuscriptInput,
  type ExportLongManuscriptResult,
  type GeneralSettings,
  type GeneralSettingsSnapshot,
  type LibraryAgentDomain,
  type LibraryAgentSettings,
  type LibraryAgentSettingsInput,
  type LongAgentId,
  type LongAgentSettings,
  type LongAgentSettingsInput,
  type WorkspaceDirectorySettings
} from "@deepwrite/contracts";
import { browserId, invokeCommand } from "./invoke";
export async function listLongAgents(): Promise<LongAgentSettings> {
  const id = browserId("cmd_long_agents_list");
  return LongAgentSettingsSchema.parse(
    await invokeCommand<LongAgentSettings>(
      createEnvelope("longAgents.list", {}, { id, correlationId: id })
    )
  );
}

export async function saveLongAgents(
  rawSettings: LongAgentSettingsInput
): Promise<LongAgentSettings> {
  const settings = LongAgentSettingsInputSchema.parse(rawSettings);
  const id = browserId("cmd_long_agents_save");
  return LongAgentSettingsSchema.parse(
    await invokeCommand<LongAgentSettings>(
      createEnvelope("longAgents.save", settings, {
        id,
        correlationId: id
      })
    )
  );
}

export async function resetLongAgents(
  rawAgentId?: LongAgentId
): Promise<LongAgentSettings> {
  const agentId = rawAgentId ? LongAgentIdSchema.parse(rawAgentId) : undefined;
  const id = browserId("cmd_long_agents_reset");
  return LongAgentSettingsSchema.parse(
    await invokeCommand<LongAgentSettings>(
      createEnvelope(
        "longAgents.reset",
        { ...(agentId ? { agentId } : {}) },
        { id, correlationId: id }
      )
    )
  );
}

export async function listLibraryAgents(): Promise<LibraryAgentSettings> {
  const id = browserId("cmd_library_agents_list");
  return LibraryAgentSettingsSchema.parse(
    await invokeCommand<LibraryAgentSettings>(
      createEnvelope("libraryAgents.list", {}, { id, correlationId: id })
    )
  );
}

export async function saveLibraryAgents(
  rawSettings: LibraryAgentSettingsInput
): Promise<LibraryAgentSettings> {
  const settings = LibraryAgentSettingsInputSchema.parse(rawSettings);
  const id = browserId("cmd_library_agents_save");
  return LibraryAgentSettingsSchema.parse(
    await invokeCommand<LibraryAgentSettings>(
      createEnvelope("libraryAgents.save", settings, { id, correlationId: id })
    )
  );
}

export async function resetLibraryAgents(
  rawDomain?: LibraryAgentDomain
): Promise<LibraryAgentSettings> {
  const domain = rawDomain
    ? LibraryAgentDomainSchema.parse(rawDomain)
    : undefined;
  const id = browserId("cmd_library_agents_reset");
  return LibraryAgentSettingsSchema.parse(
    await invokeCommand<LibraryAgentSettings>(
      createEnvelope(
        "libraryAgents.reset",
        { ...(domain ? { domain } : {}) },
        { id, correlationId: id }
      )
    )
  );
}

export async function listWorkspaceDirectory(): Promise<WorkspaceDirectorySettings> {
  const id = browserId("cmd_workspace_directory_list");
  return WorkspaceDirectorySettingsSchema.parse(
    await invokeCommand<WorkspaceDirectorySettings>(
      createEnvelope("workspaceDirectory.list", {}, { id, correlationId: id })
    )
  );
}

export async function chooseWorkspaceDirectory(): Promise<WorkspaceDirectorySettings | null> {
  const id = browserId("cmd_workspace_directory_choose");
  return WorkspaceDirectorySettingsSchema.nullable().parse(
    await invokeCommand<WorkspaceDirectorySettings | null>(
      createEnvelope("workspaceDirectory.choose", {}, { id, correlationId: id })
    )
  );
}

export async function listGeneralSettings(): Promise<GeneralSettingsSnapshot> {
  const id = browserId("cmd_general_settings_list");
  return GeneralSettingsSnapshotSchema.parse(
    await invokeCommand<GeneralSettingsSnapshot>(
      createEnvelope("generalSettings.list", {}, { id, correlationId: id })
    )
  );
}

export async function saveGeneralSettings(
  rawSettings: GeneralSettings
): Promise<GeneralSettingsSnapshot> {
  const settings = GeneralSettingsSchema.parse(rawSettings);
  const id = browserId("cmd_general_settings_save");
  return GeneralSettingsSnapshotSchema.parse(
    await invokeCommand<GeneralSettingsSnapshot>(
      createEnvelope("generalSettings.save", settings, {
        id,
        correlationId: id
      })
    )
  );
}

export async function exportLongManuscript(
  rawInput: ExportLongManuscriptInput
): Promise<ExportLongManuscriptResult> {
  const input = ExportLongManuscriptInputSchema.parse(rawInput);
  const id = browserId("cmd_manuscript_export_long");
  return ExportLongManuscriptResultSchema.parse(
    await invokeCommand<ExportLongManuscriptResult>(
      createEnvelope("manuscript.exportLong", input, {
        id,
        correlationId: id
      })
    )
  );
}
export { appearance } from "./appearance-api";
