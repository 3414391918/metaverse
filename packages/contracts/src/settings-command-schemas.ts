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
  WorkspaceDirectoryListCommandEnvelopeSchema
} from "./workspace-directory";
import { ToolLibraryCommandEnvelopeSchemas } from "./tool-library";

export const SettingsCommandEnvelopeSchemas = [
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
  AppearanceListCommandEnvelopeSchema,
  AppearanceSaveCommandEnvelopeSchema,
  AppearanceFontsListCommandEnvelopeSchema,
  AppearanceFontsInstallCommandEnvelopeSchema,
  AppearanceFontsRemoveCommandEnvelopeSchema,
  GeneralSettingsListCommandEnvelopeSchema,
  GeneralSettingsSaveCommandEnvelopeSchema
] as const;
