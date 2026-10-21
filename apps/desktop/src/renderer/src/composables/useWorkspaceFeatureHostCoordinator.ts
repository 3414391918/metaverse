import { computed, ref } from "vue";
import type { DialogMode } from "../types/workspace";
import type {
  ActiveFeature,
  WorkspaceFeatureHostCoordinator,
  WorkspaceFeatureHostCoordinatorOptions
} from "./workspaceFeatureHostTypes";
import { buildWorkspaceFeatureModule } from "./workspaceFeatureHostModule";
import type { buildSettingsFeatureModule } from "./settingsFeatureModule";
export type {
  ActiveFeature,
  WorkspaceFeatureHostApi,
  WorkspaceFeatureHostCoordinator,
  WorkspaceFeatureHostCoordinatorOptions,
  WorkspaceFeatureHostNotifications
} from "./workspaceFeatureHostTypes";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

/**
 * Owns navigation and render descriptors for the mutually exclusive workspace
 * feature pages. Loader/action ports are deliberately invoked only from public
 * methods so the shell can pass thunks for coordinators declared later.
 */
export function useWorkspaceFeatureHostCoordinator(
  options: WorkspaceFeatureHostCoordinatorOptions
): WorkspaceFeatureHostCoordinator {
  const { settingsStore } = options;
  const agentTeamNavigationEpoch = ref(0);
  let active = true;
  let navigationGeneration = 0;
  let directoryChooseGeneration = 0;
  let directoryChoosePending = false;
  let buildSettingsModule: typeof buildSettingsFeatureModule | undefined;

  const isLongWorkspaceActive = computed(
    () =>
      options.view.workspaceMain.value === "conversation" &&
      options.view.activeLongBookId.value !== null
  );
  const activeFeature = computed<ActiveFeature>(() =>
    options.view.current.value === "settings"
      ? "settings"
      : isLongWorkspaceActive.value
        ? "long-workspace"
        : options.view.workspaceMain.value
  );

  const workspaceFeatureModule = computed(() =>
    buildWorkspaceFeatureModule(
      activeFeature.value,
      options,
      agentTeamNavigationEpoch.value,
      buildSettingsModule
    )
  );

  function beginNavigation(): number {
    return ++navigationGeneration;
  }

  function navigationIsCurrent(generation: number): boolean {
    return active && generation === navigationGeneration;
  }

  function issueBackground(task: () => Promise<unknown>): void {
    try {
      void task().catch(() => undefined);
    } catch {
      // Background loaders own their visible feedback. This guard also keeps a
      // synchronous port failure from escaping a void UI event handler.
    }
  }

  async function canApplyNavigation(generation: number): Promise<boolean> {
    const saved = await options.actions.saveActiveLongEditorBeforeLeaving();
    return saved && navigationIsCurrent(generation);
  }

  function newConversation(): void {
    beginNavigation();
    if (!active) return;
    if (options.view.activeLongBookId.value !== null) {
      options.actions.newLongConversation();
      return;
    }
    options.actions.newLibraryConversation();
  }

  function showConversation(): void {
    beginNavigation();
    if (active) options.view.workspaceMain.value = "conversation";
  }

  async function openWorkspaceDialog(mode: DialogMode): Promise<void> {
    const generation = beginNavigation();
    if (!(await canApplyNavigation(generation))) return;
    if (mode === "revision-analysis") mode = "tools";
    options.view.workspaceMain.value = mode;
  }

  async function openSettings(initialCategory = "general"): Promise<void> {
    const generation = beginNavigation();
    if (!(await canApplyNavigation(generation))) return;
    try {
      const { loadSettingsFeature } =
        await import("../components/loadSettingsFeature");
      const buildSettings = await loadSettingsFeature();
      if (!navigationIsCurrent(generation)) return;
      buildSettingsModule = buildSettings;
    } catch {
      if (navigationIsCurrent(generation)) {
        options.notifications.error(
          "设置页面加载失败，请稍后重试或重新启动应用。"
        );
      }
      return;
    }
    options.view.settingsInitialCategory.value = initialCategory;
    options.view.current.value = "settings";
    if (options.api()) {
      issueBackground(loadWorkspaceDirectory);
    }
  }

  async function openAgentTeams(): Promise<void> {
    const generation = beginNavigation();
    if (!(await canApplyNavigation(generation))) return;
    options.view.workspaceMain.value = "tools";
    if (options.api() && !options.catalogSnapshot.value) {
      issueBackground(options.loaders.loadCatalogSnapshot);
    }
  }

  async function loadWorkspaceDirectory(): Promise<void> {
    const api = options.api();
    if (!active || !api) return;
    try {
      await settingsStore.ensureWorkspaceDirectoryLoaded(() =>
        api.workspaceDirectory.list()
      );
    } catch (error: unknown) {
      if (active) {
        options.notifications.error(errorMessage(error, "加载工作目录失败。"));
      }
    }
  }

  async function runWorkspaceDirectoryAction(
    action: "choose" | "restore" | "migrate"
  ): Promise<void> {
    const api = options.api();
    if (
      !active ||
      !api ||
      directoryChoosePending ||
      settingsStore.workspaceDirectoryLoading
    ) {
      return;
    }
    const generation = ++directoryChooseGeneration;
    directoryChoosePending = true;
    settingsStore.workspaceDirectoryLoading = true;
    try {
      const originalPath = settingsStore.workspaceDirectoryPath;
      const settings = await api.workspaceDirectory[action]();
      if (!active || generation !== directoryChooseGeneration || !settings) {
        return;
      }
      settingsStore.markLoaded("workspaceDirectory", settings);
      options.notifications.success(
        action === "migrate"
          ? "数据迁移完成，来源目录仍保留原文件"
          : action === "restore"
            ? "已恢复上一个工作目录"
            : "工作目录已切换"
      );
      if (
        typeof window !== "undefined" &&
        (action === "migrate" || settings.path !== originalPath)
      ) {
        window.location.reload();
      }
    } catch (error: unknown) {
      if (active && generation === directoryChooseGeneration) {
        options.notifications.error(errorMessage(error, "工作目录操作失败。"));
      }
    } finally {
      if (generation === directoryChooseGeneration) {
        directoryChoosePending = false;
        settingsStore.workspaceDirectoryLoading = false;
      }
    }
  }

  function chooseWorkspaceDirectory(): Promise<void> {
    return runWorkspaceDirectoryAction("choose");
  }

  function restoreWorkspaceDirectory(): Promise<void> {
    return runWorkspaceDirectoryAction("restore");
  }

  function migrateWorkspaceDirectory(): Promise<void> {
    return runWorkspaceDirectoryAction("migrate");
  }

  function closeSettings(): void {
    beginNavigation();
    if (active) options.view.current.value = "workspace";
  }

  async function ensureActiveFeatureDependencies(
    feature: ActiveFeature
  ): Promise<void> {
    if (!active || !options.api()) return;
    void feature;
  }

  function dispose(): void {
    if (!active) return;
    active = false;
    navigationGeneration += 1;
    directoryChooseGeneration += 1;
    if (directoryChoosePending) {
      directoryChoosePending = false;
      settingsStore.workspaceDirectoryLoading = false;
    }
  }

  return {
    isLongWorkspaceActive,
    activeFeature,
    workspaceFeatureModule,
    showConversation,
    newConversation,
    openWorkspaceDialog,
    openSettings,
    openAgentTeams,
    loadWorkspaceDirectory,
    chooseWorkspaceDirectory,
    restoreWorkspaceDirectory,
    migrateWorkspaceDirectory,
    closeSettings,
    ensureActiveFeatureDependencies,
    dispose
  };
}
