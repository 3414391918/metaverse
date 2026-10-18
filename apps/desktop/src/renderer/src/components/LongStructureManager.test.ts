import { describe, expect, it } from "vitest";
import deleteDialogSource from "./LongStructureDeleteDialog.vue?raw";
import componentSource from "./LongStructureManager.vue?raw";
import featureSource from "./LongStructureFeatureSettings.vue?raw";
import agentsSource from "./LongAgentsMdEditor.vue?raw";
import formDialogSource from "./LongStructureFormDialog.vue?raw";
import formSource from "../composables/useLongStructureForm.ts?raw";
const source =
  componentSource +
  featureSource +
  agentsSource +
  formDialogSource +
  formSource;
import syncDialogSource from "./LongWorldbuildingSyncDialog.vue?raw";
import deleteConfirmationSource from "../composables/useLongStructureDeleteConfirmation.ts?raw";

describe("LongStructureManager", () => {
  it("manages worldbuilding categories and text-only character types", () => {
    expect(source).toContain("结构管理");
    expect(source).toContain(
      "管理世界观分类、人物类型、功能配置和主智能体上下文"
    );
    expect(source).toContain("options.snapshot().worldbuilding");
    expect(source).toContain("builder.createWorldbuilding");
    expect(source).toContain("builder.updateWorldbuilding");
    expect(source).toContain("builder.reorderWorldbuilding");
    expect(deleteConfirmationSource).toContain("builder.deleteWorldbuilding");
    expect(source).toContain("新建世界观分类");
    expect(source).toContain("加载其他小说世界观");
    expect(syncDialogSource).toContain("加载其他书籍世界观");
    expect(syncDialogSource).toContain("个世界观分类及其全部内容");
    expect(source).toContain('"syncWorldbuilding"');
    expect(source).not.toContain("builder.createVolume");
    expect(source).not.toContain("builder.createArc");
    expect(source).not.toContain("builder.createChapter");
    expect(source).toContain("builder.createCharacterType");
    expect(source).toContain("builder.updateCharacterType");
    expect(source).toContain("builder.reorderCharacterType");
    expect(deleteConfirmationSource).toContain("builder.deleteCharacterType");
    expect(source).toContain("人物类型");
    expect(deleteDialogSource).toContain("迁移人物并删除");
    expect(deleteDialogSource).toContain("删除类型及关联人物");
    expect(source).toContain("activeFoundationSection === 'worldbuilding'");
    expect(source).not.toContain("builder.updateVolume");
    expect(source).not.toContain("builder.updateArc");
    expect(source).not.toContain("builder.updateChapter");
    expect(source).not.toContain("builder.deleteVolume");
    expect(source).not.toContain("builder.deleteArc");
    expect(source).not.toContain("builder.deleteChapter");
  });

  it("replaces narrative management with worldbuilding feature settings", () => {
    expect(source).toContain(
      'type StructurePanel = "foundation" | "features" | "agents"'
    );
    expect(source).toContain('label: "基础结构"');
    expect(source).toContain('label: "功能配置"');
    expect(source).toContain('label: "主智能体上下文"');
    expect(source.indexOf('label: "主智能体上下文"')).toBeLessThan(
      source.indexOf('label: "基础结构"')
    );
    expect(source.indexOf('label: "基础结构"')).toBeLessThan(
      source.indexOf('label: "功能配置"')
    );
    expect(source).toContain("世界观条目样式");
    expect(source).toContain("人物与连续性条目样式");
    expect(source).toContain("剧情设计条目样式");
    expect(source).toContain('value: "top-tabs"');
    expect(source).toContain('value: "right-list"');
    expect(source).toContain('value: "left-tree"');
    expect(source).toContain('label: "左侧树形结构"');
    expect(source).toContain("builder.updateFeatureSettings");
    expect(source).toContain("settings.worldbuildingItemLayout");
    expect(source).toContain("settings.characterAndContinuityItemLayout");
    expect(source).toContain("settings.plotItemLayout");
    expect(source).toContain("<PopupSelect");
    expect(source).not.toContain('label: "剧情与叙事"');
    expect(source).not.toContain("<LongPlotStructureManager");
    expect(source).not.toContain('label: "人物"');
    expect(source).not.toContain('label: "分卷"');
    expect(source).not.toContain('label: "剧情点"');
    expect(source).not.toContain('label: "章卡"');
    expect(source).not.toContain("功能配置项暂时为空");
    expect(source).toContain('id="long-structure-panel-content-agents"');
    expect(source).toContain('aria-label="主智能体上下文"');
    expect(source).toContain('"saveAgentsMd"');
    expect(source).toContain("flushAgentsMdIfNeeded");
  });

  it("uses shared themed controls and compact teleported dialogs", () => {
    expect(source).toContain("<PopupSelect");
    expect(source.match(/<Teleport to="body">/gu)).toHaveLength(1);
    expect(deleteDialogSource.match(/<Teleport to="body">/gu)).toHaveLength(1);
    expect(syncDialogSource.match(/<Teleport to="body">/gu)).toHaveLength(1);
    expect(source).toContain(':menu-z-index="2300"');
    expect(componentSource).toContain(
      '<style scoped src="./LongStructureManager.css">'
    );
    expect(source).toContain("uiMessage.warning");
    expect(source).toContain("@keydown.esc.stop=\"emit('close')\"");
    expect(deleteDialogSource).toContain("@keydown.esc.stop=\"emit('close')\"");
    expect(syncDialogSource).toContain("@keydown.esc.stop=\"emit('close')\"");
    expect(deleteDialogSource).toContain("danger-button");
    expect(syncDialogSource).toContain("确认按上述影响覆盖");
  });

  it("publishes one prioritized child modal so its parent can suspend", () => {
    expect(source).toContain("const activeModal = computed");
    expect(source).toContain("modalActiveChange: [active: boolean]");
    expect(source).toContain("activeModal === 'form'");
    expect(source).toContain("activeModal === 'sync'");
    expect(source).toContain("activeModal === 'delete'");
  });
});
