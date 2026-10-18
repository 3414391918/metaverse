import { describe, expect, it } from "vitest";
import dialog from "./CreateBookDialog.vue?raw";
import settings from "./SettingsPage.vue?raw";
import sidebar from "./LeftSidebar.vue?raw";

describe("unified creation entry points", () => {
  it("opens a book form with current genres and bindings without a creation type selector", () => {
    expect(dialog).toContain("新建书籍");
    expect(dialog).toContain("LONG_BOOK_GENRES");
    expect(dialog).toContain("BookLibraryBindings");
    expect(dialog).not.toContain("workspaceTypeOptions");
    expect(dialog).not.toContain("SHORT_BOOK_GENRES");
    expect(dialog).not.toContain("SCRIPT_BOOK_GENRES");
  });
  it("removes creation and model settings", () => {
    expect(settings).not.toContain("<LongAgentSettingsPanel");
    expect(settings).not.toContain("<LibraryAgentSettingsPanel");
    expect(settings).not.toContain('title: "创作"');
    expect(settings).not.toContain('label: "自定义模型配置"');
    expect(settings).not.toContain('label: "用量"');
  });

  it("provides independent tools and voices without retired navigation", () => {
    expect(sidebar).toContain('id: "tools"');
    expect(sidebar).toContain('id: "voice-manager"');
    expect(sidebar).toContain('id: "prompt-templates"');
    expect(sidebar).not.toContain("子智能体团队");
    expect(sidebar).not.toContain("更多功能");
    expect(sidebar).not.toContain("修改分析");
  });
});
