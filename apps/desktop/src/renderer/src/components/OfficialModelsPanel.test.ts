import { describe, expect, it } from "vitest";
import source from "./OfficialModelsPanel.vue?raw";

describe("OfficialModelsPanel", () => {
  it("opens the official model shop in the system browser", () => {
    expect(source).toContain('href="https://pay.ldxp.cn/shop/UKGFTY58"');
    expect(source).toContain('target="_blank"');
    expect(source).toContain('rel="noopener noreferrer"');
    expect(source).toContain("店铺");
  });

  it("adds one protected token and presents local usage with remote consumption", () => {
    expect(source).toContain("添加你的官方令牌");
    expect(source).toContain('type="password"');
    expect(source).toContain('autocomplete="new-password"');
    expect(source).toContain('emit("saveToken", apiKey)');
    expect(source).toContain("本机累计使用 Token");
    expect(source).toContain("当前 Key 费用使用");
    expect(source).toContain("currentKeyRemainingYuan");
    expect(source).toContain("currentKeyUsedYuan");
    expect(source).toContain("currentKeyGrantedYuan");
    expect(source).toContain('role="progressbar"');
    expect(source).not.toContain("accountBalanceYuan");
    expect(source).not.toContain("keyQuotaRemainingYuan");
    expect(source).not.toContain("默认额度");
    expect(source).toContain("令牌明文不会回传到页面");
    expect(source).toContain("emit('load')");
  });

  it("shows total, input, output, and cache use for every official model", () => {
    expect(source).toContain("支撑的模型列表");
    expect(source).toContain("总消耗");
    expect(source).toContain("输入");
    expect(source).toContain("输出");
    expect(source).toContain("缓存");
    expect(source).toContain("折扣");
    expect(source).toContain("价格");
    expect(source).toContain("formatDiscount");
    expect(source).toContain("元 / 百万 Token");
    expect(source).toContain("row.model.status");
    expect(source).toContain('"不可用"');
    expect(source).toContain("启用");
    expect(source).toContain('role="switch"');
    expect(source).toContain("deepwriteOfficialEnabledModelIds");
    expect(source).toContain("setModelEnabled");
    expect(source).toContain("cacheReadTokens");
    expect(source).toContain("cacheWriteTokens");
    expect(source).toContain("本机 Token 来自本地账本");
    expect(source).not.toContain("quotaExhausted");
  });
});
