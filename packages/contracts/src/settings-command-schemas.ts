import { AssistantCommandEnvelopeSchema } from "./assistant";
import {
  AppearanceFontsInstallCommandEnvelopeSchema,
  AppearanceFontsListCommandEnvelopeSchema,
  AppearanceFontsRemoveCommandEnvelopeSchema,
  AppearanceListCommandEnvelopeSchema,
  AppearanceSaveCommandEnvelopeSchema
} from "./appearance";
import {
  GeneralSettingsListCommandEnvelopeSchema,
  GeneralSettingsSaveCommandEnvelopeSchema
} from "./general-settings";
import {
  LibraryAgentsListCommandEnvelopeSchema,
  LibraryAgentsResetCommandEnvelopeSchema,
  LibraryAgentsSaveCommandEnvelopeSchema
} from "./library-agent";
import {
  LongAgentsListCommandEnvelopeSchema,
  LongAgentsResetCommandEnvelopeSchema,
  LongAgentsSaveCommandEnvelopeSchema
} from "./long-agent-settings";
import {
  PromptTemplatesCopyImageCommandEnvelopeSchema,
  PromptTemplatesDeleteCommandEnvelopeSchema,
  PromptTemplatesListCommandEnvelopeSchema,
  PromptTemplatesReadImageCommandEnvelopeSchema,
  PromptTemplatesSaveCommandEnvelopeSchema
} from "./prompt-templates";
import {
  WorkspaceDirectoryChooseCommandEnvelopeSchema,
  WorkspaceDirectoryListCommandEnvelopeSchema,
  WorkspaceDirectoryRestoreCommandEnvelopeSchema,
  WorkspaceDirectoryMigrateCommandEnvelopeSchema
} from "./workspace-directory";
import { ToolLibraryCommandEnvelopeSchemas } from "./tool-library";
import { ResourceManagerCommandEnvelopeSchema } from "./resource-manager";

export const SettingsCommandEnvelopeSchemas = [
  ResourceManagerCommandEnvelopeSchema,
  AssistantCommandEnvelopeSchema,
  ...ToolLibraryCommandEnvelopeSchemas,
  LongAgentsListCommandEnvelopeSchema,
  LongAgentsSaveCommandEnvelopeSchema,
  PromptTemplatesListCommandEnvelopeSchema,
  PromptTemplatesSaveCommandEnvelopeSchema,
  PromptTemplatesDeleteCommandEnvelopeSchema,
  PromptTemplatesReadImageCommandEnvelopeSchema,
  PromptTemplatesCopyImageCommandEnvelopeSchema,
  LongAgentsResetCommandEnvelopeSchema,
  LibraryAgentsListCommandEnvelopeSchema,
  LibraryAgentsSaveCommandEnvelopeSchema,
  LibraryAgentsResetCommandEnvelopeSchema,
  WorkspaceDirectoryListCommandEnvelopeSchema,
  WorkspaceDirectoryChooseCommandEnvelopeSchema,
  WorkspaceDirectoryRestoreCommandEnvelopeSchema,
  WorkspaceDirectoryMigrateCommandEnvelopeSchema,
  AppearanceListCommandEnvelopeSchema,
  AppearanceSaveCommandEnvelopeSchema,
  AppearanceFontsListCommandEnvelopeSchema,
  AppearanceFontsInstallCommandEnvelopeSchema,
  AppearanceFontsRemoveCommandEnvelopeSchema,
  GeneralSettingsListCommandEnvelopeSchema,
  GeneralSettingsSaveCommandEnvelopeSchema
] as const;
