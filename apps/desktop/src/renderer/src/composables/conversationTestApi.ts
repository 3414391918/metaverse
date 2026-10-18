import { createGeneralSettingsTestApi } from "./generalSettingsTestApi";
import { createUnusedLongApi } from "./unusedLongApi.test-support";
import { createModelApiTestFixture } from "./modelApiTestFixture";
import { createConversationCatalogTestApi } from "./conversationCatalogTestApi";
import { createAgentTeamsTestApi } from "./agentTeamsTestApi";
import {
  DEFAULT_LIBRARY_AGENT_SETTINGS,
  DEFAULT_LONG_AGENT_SETTINGS,
  createDefaultAppearanceSettings,
  type DeepWriteApi
} from "@deepwrite/contracts/renderer";

export function createConversationTestApi(
  session: DeepWriteApi["session"]
): DeepWriteApi {
  return {
    toolLibrary: {
      async list() {
        return { directory: "/tmp/example-tools", tools: [] };
      },
      async create() {
        return { directory: "/tmp/example-tools", tools: [] };
      },
      async delete() {
        return { directory: "/tmp/example-tools", tools: [] };
      },
      async read(input) {
        return { ...input, content: "", sha256: "0".repeat(64) };
      },
      async save(input) {
        return {
          toolId: input.toolId,
          path: input.path,
          content: input.content,
          sha256: "0".repeat(64)
        };
      }
    },
    fishAudio: {
      async execute() {
        return {};
      }
    },
    session,
    system: {
      async health() {
        return {
          status: "ok",
          checkedAt: new Date().toISOString(),
          workers: []
        };
      }
    },
    updates: {
      async getState() {
        return {
          status: "idle",
          currentVersion: "1.0.0",
          releaseNotes: [],
          mandatory: false,
          canDownload: false,
          canInstall: false
        };
      },
      async check() {
        return this.getState();
      },
      async download() {
        return this.getState();
      },
      async install() {},
      subscribe() {
        return () => undefined;
      }
    },
    appAlerts: {
      async get() {
        return {
          desktopMessages: [],
          modelMessages: ["模型公告"],
          desktopRevision: "0".repeat(64),
          shouldShowDesktop: false
        };
      },
      async acknowledgeDesktop() {}
    },
    catalog: createConversationCatalogTestApi(),
    long: createUnusedLongApi(),
    models: createModelApiTestFixture(),
    modelUsage: {
      async query() {
        return {
          generatedAt: new Date().toISOString(),
          totals: {
            inputTokens: 0,
            outputTokens: 0,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
            totalTokens: 0,
            requestCount: 0
          },
          trendGranularity: "day",
          trend: [],
          models: [],
          modules: [],
          recentCalls: []
        };
      }
    },
    longAgents: {
      async list() {
        return structuredClone(DEFAULT_LONG_AGENT_SETTINGS);
      },
      async save() {
        return structuredClone(DEFAULT_LONG_AGENT_SETTINGS);
      },
      async reset() {
        return structuredClone(DEFAULT_LONG_AGENT_SETTINGS);
      }
    },
    promptTemplates: {
      async list() {
        return [];
      },
      async save() {
        return [];
      },
      async delete() {
        return [];
      },
      async readImage() {
        return { pngDataUrl: "" };
      },
      async copyImage() {
        return;
      }
    },
    agentTeams: createAgentTeamsTestApi(),
    libraryAgents: {
      async list() {
        return structuredClone(DEFAULT_LIBRARY_AGENT_SETTINGS);
      },
      async save() {
        return structuredClone(DEFAULT_LIBRARY_AGENT_SETTINGS);
      },
      async reset() {
        return structuredClone(DEFAULT_LIBRARY_AGENT_SETTINGS);
      }
    },
    workspaceDirectory: {
      async list() {
        return { path: null };
      },
      async choose() {
        return null;
      }
    },
    appearance: {
      async list() {
        return {
          persisted: false,
          settings: createDefaultAppearanceSettings()
        };
      },
      async save(settings) {
        return { persisted: true, settings };
      },
      fonts: {
        async list() {
          return { fonts: [] };
        },
        async install() {
          return { status: "canceled" as const };
        },
        async remove() {
          throw new Error(
            "Appearance fonts are not used by conversation tests."
          );
        }
      }
    },
    generalSettings: createGeneralSettingsTestApi(),
    manuscript: {
      async exportLong() {
        throw new Error("Manuscript export is not used by conversation tests.");
      }
    },
    events: {
      subscribe() {
        return () => undefined;
      }
    }
  };
}
