import type { createDesktopServices } from "./desktop-services";
import type { ChatAssistantProjectConfigStore } from "./chat-assistant-project-config-store";
import type { AgentTeamConfigStore } from "./agent-team-config-store";
import type { LibraryAgentConfigStore } from "./library-agent-config-store";
import type { LongAgentConfigStore } from "./long-agent-config-store";
import type { PromptTemplateStore } from "./prompt-template-store";
import type { ToolLibraryStore } from "./tool-library-store";
import type { WorkspaceDirectoryStore } from "./workspace-directory-store";
import type { AppearanceService } from "./appearance-service";
import type { GeneralSettingsStore } from "./general-settings-store";
import type { FishAudioService } from "./fish-audio-service";
type DesktopServices = ReturnType<typeof createDesktopServices>;
export function createDesktopServiceAccessors(
  getServices: () => Partial<DesktopServices>
) {
  function requireChatAssistantProjectConfigStore(): ChatAssistantProjectConfigStore {
    const chatAssistantProjectConfigStore =
      getServices().chatAssistantProjectConfigStore;
    if (!chatAssistantProjectConfigStore) {
      throw new Error("聊天助手项目配置存储尚未初始化。");
    }
    return chatAssistantProjectConfigStore;
  }
  function requireAgentTeamConfigStore(): AgentTeamConfigStore {
    const agentTeamConfigStore = getServices().agentTeamConfigStore;
    if (!agentTeamConfigStore) {
      throw new Error("智能体团队设置存储尚未初始化。");
    }
    return agentTeamConfigStore;
  }
  function requireLibraryAgentConfigStore(): LibraryAgentConfigStore {
    const libraryAgentConfigStore = getServices().libraryAgentConfigStore;
    if (!libraryAgentConfigStore) {
      throw new Error("资料库智能体设置存储尚未初始化。");
    }
    return libraryAgentConfigStore;
  }
  function requireLongAgentConfigStore(): LongAgentConfigStore {
    const longAgentConfigStore = getServices().longAgentConfigStore;
    if (!longAgentConfigStore) {
      throw new Error("创作智能体设置存储尚未初始化。");
    }
    return longAgentConfigStore;
  }
  function requirePromptTemplateStore(): PromptTemplateStore {
    const store = getServices().promptTemplateStore;
    if (!store) throw new Error("提示词模板存储尚未初始化。");
    return store;
  }
  function requireToolLibraryStore(): ToolLibraryStore {
    const store = getServices().toolLibraryStore;
    if (!store) throw new Error("工具管理尚未初始化。");
    return store;
  }
  function requireWorkspaceDirectoryStore(): WorkspaceDirectoryStore {
    const workspaceDirectoryStore = getServices().workspaceDirectoryStore;
    if (!workspaceDirectoryStore) {
      throw new Error("工作目录配置存储尚未初始化。");
    }
    return workspaceDirectoryStore;
  }
  function requireAppearanceService(): AppearanceService {
    const appearanceService = getServices().appearanceService;
    if (!appearanceService) {
      throw new Error("外观设置服务尚未初始化。");
    }
    return appearanceService;
  }
  function requireGeneralSettingsStore(): GeneralSettingsStore {
    const generalSettingsStore = getServices().generalSettingsStore;
    if (!generalSettingsStore) {
      throw new Error("常规设置存储尚未初始化。");
    }
    return generalSettingsStore;
  }
  function requireFishAudioService(): FishAudioService {
    const service = getServices().fishAudioService;
    if (!service) throw new Error("FishAudio 服务尚未初始化。");
    return service;
  }
  return {
    requireChatAssistantProjectConfigStore,
    requireAgentTeamConfigStore,
    requireLibraryAgentConfigStore,
    requireLongAgentConfigStore,
    requirePromptTemplateStore,
    requireToolLibraryStore,
    requireWorkspaceDirectoryStore,
    requireAppearanceService,
    requireGeneralSettingsStore,
    requireFishAudioService
  };
}
