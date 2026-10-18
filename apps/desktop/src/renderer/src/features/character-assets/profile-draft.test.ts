import { describe, expect, it } from "vitest";
import { mergeProfileField, rebaseProfileDraft } from "./profile-draft";

const profile = () => ({
  name: "林岚",
  keywords: "阿岚",
  faceDescription: "旧外貌",
  settingDescription: "旧设定",
  appearances: [{ id: "look_a", name: "常服", description: "青衣" }]
});

describe("character profile drafts", () => {
  it("saves one field without saving other edits", () => {
    const saved = profile();
    const draft = {
      ...profile(),
      name: "新姓名",
      settingDescription: "未保存的设定"
    };
    expect(mergeProfileField(saved, draft, "name")).toEqual({
      ...saved,
      name: "新姓名"
    });
    expect(saved.name).toBe("林岚");
  });
  it("preserves typing that occurred while a save was in flight", () => {
    const before = profile();
    const submitted = { ...profile(), name: "第一次修改" };
    const current = {
      ...submitted,
      name: "第二次修改",
      faceDescription: "还未保存"
    };
    expect(rebaseProfileDraft(before, current, submitted, submitted)).toEqual(
      current
    );
  });
  it("saves an appearance field without other appearance edits", () => {
    const saved = profile();
    const draft = profile();
    draft.appearances[0]!.name = "战装";
    draft.appearances[0]!.description = "未保存的外观";
    expect(
      mergeProfileField(saved, draft, "appearance-name", "look_a")
        .appearances[0]
    ).toEqual({ id: "look_a", name: "战装", description: "青衣" });
  });
  it("keeps a newly added draft appearance on an unrelated save", () => {
    const saved = profile();
    const draft = profile();
    draft.appearances.push({ id: "look_b", name: "新形象", description: "" });
    const submitted = mergeProfileField(saved, draft, "keywords");
    expect(
      rebaseProfileDraft(saved, draft, submitted, submitted).appearances
    ).toEqual(draft.appearances);
  });
});
