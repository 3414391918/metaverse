import { describe, expect, it } from "vitest";
import * as contracts from "./index";

const profile = {
  name: "林岚",
  keywords: "侦探，旅人\n旧友",
  faceDescription: "  深色眼睛\n\n修长身材。\n",
  settingDescription: "# 未分类原文\n\n![旧图](./old.png)\n保留尾部空白  \n",
  appearances: [
    { id: "appearance_rain", name: "雨夜", description: "黑衣\n\n雨伞\n" }
  ]
};

describe("long character profile contracts and Markdown", () => {
  it("round trips arbitrary Markdown fields with stable appearance markers", () => {
    const text = contracts.serializeLongCharacterProfileMarkdown(profile);
    expect(
      contracts.parseLongCharacterProfileMarkdown(text, profile.name)
    ).toEqual(profile);
    expect(text).toContain("appearance_rain");
  });

  it("preserves uncertain legacy paragraphs including image references", () => {
    const legacy =
      "脸部身材描述：深色眼睛\n\n1. 服装：雨夜黑衣\n\n来历不明的原文。\n\n![旧图](./old.png)\n\n体质设定：怕冷。\n";
    const parsed = contracts.parseLongCharacterProfileMarkdown(legacy, "林岚", [
      "旧友"
    ]);
    expect(parsed.faceDescription).toBe("深色眼睛");
    expect(parsed.keywords).toBe("旧友");
    expect(parsed.appearances).toHaveLength(1);
    expect(parsed.appearances[0]?.description).toBe("雨夜黑衣");
    expect(parsed.settingDescription).toContain("来历不明的原文。");
    expect(parsed.settingDescription).toContain("![旧图](./old.png)");
    expect(parsed.settingDescription).toContain("体质设定：怕冷。");
  });

  it("rejects malformed markers, duplicate appearances and unsafe asset identities", () => {
    expect(() =>
      contracts.parseLongCharacterProfileMarkdown(
        "<!-- deepwrite:character-profile:v1 -->\nbroken",
        "林岚"
      )
    ).toThrow(/结构|分区/);
    expect(() =>
      contracts.LongCharacterProfileSchema.parse({
        ...profile,
        appearances: [...profile.appearances, ...profile.appearances]
      })
    ).toThrow();
    expect(() =>
      contracts.LongCharacterAssetSchema.parse({
        id: "../bad",
        appearanceId: "appearance_rain",
        label: "雨",
        filename: "../bad.png"
      })
    ).toThrow();
  });
});

it("instructs the novel Agent to preserve profile partitions and appearance markers", () => {
  expect(contracts.DEFAULT_LONG_AGENTS_MD).toContain("分区与形象标识");
});

it("extracts named numbered legacy outfits with labeled bodies and preserves unknown paragraphs", () => {
  const legacy =
    "脸部身材描述：深色眼睛\n\n1、元流系列第一套服装\n（1）发型描述：长发。\n（2）服装描述：黑衣。\n\n![参考](old.png)\n\n2、白曜系列第一套服装\n（1）服装描述：白衣。\n\n无法归属的设定。\n\n体质和修炼方式：怕冷。";
  const parsed = contracts.parseLongCharacterProfileMarkdown(legacy, "林岚");
  expect(parsed.appearances.map(({ name }) => name)).toEqual([
    "元流系列第一套服装",
    "白曜系列第一套服装"
  ]);
  expect(parsed.appearances[0]?.description).toContain("（2）服装描述：黑衣。");
  expect(parsed.appearances[1]?.description).toBe("（1）服装描述：白衣。");
  expect(parsed.settingDescription).toContain("![参考](old.png)");
  expect(parsed.settingDescription).toContain("无法归属的设定。");
  expect(parsed.settingDescription).toContain("体质和修炼方式：怕冷。");
});
