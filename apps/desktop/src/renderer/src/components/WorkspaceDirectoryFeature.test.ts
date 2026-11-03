import { describe, expect, it } from "vitest";
import source from "./WorkspaceDirectoryFeature.vue?raw";

describe("WorkspaceDirectoryFeature", () => {
  it("owns only the lightweight workspace-directory UI", () => {
    expect(source).not.toContain("存储位置");
    expect(source).not.toContain("这里决定以后新建和导入项目的默认位置");
    expect(source).toContain(':disabled="loading"');
    expect(source).toContain("当前应用数据不会迁移到新目录中");
    expect(source).toContain("工作目录管理");
    expect(source).toContain("添加目录");
    expect(source).toContain("设为当前目录");
    expect(source).toContain("迁移数据");
    expect(source).toContain("移除登记");
    expect(source).toContain("当前工作目录");
    expect(source).toContain("磁盘上的文件不会被删除");
    expect(source).toContain("需先切换工作目录");
    expect(source).toContain("暂无其它已登记的工作目录");
    expect(source).toContain('aria-label="目录操作"');
    // 重复入口已收敛：卡片上只保留「⋯」菜单，不再有内联操作按钮。
    expect(source).not.toContain('"directory-action-button"');
    // 旧版恢复入口已删除。
    expect(source).not.toContain("恢复上一个目录");
    expect(source).not.toContain("恢复迁移旧数据");
    expect(source).not.toContain("已是当前目录");
    expect(source).not.toContain("移除登记（需先切换）");
    expect(source).not.toContain("directory-hint");
    expect(source).not.toContain("ModelSettings");
    expect(source).not.toContain("modelEditor");
    expect(source).not.toContain("listRemote");
  });
});
