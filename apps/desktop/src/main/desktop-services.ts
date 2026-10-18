import { AgentTeamConfigStore } from "./agent-team-config-store";
import { AppAlertStore } from "./app-alert-store";
import { AppearanceService } from "./appearance-service";
import { ChatAssistantProjectConfigStore } from "./chat-assistant-project-config-store";
import { GeneralSettingsStore } from "./general-settings-store";
import { FishAudioService } from "./fish-audio-service";
import { LibraryAgentConfigStore } from "./library-agent-config-store";
import { LongAgentConfigStore } from "./long-agent-config-store";
import { PromptTemplateStore } from "./prompt-template-store";
import { UpdateService } from "./update-service";
import { WorkspaceDirectoryStore } from "./workspace-directory-store";
import { ToolLibraryStore } from "./tool-library-store";
import { savedToolGuidance } from "./tool-library-guidance";
interface DesktopServiceOptions {
  userDataPath: string;
  appVersion: string;
  installUpdate: () => void;
  toolDefaultsDirectory: string;
}
/** Construction has no network dependency; optional refreshes start separately. */
export function createDesktopServices(options: DesktopServiceOptions) {
  const { userDataPath } = options;
  const workspaceDirectoryStore = new WorkspaceDirectoryStore(userDataPath);
  const longAgentConfigStore = new LongAgentConfigStore(userDataPath);
  const libraryAgentConfigStore = new LibraryAgentConfigStore(userDataPath);
  return {
    agentTeamConfigStore: new AgentTeamConfigStore(userDataPath),
    libraryAgentConfigStore,
    longAgentConfigStore,
    promptTemplateStore: new PromptTemplateStore(
      userDataPath,
      workspaceDirectoryStore
    ),
    workspaceDirectoryStore,
    toolLibraryStore: new ToolLibraryStore(
      workspaceDirectoryStore,
      options.toolDefaultsDirectory,
      () =>
        savedToolGuidance(
          longAgentConfigStore,
          libraryAgentConfigStore,
          userDataPath
        )
    ),
    appearanceService: new AppearanceService(userDataPath),
    generalSettingsStore: new GeneralSettingsStore(userDataPath),
    fishAudioService: new FishAudioService(userDataPath),
    chatAssistantProjectConfigStore: new ChatAssistantProjectConfigStore(
      userDataPath
    ),
    updateService: new UpdateService(options.installUpdate),
    appAlertStore: new AppAlertStore(userDataPath)
  };
}
