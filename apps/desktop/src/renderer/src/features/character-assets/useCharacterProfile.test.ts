import { effectScope, nextTick, reactive } from "vue";
import { afterEach, expect, it, vi } from "vitest";
import type { LongCharacterProfileSnapshot } from "@deepwrite/contracts";
import { useCharacterProfile } from "./useCharacterProfile";
const scopes: ReturnType<typeof effectScope>[] = [];
afterEach(() => {
  scopes.splice(0).forEach((scope) => scope.stop());
  vi.unstubAllGlobals();
});
function snapshot(name = "林岚"): LongCharacterProfileSnapshot {
  return {
    bookId: "longbook_example",
    characterId: "character_example",
    revision: "a".repeat(64),
    assets: [],
    profile: {
      name,
      keywords: "",
      faceDescription: "外貌",
      settingDescription: "设定",
      appearances: []
    }
  };
}
async function settle() {
  await Promise.resolve();
  await nextTick();
  await Promise.resolve();
}
function setup(api: object) {
  vi.stubGlobal(
    "window",
    Object.assign(new EventTarget(), { deepwrite: { long: api } })
  );
  const props = reactive({
    bookId: "longbook_example",
    characterId: "character_example",
    updatedAt: "1"
  });
  const scope = effectScope();
  scopes.push(scope);
  const session = scope.run(() => useCharacterProfile(props, vi.fn()))!;
  return { session, props };
}
it("keeps an edit after saving fails", async () => {
  const { session } = setup({
    readCharacterProfile: async () => snapshot(),
    saveCharacterProfile: async () => {
      throw new Error("版本已变更");
    }
  });
  await settle();
  session.draft.value!.name = "未保存";
  expect(await session.save("name")).toBe(false);
  expect(session.draft.value!.name).toBe("未保存");
  expect(session.dirty.value).toBe(true);
});
it("ignores a stale read that returns after switching characters", async () => {
  let finish!: (value: LongCharacterProfileSnapshot) => void;
  const readCharacterProfile = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    )
    .mockResolvedValue({
      ...snapshot("新人物"),
      characterId: "character_other"
    });
  const { session, props } = setup({ readCharacterProfile });
  props.characterId = "character_other";
  await settle();
  finish(snapshot("旧人物"));
  await settle();
  expect(session.draft.value?.name).toBe("新人物");
});
it("saves the selected field and retains unrelated changes", async () => {
  const saveCharacterProfile = vi.fn(async (input) => ({
    ...snapshot(),
    profile: input.profile,
    revision: "b".repeat(64)
  }));
  const { session } = setup({
    readCharacterProfile: async () => snapshot(),
    saveCharacterProfile
  });
  await settle();
  session.draft.value!.name = "新名字";
  session.draft.value!.settingDescription = "继续编辑";
  expect(await session.save("name")).toBe(true);
  expect(
    saveCharacterProfile.mock.calls[0]![0].profile.settingDescription
  ).toBe("设定");
  expect(session.draft.value!.settingDescription).toBe("继续编辑");
  expect(session.dirty.value).toBe(true);
});

it("creates a named saved appearance while retaining unrelated draft edits", async () => {
  const saveCharacterProfile = vi.fn(async (input) => ({
    ...snapshot(),
    profile: input.profile,
    revision: "b".repeat(64)
  }));
  const { session } = setup({
    readCharacterProfile: async () => snapshot(),
    saveCharacterProfile
  });
  await settle();
  session.draft.value!.settingDescription = "未保存的设定";
  const created = await session.createAppearance("雨夜");
  expect(created?.snapshot.profile.appearances).toHaveLength(1);
  expect(created?.snapshot.profile.appearances[0]?.name).toBe("雨夜");
  expect(created?.snapshot.profile.settingDescription).toBe("设定");
  expect(session.selectedAppearance.value).toBe(created?.appearanceId);
  expect(session.draft.value!.settingDescription).toBe("未保存的设定");
});

