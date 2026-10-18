import { describe, expect, it } from "vitest";
import { expectSourceToContain } from "../../../test-utils/sourceText";
import appSource from "../test-support/workspaceShellSource";
import featureModulesSource from "./WorkspaceFeatureModules.vue?raw";
import featureHostCoordinatorSource from "../composables/useWorkspaceFeatureHostCoordinator.ts?raw";
import featureHostModuleSource from "../composables/workspaceFeatureHostModule.ts?raw";
import settingsFeatureModuleSource from "../composables/settingsFeatureModule.ts?raw";
import bodyTextSource from "./BodyTextSettingsPanel.vue?raw";
import generalPanelSource from "./GeneralSettingsPanel.vue?raw";
import fontSource from "./AppearanceFontSettings.vue?raw";
import appearancePanelSource from "./AppearanceSettingsPanel.vue?raw";
import themeSource from "./AppearanceThemeSettings.vue?raw";
import source from "./SettingsPage.vue?raw";

const generalSettingsSource = `${source}\n${generalPanelSource}`;
const featureHostSource = `${featureHostCoordinatorSource}\n${featureHostModuleSource}\n${settingsFeatureModuleSource}`;

describe("SettingsPage", () => {
  it("can open directly on a requested settings category", () => {
    expect(source).toContain("initialCategory?: string");
    expect(source).toContain("category.id === props.initialCategory");
    expect(source).toContain(': "general"');
  });

  it("offers a persisted auto-save switch in general settings", () => {
    expectSourceToContain(generalSettingsSource, "<strong>自动保存</strong>");
    expect(generalSettingsSource).toContain(':checked="autoSaveEnabled"');
    expectSourceToContain(generalSettingsSource, "emit('updateAutoSave'");
  });

  it("hides the context usage visibility switch from general settings", () => {
    expect(generalPanelSource).not.toContain("<strong>上下文使用显示</strong>");
  });

  it("removes approval controls belonging to the retired main agent", () => {
    expect(generalPanelSource).not.toContain('role="radiogroup"');
    expect(generalPanelSource).not.toContain("<strong>请求批准</strong>");
    expect(generalPanelSource).not.toContain("<strong>替我审批</strong>");
  });

  it("does not show retired cross-stage approval settings", () => {
    expect(generalPanelSource).not.toContain("跨阶段操作自动审批");
  });

  it("wires language and menu-bar controls to persisted settings", () => {
    expect(generalSettingsSource).toContain(':model-value="language"');
    expect(generalSettingsSource).toContain("emit('updateLanguage'");
    expect(generalSettingsSource).toContain(':checked="showInMenuBar"');
    expectSourceToContain(generalSettingsSource, "emit('updateShowInMenuBar'");
  });

  it("offers a manually enabled system proxy under personal general settings", () => {
    expectSourceToContain(
      generalSettingsSource,
      "<strong>使用系统代理</strong>"
    );
    expect(generalSettingsSource).toContain(':checked="useNetworkProxy"');
    expect(generalSettingsSource).toContain("'updateUseNetworkProxy'");
    expect(source).toContain(':use-network-proxy="useNetworkProxy"');
    expect(featureModulesSource).toContain(
      ':use-network-proxy="module.useNetworkProxy"'
    );
  });

  it("does not offer conversation/editor pane layouts", () => {
    expect(generalPanelSource).not.toContain("<strong>页面布局</strong>");
    expect(generalPanelSource).not.toContain("目录｜智能体｜文本内容");
  });

  it("offers a persisted default text view mode with both choices", () => {
    expect(generalPanelSource).not.toContain("默认文本模式");
    expectSourceToContain(bodyTextSource, "<strong>默认文本模式</strong>");
    expect(bodyTextSource).toContain('{ value: "edit", label: "编辑" }');
    expect(bodyTextSource).toContain('{ value: "preview", label: "预览" }');
    expect(bodyTextSource).toContain(':model-value="defaultTextViewMode"');
    expectSourceToContain(bodyTextSource, "emit('updateDefaultTextViewMode'");
    expect(featureModulesSource).toContain(
      ':default-text-view-mode="module.defaultTextViewMode"'
    );
    expect(featureHostSource).toContain(
      "settingsStore.generalSettings.defaultTextViewMode"
    );
    expect(appSource).toContain(
      '@update-default-text-view-mode="updateDefaultTextViewMode"'
    );
  });

  it("keeps the language selector from squeezing its label column", () => {
    expect(generalSettingsSource).toContain(
      'class="settings-item settings-select-item"'
    );
    expect(generalPanelSource).toContain(
      '<style scoped src="./settings-page.css">'
    );
    expectSourceToContain(
      generalPanelSource,
      ".settings-select-item { flex-wrap: wrap; }"
    );
    expect(generalPanelSource).toContain("flex: 0 1 210px;");
  });

  it("keeps agent-team management outside the settings page", () => {
    expect(source).not.toContain('id: "agent-teams"');
    expect(source).not.toContain("<AgentTeamSettingsPanel");
    expect(source).not.toContain("saveAgentTeams");
  });

  it("removes the complete creation settings group", () => {
    expect(source).not.toContain('title: "创作"');
    expect(source).not.toContain('label: "技能库配置"');
    expect(source).not.toContain('label: "素材库配置"');
    expect(source).not.toContain("<LibraryAgentSettingsPanel");
    expect(source).not.toContain("<LongAgentSettingsPanel");
  });

  it("removes the complete model and usage settings group", () => {
    expect(source).not.toContain('label: "模型与用量"');
    expect(source).not.toContain('id: "usage"');
    expect(source).not.toContain('id: "custom-models"');
    expect(source).not.toContain("<ModelUsagePanel");
    expect(source).not.toContain("<ModelSettingsFeature");
    expect(featureHostSource).not.toContain("modelLoading:");
    expect(featureModulesSource).not.toContain("@save-models");
    expect(appSource).not.toContain("@load-models");
  });

  it("lets users pick UI and editor font families from appearance settings", () => {
    expect(source).toContain("<AppearanceSettingsPanel");
    expect(fontSource).toContain("<strong>界面字体</strong>");
    expect(fontSource).toContain("<strong>正文字体</strong>");
    expect(fontSource).toContain("appearance.setUiFontFamily");
    expect(fontSource).toContain("appearance.setEditorFontFamily");
    expect(fontSource).toContain(':model-value="uiFontModelValue"');
    expect(fontSource).toContain(':model-value="editorFontModelValue"');
    expect(fontSource).toContain("UI_FONT_LOADING_VALUE");
    expect(fontSource).toContain("EDITOR_FONT_LOADING_VALUE");
    expect(fontSource).toContain("++uiFontSelectionIntent");
    expect(fontSource).toContain("++editorFontSelectionIntent");
    expect(fontSource).toContain("listAppearanceUiFontFamilyOptions");
    expect(fontSource).toContain("listAppearanceEditorFontFamilyOptions");
    expect(fontSource).toContain('@option-action="requestDelete"');
    expect(fontSource).toContain("上传字体");
    expect(appearancePanelSource).toContain("appearance.whenReady()");
    expect(appearancePanelSource).toContain(':disabled="!ready"');
  });

  it("lets users replace a font-size value and previews valid input immediately", () => {
    expect(themeSource).toContain(
      "@input=\"previewFontSize('uiFontSize', $event)\""
    );
    expect(themeSource).toContain(
      "@change=\"commitFontSize('uiFontSize', $event)\""
    );
    expect(themeSource).not.toContain("restoreEmptyFontSize");
  });

  it("previews valid typed colors and validates incomplete values on commit", () => {
    expect(themeSource).toContain(
      "@input=\"previewColor('background', $event)\""
    );
    expect(themeSource).toContain(
      "@change=\"commitColor('background', $event)\""
    );
    expect(themeSource).toContain('preset: "custom"');
    expect(themeSource).toContain("editingTheme.accent.toLowerCase()");
    expect(themeSource).toContain("editingTheme.background.toLowerCase()");
    expect(themeSource).toContain("editingTheme.foreground.toLowerCase()");
    expect(themeSource).toContain("openColorPicker(");
    expect(themeSource).not.toContain(
      'appearance.updateTheme(editingScheme.value, { preset: "custom" })'
    );
  });
});
