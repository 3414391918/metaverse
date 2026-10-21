import { describe, expect, it } from "vitest";
import source from "./WorkspaceDirectoryFeature.vue?raw";

describe("WorkspaceDirectoryFeature", () => {
  it("owns only the lightweight workspace-directory UI", () => {
    expect(source).not.toContain("存储位置");
    expect(source).not.toContain("这里决定以后新建和导入项目的默认位置");
    expect(source).toContain(':disabled="loading"');
    expect(source).toContain("当前应用数据不会迁移到新目录中");
    expect(source).toContain("恢复目录");
    expect(source).toContain("数据迁移");
    expect(source).toContain('aria-label="工作目录操作"');
    expect(source).not.toContain("ModelSettings");
    expect(source).not.toContain("modelEditor");
    expect(source).not.toContain("listRemote");
  });
});