it("leaves no draft or saved appearance after creation fails", async () => {
  const { session } = setup({
    readCharacterProfile: async () => snapshot(),
    saveCharacterProfile: async () => {
      throw new Error("版本冲突");
    }
  });
  await settle();
  expect(await session.createAppearance("雨夜")).toBeNull();
  expect(session.draft.value!.appearances).toEqual([]);
  expect(session.dirty.value).toBe(false);
});

it("accepts ordinary English appearance names and rejects newline names before saving", async () => {
  const saveCharacterProfile = vi.fn(async (input) => ({
    ...snapshot(),
    profile: input.profile,
    revision: "b".repeat(64)
  }));
  const { session } = setup({
    readCharacterProfile: async () => snapshot(),
    saveCharacterProfile
  });
  await settle();
  expect(
    (await session.createAppearance("Winter rain"))?.snapshot.profile
      .appearances[0]?.name
  ).toBe("Winter rain");
  expect(await session.createAppearance("bad\nname")).toBeNull();
  expect(saveCharacterProfile).toHaveBeenCalledTimes(1);
});

it("rereads externally updated text and asset metadata when returning to the window", async () => {
  let current = snapshot();
  const readCharacterProfile = vi.fn(async () => structuredClone(current));
  const { session } = setup({ readCharacterProfile });
  await settle();
  current = {
    ...snapshot(),
    revision: "b".repeat(64),
    profile: {
      ...snapshot().profile,
      appearances: [
        {
          id: "appearance_new",
          name: "雨夜",
          description: "外部 Agent 写入的服装"
        }
      ]
    },
    assets: [
      {
        id: "c".repeat(32),
        appearanceId: "appearance_new",
        label: "正面",
        filename: `${"c".repeat(32)}.png`
      }
    ]
  };
  window.dispatchEvent(new Event("focus"));
  await settle();
  expect(session.snapshot.value?.assets).toHaveLength(1);
  expect(session.draft.value?.appearances[0]?.description).toContain(
    "外部 Agent"
  );
  session.draft.value!.settingDescription = "正在输入";
  current.profile.settingDescription = "外部更新";
  current.revision = "c".repeat(64);
  window.dispatchEvent(new Event("focus"));
  await settle();
  expect(session.draft.value!.settingDescription).toBe("正在输入");
});

it("applies a confirmed appearance deletion and selects a remaining appearance", async () => {
  const before = snapshot();
  before.profile.appearances = [
    { id: "look_a", name: "待删", description: "" },
    { id: "look_b", name: "保留", description: "" }
  ];
  const deleteCharacterAppearance = vi.fn(async (raw: unknown) => {
    structuredClone(raw);
    return {
      ...before,
      revision: "b".repeat(64),
      profile: {
        ...before.profile,
        appearances: [before.profile.appearances[1]!]
      }
    };
  });
  const { session } = setup({
    readCharacterProfile: async () => before,
    deleteCharacterAppearance
  });
  await settle();
  const input = reactive({
    bookId: before.bookId,
    characterId: before.characterId,
    appearanceId: "look_a",
    expectedRevision: before.revision,
    expectedAssetIds: []
  });
  expect(await session.deleteAppearance(input)).toBe(true);
  expect(deleteCharacterAppearance).toHaveBeenCalledWith(input);
  expect(session.draft.value!.appearances.map((a) => a.id)).toEqual(["look_b"]);
  expect(session.selectedAppearance.value).toBe("look_b");
});

it("keeps the appearance selected when the deletion is rejected", async () => {
  const before = snapshot();
  before.profile.appearances = [
    { id: "look_a", name: "待删", description: "" }
  ];
  const { session } = setup({
    readCharacterProfile: async () => before,
    deleteCharacterAppearance: async () => {
      throw new Error("资料更新");
    }
  });
  await settle();
  expect(
    await session.deleteAppearance({
      bookId: before.bookId,
      characterId: before.characterId,
      appearanceId: "look_a",
      expectedRevision: before.revision,
      expectedAssetIds: []
    })
  ).toBe(false);
  expect(session.selectedAppearance.value).toBe("look_a");
  expect(session.draft.value!.appearances).toEqual(before.profile.appearances);
});
