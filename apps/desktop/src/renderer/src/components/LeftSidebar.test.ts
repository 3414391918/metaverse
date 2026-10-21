import { describe, expect, it } from "vitest";
import sidebarSource from "./LeftSidebar.vue?raw";
import profileSource from "./SidebarProfileMenu.vue?raw";
const source = `${sidebarSource}\n${profileSource}`;

describe("LeftSidebar account controls", () => {
  it("separates the account menu from the settings-page button", () => {
    expect(source).toContain('@click="toggleAccountMenu"');
    expect(source).toContain('aria-label="打开设置"');
    expect(source).toContain('@click="openSettings"');
    expect(source).not.toContain("@click=\"emit('openSettings')\"");
  });

  it("offers settings and author contact without updates or local name editing", () => {
    expect(source).toContain("<span>设置</span>");
    expect(source).toContain('@click="openSettings"');
    expect(source).not.toContain("版本更新");
    expect(source).toContain("联系作者");
    expect(source).toContain('profileDialog.value = "contact"');
    expect(source).not.toContain("<span>姓名</span>");
    expect(source).not.toContain("openNameDialog");
    expect(source).not.toContain("设置姓名");
  });

  it("shows the requested author contact without local name persistence", () => {
    expect(source).not.toContain("USER_NAME_STORAGE_KEY");
    expect(source).not.toContain("saveUserName");
    expect(source).not.toContain("userNameDraft");
    expect(source).toContain(
      "如果你有任何反馈，或者想体验最新版本，请添加作者微信并加入交流群。"
    );
    expect(source).toContain("deepseekwrite");
  });

  it("turns the top action into create-book instead of a new conversation", () => {
    expect(source).toContain('label: "新建书籍"');
    expect(source).toContain('id: "create-book"');
    expect(source).toContain('aria-label="新建书籍"');
    expect(source).toContain('emit("createBook")');
    expect(source).not.toContain('label: "新建对话"');
    expect(source).not.toContain("newConversation");
  });

  it("puts tools and sounds in the primary navigation", () => {
    expect(sidebarSource).not.toContain('label: "自定义模型配置"');
    expect(sidebarSource).toContain('id: "tools"');
    expect(sidebarSource).toContain('id: "voice-manager"');
    expect(sidebarSource).not.toContain('id: "directory"');
    expect(sidebarSource).not.toContain('emit("openAgentTeams")');
    expect(sidebarSource).not.toContain("moreFeatures");
    expect(source).toContain("props.activePrimaryFeature");
    expect(source).toContain("'is-active'");
    expect(source).toContain("'page'");
  });
});
