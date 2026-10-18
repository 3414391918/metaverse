import { computed, reactive, readonly } from "vue";
import {
  AppearanceCustomFontIdSchema,
  AppearanceFontCatalogSnapshotSchema,
  appearanceCustomFontCssFamily,
  isAppearanceCustomFontId,
  type AppearanceCustomFont,
  type AppearanceCustomFontId,
  type AppearanceFontCatalogSnapshot,
  type AppearanceFontInstallFailure,
  type AppearanceFontInstallResult,
  type AppearanceFontRemoveResult
} from "@deepwrite/contracts/renderer";
import {
  AppearanceFontRuntime,
  createBrowserAppearanceFontRuntime
} from "./appearanceFontRuntime";

interface AppearanceFontsState {
  fonts: AppearanceCustomFont[];
  ready: boolean;
  installing: boolean;
  validatingIds: AppearanceCustomFontId[];
  unavailableIds: AppearanceCustomFontId[];
  removingIds: AppearanceCustomFontId[];
}

export interface AppearanceFontLoadFailure {
  id: AppearanceCustomFontId;
  displayName: string;
}

export interface AppearanceFontInstallOutcome {
  result: AppearanceFontInstallResult;
  loadedIds: AppearanceCustomFontId[];
  loadFailures: AppearanceFontLoadFailure[];
}

const state = reactive<AppearanceFontsState>({
  fonts: [],
  ready: false,
  installing: false,
  validatingIds: [],
  unavailableIds: [],
  removingIds: []
});
let runtime: AppearanceFontRuntime | undefined;
let hydratePromise: Promise<boolean> | undefined;

function browserRuntime(): AppearanceFontRuntime {
  runtime ??= createBrowserAppearanceFontRuntime();
  return runtime;
}

function replaceCatalog(snapshot: AppearanceFontCatalogSnapshot): void {
  const parsed = AppearanceFontCatalogSnapshotSchema.parse(snapshot);
  const catalogIds = new Set(parsed.fonts.map((font) => font.id));
  state.unavailableIds.splice(
    0,
    state.unavailableIds.length,
    ...state.unavailableIds.filter((id) => catalogIds.has(id))
  );
  if (parsed.fonts.length > 0 || runtime) {
    browserRuntime().synchronize(parsed.fonts);
  }
  state.fonts.splice(0, state.fonts.length, ...parsed.fonts);
}

function emptyCatalog(): AppearanceFontCatalogSnapshot {
  return { fonts: [] };
}

export function hydrateAppearanceFontCatalog(): Promise<boolean> {
  hydratePromise ??= (async () => {
    const api = window.deepwrite?.appearance.fonts;
    if (!api) {
      replaceCatalog(emptyCatalog());
      state.ready = true;
      return false;
    }
    try {
      replaceCatalog(await api.list());
      return true;
    } catch {
      replaceCatalog(emptyCatalog());
      return false;
    } finally {
      state.ready = true;
    }
  })();
  return hydratePromise;
}

export async function ensureAppearanceFontLoaded(rawId: string): Promise<void> {
  const id = AppearanceCustomFontIdSchema.parse(rawId);
  if (!state.fonts.some((font) => font.id === id)) {
    throw new Error(`Custom font is missing from the catalog: ${id}`);
  }
  const fontRuntime = browserRuntime();
  if (!fontRuntime.isRegistered(id)) {
    fontRuntime.synchronize(state.fonts);
  }
  await fontRuntime.load(id);
}

async function cleanupFailedInstall(id: AppearanceCustomFontId): Promise<void> {
  const api = window.deepwrite?.appearance.fonts;
  if (!api) return;
  try {
    const result = await api.remove(id);
    replaceCatalog(result.catalog);
  } catch {
    // Keep the catalog entry so the user can remove it manually if cleanup fails.
  }
}

export async function installAppearanceFonts(): Promise<AppearanceFontInstallOutcome> {
  const api = window.deepwrite?.appearance.fonts;
  if (!api) throw new Error("当前环境不支持导入字体");
  state.installing = true;
  try {
    const result = await api.install();
    if (result.status === "canceled") {
      return { result, loadedIds: [], loadFailures: [] };
    }

    const installedCatalogIds = new Set(
      result.catalog.fonts.map((font) => font.id)
    );
    state.validatingIds.splice(
      0,
      state.validatingIds.length,
      ...result.installedIds.filter((id) => installedCatalogIds.has(id))
    );
    replaceCatalog(result.catalog);
    const installedById = new Map(
      result.catalog.fonts.map((font) => [font.id, font] as const)
    );
    const loadedIds: AppearanceCustomFontId[] = [];
    const loadFailures: AppearanceFontLoadFailure[] = [];
    for (const id of result.installedIds) {
      try {
        await ensureAppearanceFontLoaded(id);
        loadedIds.push(id);
        const unavailableIndex = state.unavailableIds.indexOf(id);
        if (unavailableIndex >= 0) {
          state.unavailableIds.splice(unavailableIndex, 1);
        }
      } catch {
        const font = installedById.get(id);
        loadFailures.push({
          id,
          displayName: font?.displayName ?? "未命名字体"
        });
        if (!state.unavailableIds.includes(id)) {
          state.unavailableIds.push(id);
        }
        await cleanupFailedInstall(id);
      } finally {
        const validatingIndex = state.validatingIds.indexOf(id);
        if (validatingIndex >= 0) {
          state.validatingIds.splice(validatingIndex, 1);
        }
      }
    }
    return { result, loadedIds, loadFailures };
  } finally {
    state.validatingIds.splice(0, state.validatingIds.length);
    state.installing = false;
  }
}

export async function removeAppearanceFont(
  rawId: string
): Promise<AppearanceFontRemoveResult> {
  const id = AppearanceCustomFontIdSchema.parse(rawId);
  const api = window.deepwrite?.appearance.fonts;
  if (!api) throw new Error("当前环境不支持删除字体");
  if (!state.removingIds.includes(id)) state.removingIds.push(id);
  try {
    const result = await api.remove(id);
    replaceCatalog(result.catalog);
    return result;
  } finally {
    const index = state.removingIds.indexOf(id);
    if (index >= 0) state.removingIds.splice(index, 1);
  }
}

export function customFontOptionStyle(id: string): { fontFamily: string } {
  if (!isAppearanceCustomFontId(id)) return { fontFamily: "inherit" };
  return { fontFamily: `"${appearanceCustomFontCssFamily(id)}"` };
}

export function appearanceFontFailureLabel(
  failure: AppearanceFontInstallFailure
): string {
  const labels: Record<AppearanceFontInstallFailure["code"], string> = {
    not_regular_file: "不是普通文件",
    unsupported_format: "仅支持 TTF 或 OTF",
    invalid_font: "字体文件无效",
    file_too_large: "文件过大",
    catalog_limit: "已达字体存储上限",
    read_failed: "无法读取文件"
  };
  return `${failure.displayName}：${labels[failure.code]}`;
}

export function useAppearanceFonts() {
  void hydrateAppearanceFontCatalog();
  return {
    fonts: computed(() =>
      state.fonts.filter(
        (font) =>
          !state.validatingIds.includes(font.id) &&
          !state.unavailableIds.includes(font.id)
      )
    ),
    ready: computed(() => state.ready),
    installing: computed(() => state.installing),
    removingIds: readonly(state.removingIds),
    install: installAppearanceFonts,
    remove: removeAppearanceFont,
    ensureLoaded: ensureAppearanceFontLoaded,
    whenReady: () => hydratePromise ?? hydrateAppearanceFontCatalog()
  };
}
