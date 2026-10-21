import type { WorkspaceDirectorySettings } from "@deepwrite/contracts";
import { createPinia, setActivePinia } from "pinia";
import { ref, shallowRef } from "vue";
import { describe, expect, it, vi } from "vitest";
import { useSettingsStore } from "../stores/settingsStore";
import { loadSettingsFeature } from "../components/loadSettingsFeature";
import { buildSettingsFeatureModule } from "./settingsFeatureModule";
import type { WorkspaceMainView } from "../stores/layoutStore";
import type { SubagentAuthoringController } from "./useSubagentAuthoring";
import {
  useWorkspaceFeatureHostCoordinator,
  type WorkspaceFeatureHostCoordinatorOptions
} from "./useWorkspaceFeatureHostCoordinator";
vi.mock("../components/loadSettingsFeature", () => ({
  loadSettingsFeature: vi.fn(async () => buildSettingsFeatureModule)
}));
function deferred<Value>() {
  let resolve!: (value: Value | PromiseLike<Value>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<Value>((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
}
interface HarnessOverrides {
  runtimeAvailable?: boolean;
  saveBeforeLeaving?: () => Promise<boolean>;
  ensureRevisionLoaded?: () => Promise<unknown>;
  ensureAuthoringLoaded?: () => Promise<unknown>;
  loadDirectory?: () => Promise<WorkspaceDirectorySettings>;
  chooseDirectory?: () => Promise<WorkspaceDirectorySettings | null>;
  loaderOverrides?: Partial<WorkspaceFeatureHostCoordinatorOptions["loaders"]>;
}
function createHarness(overrides: HarnessOverrides = {}) {
  setActivePinia(createPinia());
  const currentView = ref<"workspace" | "settings">("workspace"),
    settingsInitialCategory = ref("general"),
    workspaceMainView = ref<WorkspaceMainView>("conversation"),
    activeLongBookId = ref<string | null>(null);
  const settingsStore = useSettingsStore();
  const saveBeforeLeaving = vi.fn(
    overrides.saveBeforeLeaving ?? (async () => true)
  );
  const newLibraryConversation = vi.fn(),
    newLongConversation = vi.fn();
  const ensureRevisionLoaded = vi.fn(
      overrides.ensureRevisionLoaded ?? (async () => undefined)
    ),
    ensureAuthoringLoaded = vi.fn(
      overrides.ensureAuthoringLoaded ?? (async () => undefined)
    );
  const listDirectory = vi.fn(
      overrides.loadDirectory ?? (async () => ({ path: "/workspace-a" }))
    ),
    chooseDirectory = vi.fn(
      overrides.chooseDirectory ?? (async () => ({ path: "/workspace-b" }))
    );
  const api = {
    workspaceDirectory: { list: listDirectory, choose: chooseDirectory }
  };
  let runtimeAvailable = overrides.runtimeAvailable ?? true;
  const loaders = {
    ensureLongAgentSettingsLoaded: vi.fn(async () => undefined),
    loadAgentTeamSettings: vi.fn(async () => undefined),
    loadLibraryAgentSettings: vi.fn(async () => undefined),
    loadCatalogSnapshot: vi.fn(async () => undefined),
    ...overrides.loaderOverrides
  };
  const errors: string[] = [],
    successes: string[] = [];
  const authoringController = shallowRef<SubagentAuthoringController | null>(
    null
  );
  const coordinator = useWorkspaceFeatureHostCoordinator({
    api: () => (runtimeAvailable ? api : undefined),
    view: {
      current: currentView,
      settingsInitialCategory,
      workspaceMain: workspaceMainView,
      activeLongBookId
    },
    settingsStore,
    catalogSnapshot: shallowRef(null),
    actions: {
      saveActiveLongEditorBeforeLeaving: saveBeforeLeaving,
      newLibraryConversation,
      newLongConversation
    },
    loaders,
    notifications: {
      error: (m) => errors.push(m),
      success: (m) => successes.push(m)
    }
  });
  return {
    coordinator,
    currentView,
    settingsInitialCategory,
    workspaceMainView,
    activeLongBookId,
    settingsStore,
    saveBeforeLeaving,
    newLibraryConversation,
    newLongConversation,
    ensureRevisionLoaded,
    ensureAuthoringLoaded,
    listDirectory,
    chooseDirectory,
    loaders,
    errors,
    successes,
    authoringController,
    setRuntimeAvailable: (value: boolean) => {
      runtimeAvailable = value;
    }
  };
}
describe("useWorkspaceFeatureHostCoordinator", () => {
  it("prioritizes settings, then an open long workspace, then the selected main view", () => {
    const harness = createHarness();

    expect(harness.coordinator.activeFeature.value).toBe("conversation");
    harness.activeLongBookId.value = "long-book";
    expect(harness.coordinator.isLongWorkspaceActive.value).toBe(true);
    expect(harness.coordinator.activeFeature.value).toBe("long-workspace");
    harness.currentView.value = "settings";
    expect(harness.coordinator.activeFeature.value).toBe("settings");
    harness.workspaceMainView.value = "tools";
    expect(harness.coordinator.activeFeature.value).toBe("settings");
    harness.currentView.value = "workspace";
    expect(harness.coordinator.activeFeature.value).toBe("tools");
  });

  it("projects manual feature descriptors and redirects old feature identities", async () => {
    const harness = createHarness();
    expect(harness.coordinator.workspaceFeatureModule.value).toBeNull();
    for (const feature of [
      "tools",
      "voice-manager",
      "prompt-templates"
    ] as const) {
      harness.workspaceMainView.value = feature;
      expect(harness.coordinator.workspaceFeatureModule.value?.kind).toBe(
        feature
      );
    }
    for (const legacy of ["agent-team", "revision-analysis"] as const) {
      harness.workspaceMainView.value = legacy;
      expect(harness.coordinator.workspaceFeatureModule.value).toEqual({
        kind: "tools"
      });
    }
    await harness.coordinator.openSettings("appearance");
    const settings = harness.coordinator.workspaceFeatureModule.value;
    expect(settings?.kind).toBe("settings");
    expect(settings?.kind === "settings" && settings.initialCategory).toBe(
      "appearance"
    );
  });

  it("opens tools through the save guard", async () => {
    const harness = createHarness();
    await harness.coordinator.openWorkspaceDialog("tools");
    expect(harness.saveBeforeLeaving).toHaveBeenCalledOnce();
    expect(harness.coordinator.workspaceFeatureModule.value).toEqual({
      kind: "tools"
    });
    const blocked = createHarness({ saveBeforeLeaving: async () => false });
    await blocked.coordinator.openWorkspaceDialog("tools");
    expect(blocked.workspaceMainView.value).toBe("conversation");
  });

  it("routes new conversations using the current long-book identity", () => {
    const harness = createHarness();

    harness.coordinator.newConversation();
    harness.activeLongBookId.value = "long-book";
    harness.coordinator.newConversation();

    expect(harness.newLibraryConversation).toHaveBeenCalledOnce();
    expect(harness.newLongConversation).toHaveBeenCalledOnce();
  });

  it("blocks every feature navigation and all dependent loads when saving fails", async () => {
    const harness = createHarness({
      saveBeforeLeaving: async () => false
    });

    await harness.coordinator.openSettings("directory");
    await harness.coordinator.openWorkspaceDialog("voice-manager");
    await harness.coordinator.openWorkspaceDialog("revision-analysis");
    await harness.coordinator.openSettings();
    await harness.coordinator.openAgentTeams();
    await harness.coordinator.openWorkspaceDialog("prompt-templates");
    await harness.coordinator.openWorkspaceDialog("tools");

    expect(harness.currentView.value).toBe("workspace");
    expect(harness.workspaceMainView.value).toBe("conversation");
    expect(harness.ensureRevisionLoaded).not.toHaveBeenCalled();
    expect(harness.ensureAuthoringLoaded).not.toHaveBeenCalled();
    expect(harness.listDirectory).not.toHaveBeenCalled();
    expect(
      Object.values(harness.loaders).every(
        (loader) => vi.mocked(loader).mock.calls.length === 0
      )
    ).toBe(true);
  });

  it("does not let a delayed save replace a newer page", async () => {
    const saving = deferred<boolean>();
    let calls = 0;
    const harness = createHarness({
      saveBeforeLeaving: () =>
        ++calls === 1 ? saving.promise : Promise.resolve(true)
    });
    const opening = harness.coordinator.openWorkspaceDialog("tools");
    await harness.coordinator.openWorkspaceDialog("voice-manager");
    saving.resolve(true);
    await opening;
    expect(harness.workspaceMainView.value).toBe("voice-manager");
  });

  it("does not let a delayed save replace a resource navigation", async () => {
    const saving = deferred<boolean>();
    const harness = createHarness({ saveBeforeLeaving: () => saving.promise });
    const opening = harness.coordinator.openWorkspaceDialog("tools");
    harness.coordinator.showConversation();
    saving.resolve(true);
    await opening;
    expect(harness.workspaceMainView.value).toBe("conversation");
  });

  it("does not load retired analysis or authoring controllers", async () => {
    const harness = createHarness();
    await harness.coordinator.openWorkspaceDialog("revision-analysis");
    await harness.coordinator.openAgentTeams();
    expect(harness.workspaceMainView.value).toBe("tools");
    expect(harness.ensureRevisionLoaded).not.toHaveBeenCalled();
    expect(harness.ensureAuthoringLoaded).not.toHaveBeenCalled();
  });

  it("keeps manual pages independent of retired agent settings", async () => {
    const harness = createHarness();
    for (const feature of [
      "conversation",
      "long-workspace",
      "tools",
      "settings"
    ] as const)
      await harness.coordinator.ensureActiveFeatureDependencies(feature);
    expect(harness.loaders.loadLibraryAgentSettings).not.toHaveBeenCalled();
    expect(
      harness.loaders.ensureLongAgentSettingsLoaded
    ).not.toHaveBeenCalled();
    expect(harness.loaders.loadAgentTeamSettings).not.toHaveBeenCalled();
  });

  it("opens settings without loading retired model or agent settings", async () => {
    const harness = createHarness();

    await harness.coordinator.openSettings("general");
    expect(harness.currentView.value).toBe("settings");
    await vi.waitFor(() =>
      expect(harness.settingsStore.workspaceDirectoryPath).toBe("/workspace-a")
    );
    const settings = harness.coordinator.workspaceFeatureModule.value;
    expect(
      settings?.kind === "settings" && settings.workspaceDirectoryPath
    ).toBe("/workspace-a");
    expect(
      harness.loaders.ensureLongAgentSettingsLoaded
    ).not.toHaveBeenCalled();
    expect(harness.loaders.loadLibraryAgentSettings).not.toHaveBeenCalled();

    harness.coordinator.closeSettings();
    await harness.coordinator.openSettings("appearance");
    expect(harness.settingsInitialCategory.value).toBe("appearance");
  });

  it("keeps the current page usable when a settings chunk cannot load", async () => {
    const harness = createHarness();
    harness.workspaceMainView.value = "tools";
    vi.mocked(loadSettingsFeature).mockRejectedValueOnce(
      new TypeError("Failed to fetch dynamically imported module")
    );

    await harness.coordinator.openSettings();

    expect(harness.currentView.value).toBe("workspace");
    expect(harness.workspaceMainView.value).toBe("tools");
    expect(harness.errors).toEqual([
      "设置页面加载失败，请稍后重试或重新启动应用。"
    ]);
    expect(
      harness.loaders.ensureLongAgentSettingsLoaded
    ).not.toHaveBeenCalled();

    await harness.coordinator.openSettings();
    expect(harness.currentView.value).toBe("settings");
  });

  it("waits for settings assets and ignores completion after newer navigation", async () => {
    const pending = deferred<typeof buildSettingsFeatureModule>();
    const loading = vi.fn(() => pending.promise);
    vi.mocked(loadSettingsFeature).mockImplementationOnce(loading);
    const harness = createHarness();
    const opening = harness.coordinator.openSettings("appearance");
    await vi.waitFor(() => expect(loading).toHaveBeenCalledOnce());
    expect(harness.currentView.value).toBe("workspace");

    await harness.coordinator.openWorkspaceDialog("voice-manager");
    pending.resolve(buildSettingsFeatureModule);
    await opening;

    expect(harness.currentView.value).toBe("workspace");
    expect(harness.workspaceMainView.value).toBe("voice-manager");
  });

  it("contains rejecting background loaders without changing the selected page", async () => {
    const harness = createHarness({
      loaderOverrides: {
        loadCatalogSnapshot: async () => {
          throw new Error("Catalog unavailable");
        }
      }
    });

    await expect(harness.coordinator.openAgentTeams()).resolves.toBeUndefined();
    await Promise.resolve();
    expect(harness.workspaceMainView.value).toBe("tools");
    expect(harness.errors).toEqual([]);
  });

  it("loads and chooses a workspace directory with cancellation, errors, and single-flight guards", async () => {
    const harness = createHarness();

    await harness.coordinator.loadWorkspaceDirectory();
    expect(harness.settingsStore.workspaceDirectoryPath).toBe("/workspace-a");

    await harness.coordinator.chooseWorkspaceDirectory();
    expect(harness.settingsStore.workspaceDirectoryPath).toBe("/workspace-b");
    expect(harness.successes).toEqual([
      "工作目录已切换；现有项目保持原位置不变"
    ]);

    const cancelled = createHarness({
      chooseDirectory: async () => null
    });
    await cancelled.coordinator.chooseWorkspaceDirectory();
    expect(cancelled.settingsStore.workspaceDirectoryPath).toBeNull();
    expect(cancelled.successes).toEqual([]);

    const failed = createHarness({
      loadDirectory: async () => {
        throw new Error("目录读取失败");
      },
      chooseDirectory: async () => {
        throw new Error("目录切换失败");
      }
    });
    await failed.coordinator.loadWorkspaceDirectory();
    await failed.coordinator.chooseWorkspaceDirectory();
    expect(failed.errors).toEqual(["目录读取失败", "目录切换失败"]);

    const pendingChoice = deferred<WorkspaceDirectorySettings | null>();
    const guarded = createHarness({
      chooseDirectory: () => pendingChoice.promise
    });
    const firstChoice = guarded.coordinator.chooseWorkspaceDirectory();
    await guarded.coordinator.chooseWorkspaceDirectory();
    expect(guarded.chooseDirectory).toHaveBeenCalledOnce();
    pendingChoice.resolve({ path: "/workspace-c" });
    await firstChoice;
  });
});
